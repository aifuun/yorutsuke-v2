/**
 * Hook Bridge for CategoryChart
 * ADR-020: Connects view to data and provides handlers
 */
import { useCallback } from 'react';
import type { CategoryDataPoint } from '../views/CategoryChart';

export interface UseCategoryChartOptions {
  /** Chart data (computed from transactions) */
  data: CategoryDataPoint[];
  /** Chart type: income or expense */
  type?: 'expense' | 'income';
  /** Optional: Callback when bar is clicked */
  onBarClick?: (data: CategoryDataPoint) => void;
  /** Optional: Callback for navigation */
  onNavigate?: (path: string) => void;
  /** Optional: Chart height */
  height?: number;
  /** Optional: Max categories to display */
  maxCategories?: number;
}

export interface UseCategoryChartResult {
  /** Chart data ready for rendering */
  data: CategoryDataPoint[];
  /** Chart type */
  type: 'expense' | 'income';
  /** Handle bar click - navigates to ledger with category filter */
  handleBarClick: (data: CategoryDataPoint) => void;
  /** Chart display options */
  height: number;
  maxCategories: number;
}

/**
 * Hook Bridge for CategoryChart
 * Provides all props needed by CategoryChart view
 *
 * @example
 * ```tsx
 * function DashboardView() {
 *   const chartData = useChartData(transactions);
 *   const expenseProps = useCategoryChart({
 *     data: chartData.categoryData.expense,
 *     type: 'expense',
 *     onNavigate: navigate,
 *   });
 *
 *   return <CategoryChart {...expenseProps} />;
 * }
 * ```
 */
export function useCategoryChart(options: UseCategoryChartOptions): UseCategoryChartResult {
  const {
    data,
    type = 'expense',
    onBarClick,
    onNavigate,
    height = 400,
    maxCategories = 5,
  } = options;

  // Stable handler reference
  const handleBarClick = useCallback(
    (clickData: CategoryDataPoint) => {
      if (onBarClick) {
        onBarClick(clickData);
      } else if (onNavigate) {
        // Default behavior: Navigate to ledger with category filter
        onNavigate(`/ledger?category=${encodeURIComponent(clickData.category)}`);
      }
    },
    [onBarClick, onNavigate]
  );

  return {
    data,
    type,
    handleBarClick,
    height,
    maxCategories,
  };
}
