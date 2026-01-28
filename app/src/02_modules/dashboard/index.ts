/**
 * Dashboard Module
 * Data visualization components for financial trends and breakdowns
 * @see docs/design/DATA-VIZ.md
 *
 * Architecture:
 * - views/ - Chart components (TrendChart, CategoryChart)
 * - hooks/ - Data transformation + Hook Bridge Layer
 * - styles/ - Chart styling
 *
 * Pillar I (Firewalls): All exports go through barrel exports (views/index.ts, hooks/index.ts)
 * ADR-020 (Hook Bridge): useTrendChart, useCategoryChart connect views to data
 */

// Views (via barrel export)
export * from './views';

// Hooks (via barrel export)
export * from './hooks';

// Styles (import in App.tsx or where needed)
import './styles/charts.css';
