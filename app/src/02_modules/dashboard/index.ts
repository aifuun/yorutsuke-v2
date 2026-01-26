/**
 * Dashboard Module
 * Data visualization components for financial trends and breakdowns
 * @see docs/design/DATA-VIZ.md
 */

// Components
export { TrendChart } from './views/TrendChart';
export type { TrendDataPoint } from './views/TrendChart';

export { CategoryChart } from './views/CategoryChart';
export type { CategoryDataPoint } from './views/CategoryChart';

// Headless hooks
// Pure computation hooks (not business logic - no migration needed)
export { useChartData, useMockChartData } from './hooks/useChartData';

// Styles (import in App.tsx or where needed)
import './styles/charts.css';
