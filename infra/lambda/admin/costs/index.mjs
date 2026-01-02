/**
 * Admin Costs Lambda
 * AWS Cost Explorer integration
 */

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

// Cost Explorer must be called from us-east-1
const ce = new CostExplorerClient({ region: "us-east-1" });

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Get date N days ago
 */
function daysAgo(n) {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/**
 * Get cost data for a period
 */
async function getCosts(period = "7d") {
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 7;
  const startDate = formatDate(daysAgo(days));
  const endDate = formatDate(new Date());

  try {
    // Get daily costs
    const dailyResult = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startDate,
          End: endDate,
        },
        Granularity: "DAILY",
        Metrics: ["BlendedCost"],
      })
    );

    // Get costs by service
    const serviceResult = await ce.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startDate,
          End: endDate,
        },
        Granularity: "MONTHLY",
        Metrics: ["BlendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      })
    );

    // Parse daily costs
    const daily = (dailyResult.ResultsByTime || []).map((day) => ({
      date: day.TimePeriod?.Start,
      amount: parseFloat(day.Total?.BlendedCost?.Amount || "0"),
    }));

    // Parse service breakdown
    const serviceGroups = serviceResult.ResultsByTime?.[0]?.Groups || [];
    const services = serviceGroups
      .map((group) => ({
        service: group.Keys?.[0] || "Unknown",
        amount: parseFloat(group.Metrics?.BlendedCost?.Amount || "0"),
      }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Calculate total
    const total = daily.reduce((sum, d) => sum + d.amount, 0);

    // Calculate percentages
    const servicesWithPercentage = services.map((s) => ({
      ...s,
      percentage: total > 0 ? (s.amount / total) * 100 : 0,
    }));

    return {
      period,
      startDate,
      endDate,
      currency: "USD",
      total,
      daily,
      services: servicesWithPercentage,
    };
  } catch (error) {
    console.error("Error fetching costs:", error);
    throw error;
  }
}

export async function handler(event) {
  console.log("Admin costs request:", JSON.stringify(event));

  try {
    // Get period from query string
    const period = event.queryStringParameters?.period || "7d";

    if (!["7d", "30d", "90d"].includes(period)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Invalid period. Use '7d', '30d', or '90d'" }),
      };
    }

    const costs = await getCosts(period);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(costs),
    };
  } catch (error) {
    console.error("Error in costs handler:", error);

    // Handle specific Cost Explorer errors
    if (error.name === "AccessDeniedException") {
      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: "Cost Explorer access denied. Enable Cost Explorer in AWS Console.",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Failed to fetch costs" }),
    };
  }
}
