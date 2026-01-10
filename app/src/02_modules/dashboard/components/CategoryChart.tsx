/**
 * CategoryChart - Top N category breakdown bar chart
 * @see docs/design/DATA-VIZ.md for specifications
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CSSProperties } from 'react';

export interface CategoryDataPoint {
  category: string;  // "食費", "交通費", etc.
  amount: number;    // Amount in yen
  color?: string;    // Optional custom color
}

interface CategoryChartProps {
  data: CategoryDataPoint[];
  height?: number;
  type?: 'expense' | 'income';
  maxCategories?: number;
  onBarClick?: (data: CategoryDataPoint) => void;
  onNavigate?: (path: string) => void;
}

const CATEGORY_COLORS = [
  'var(--chart-cat-1)',
  'var(--chart-cat-2)',
  'var(--chart-cat-3)',
  'var(--chart-cat-4)',
  'var(--chart-cat-5)',
  'var(--chart-cat-6)',
  'var(--chart-cat-7)',
];

const tooltipStyle: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-2)',
  padding: 'var(--space-3)',
};

export function CategoryChart({
  data,
  height = 400,
  type = 'expense',
  maxCategories = 5,
  onBarClick,
  onNavigate,
}: CategoryChartProps) {
  // Limit to top N categories
  const chartData = data.slice(0, maxCategories);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (clickData: any) => {
    if (!clickData?.activePayload?.[0]) return;
    const point = clickData.activePayload[0].payload as CategoryDataPoint;

    if (onBarClick) {
      onBarClick(point);
    } else if (onNavigate) {
      onNavigate(`/ledger?category=${encodeURIComponent(point.category)}`);
    }
  };

  const formatYAxis = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(0)}万`;
    }
    if (value >= 1000) {
      return `¥${(value / 1000).toFixed(0)}K`;
    }
    return `¥${value}`;
  };

  const formatTooltip = (value: number | undefined) => {
    if (value === undefined) return '';
    return `¥${value.toLocaleString('ja-JP')}`;
  };

  const getBarColor = (index: number, entry: CategoryDataPoint) => {
    if (entry.color) return entry.color;
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  };

  const chartTitle = type === 'expense'
    ? `支出トップ${chartData.length}カテゴリ`
    : `収入トップ${chartData.length}カテゴリ`;

  return (
    <figure
      role="img"
      aria-label={chartTitle}
      className="category-chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 50, bottom: 80 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="category"
            stroke="var(--text-secondary)"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '12px' }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-secondary)"
            style={{ fontSize: '12px' }}
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={formatTooltip}
            contentStyle={tooltipStyle}
            cursor={{ fill: 'var(--bg-hover)', opacity: 0.5 }}
          />
          <Bar
            dataKey="amount"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${entry.category}`}
                fill={getBarColor(index, entry)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Screen reader fallback table */}
      <table className="sr-only">
        <caption>{chartTitle}</caption>
        <thead>
          <tr>
            <th>カテゴリ</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row) => (
            <tr key={row.category}>
              <td>{row.category}</td>
              <td>¥{row.amount.toLocaleString('ja-JP')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
