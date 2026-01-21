/**
 * Admin Costs Lambda (Phase 3 - P1)
 *
 * Fetches AWS cost data from Cost Explorer:
 * - Daily cost breakdown (7d, 30d, 90d periods)
 * - Service-level breakdown with percentages
 * - Cost optimization insights for admin dashboard
 *
 * CRITICAL: Cost Explorer API must be called from us-east-1 region
 */

import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { logger, initContext, EVENTS } from '/opt/nodejs/shared/logger.mjs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from './types/aws-events.js';

// CRITICAL: Cost Explorer only works in us-east-1
const ce = new CostExplorerClient({ region: 'us-east-1' });

/**
 * CORS headers
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Valid time periods
 */
const VALID_PERIODS = ['7d', '30d', '90d'] as const;
type Period = typeof VALID_PERIODS[number];

/**
 * Daily cost entry
 */
interface DailyCost {
  date: string;
  amount: number;
}

/**
 * Service cost entry with percentage
 */
interface ServiceCost {
  service: string;
  amount: number;
  percentage: number;
}

/**
 * Cost response body
 */
interface CostResponse {
  period: string;
  currency: string;
  total: number;
  daily: DailyCost[];
  services: ServiceCost[];
}

/**
 * Create response with CORS headers
 */
function response(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get date N days ago
 */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Fetch costs from Cost Explorer
 */
async function getCosts(period: Period): Promise<CostResponse> {
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  const startDate = formatDate(daysAgo(days));
  const endDate = formatDate(new Date());

  logger.info(EVENTS.ADMIN_COSTS_REQUEST, { period, startDate, endDate });

  try {
    // Get daily costs with DAILY granularity
    const dailyResult = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost'],
      })
    );

    // Get costs by service with MONTHLY granularity + GroupBy
    const serviceResult = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'MONTHLY',
        Metrics: ['BlendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      })
    );

    // Parse daily costs
    const daily: DailyCost[] = (dailyResult.ResultsByTime || []).map((day) => ({
      date: day.TimePeriod?.Start || '',
      amount: parseFloat(day.Total?.BlendedCost?.Amount || '0'),
    }));

    // Calculate total
    const total = daily.reduce((sum, d) => sum + d.amount, 0);

    // Parse service breakdown
    const serviceGroups = serviceResult.ResultsByTime?.[0]?.Groups || [];
    const services: ServiceCost[] = serviceGroups
      .map((group) => ({
        service: group.Keys?.[0] || 'Unknown',
        amount: parseFloat(group.Metrics?.BlendedCost?.Amount || '0'),
      }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((s) => ({
        ...s,
        percentage: total > 0 ? (s.amount / total) * 100 : 0,
      }));

    logger.info(EVENTS.ADMIN_COSTS_SUCCESS, { period, total, serviceCount: services.length });

    return {
      period,
      currency: 'USD',
      total,
      daily,
      services,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(EVENTS.ADMIN_COSTS_FETCH_ERROR, { error: errorMessage, errorName });

    // Handle AccessDenied separately
    if (errorName === 'AccessDeniedException') {
      throw new Error('Cost Explorer access denied. Check IAM permissions.');
    }

    throw error;
  }
}

/**
 * Lambda handler
 * GET /admin/costs?period=7d
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  initContext(event);

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const period = (event.queryStringParameters?.period || '7d') as string;

    // Validate period
    if (!VALID_PERIODS.includes(period as Period)) {
      return response(400, {
        error: `Invalid period. Must be one of: ${VALID_PERIODS.join(', ')}`,
      });
    }

    const costs = await getCosts(period as Period);
    return response(200, costs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(EVENTS.ADMIN_COSTS_HANDLER_ERROR, { error: errorMessage });

    // Check for access denied error
    if (errorMessage.includes('access denied')) {
      return response(403, {
        error: 'Cost Explorer access denied. Check IAM permissions.',
      });
    }

    return response(500, { error: 'Failed to fetch costs' });
  }
}
