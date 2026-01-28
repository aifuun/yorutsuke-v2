/**
 * Hook Bridge for TrendChart
 * ADR-020: Connects view to data and provides handlers
 */
import { useCallback } from 'react';
import type { TrendDataPoint } from '../views/TrendChart';

export interface UseTrendChartOptions {
  /** Chart data (computed from transactions) */
  data: TrendDataPoint[];
  /** Optional: Callback when point is clicked */
  onPointClick?: (point: TrendDataPoint) => void;
  /** Optional: Callback for navigation */
  onNavigate?: (path: string) => void;
  /** Optional: Chart height */
  height?: number;
  /** Optional: Show legend */
  showLegend?: boolean;
}

export interface UseTrendChartResult {
  /** Chart data ready for rendering */
  data: TrendDataPoint[];
  /** Handle point click - navigates to ledger with date filter */
  handlePointClick: (point: TrendDataPoint) => void;
  /** Chart display options */
  height: number;
  showLegend: boolean;
}

/**
 * Hook Bridge for TrendChart
 * Provides all props needed by TrendChart view
 *
 * @example
 * ```tsx
 * function DashboardView() {
 *   const chartData = useChartData(transactions);
 *   const trendProps = useTrendChart({
 *     data: chartData.trendData,
 *     onNavigate: navigate,
 *   });
 *
 *   return <TrendChart {...trendProps} />;
 * }
 * ```
 */
export function useTrendChart(options: UseTrendChartOptions): UseTrendChartResult {
  const {
    data,
    onPointClick,
    onNavigate,
    height = 300,
    showLegend = true,
  } = options;

  // Stable handler reference
  const handlePointClick = useCallback(
    (point: TrendDataPoint) => {
      if (onPointClick) {
        onPointClick(point);
      } else if (onNavigate) {
        // Default behavior: Navigate to ledger with date filter
        onNavigate(`/ledger?date=${point.date}`);
      }
    },
    [onPointClick, onNavigate]
  );

  return {
    data,
    handlePointClick,
    height,
    showLegend,
  };
}
