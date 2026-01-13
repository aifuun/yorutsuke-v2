/**
 * Dashboard Module
 * Data visualization components for financial trends and breakdowns
 * @see docs/design/DATA-VIZ.md
 */

// Components
export { TrendChart } from './components/TrendChart';
export type { TrendDataPoint } from './components/TrendChart';

export { CategoryChart } from './components/CategoryChart';
export type { CategoryDataPoint } from './components/CategoryChart';

// Headless hooks
// Pure computation hooks (not business logic - no migration needed)
export { useChartData, useMockChartData } from './hooks/useChartData';

// Styles (import in App.tsx or where needed)
import './styles/charts.css';
