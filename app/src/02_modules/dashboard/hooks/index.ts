/**
 * Dashboard Hooks
 * Barrel export for hooks
 */

// Data transformation hooks (Layer 1: Pure computation)
export { useChartData, useMockChartData } from './useChartData';

// Hook Bridge Layer (Layer 1.5: Connect views to data + handlers)
export { useTrendChart } from './useTrendChart';
export type { UseTrendChartOptions, UseTrendChartResult } from './useTrendChart';

export { useCategoryChart } from './useCategoryChart';
export type { UseCategoryChartOptions, UseCategoryChartResult } from './useCategoryChart';
