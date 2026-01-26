/**
 * TrendChart - 7-day income vs expense trend line chart
 * @see docs/design/DATA-VIZ.md for specifications
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CSSProperties } from 'react';

export interface TrendDataPoint {
  date: string;      // "01/10" or "2026-01-10"
  income: number;    // Amount in yen
  expense: number;   // Amount in yen
  label?: string;    // Optional full date label for tooltip
}

interface TrendChartProps {
  data: TrendDataPoint[];
  height?: number;
  showLegend?: boolean;
  onPointClick?: (data: TrendDataPoint) => void;
  onNavigate?: (path: string) => void;
}

const tooltipStyle: CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-2)',
  padding: 'var(--space-3)',
};

export function TrendChart({
  data,
  height = 300,
  showLegend = true,
  onPointClick,
  onNavigate,
}: TrendChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (chartData: any) => {
    if (!chartData?.activePayload?.[0]) return;
    const point = chartData.activePayload[0].payload as TrendDataPoint;

    if (onPointClick) {
      onPointClick(point);
    } else if (onNavigate) {
      onNavigate(`/ledger?date=${point.date}`);
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

  return (
    <figure
      role="img"
      aria-label={`収支トレンド。${data.length}日間のデータ。`}
      className="trend-chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 50, bottom: showLegend ? 40 : 20 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            stroke="var(--text-secondary)"
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
            labelFormatter={(label) => `日付: ${label}`}
            contentStyle={tooltipStyle}
            cursor={{ stroke: 'var(--border)', strokeDasharray: '3 3' }}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="line"
              wrapperStyle={{ paddingTop: '16px' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="income"
            stroke="var(--color-income)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-income)' }}
            activeDot={{ r: 6, stroke: 'var(--bg-card)', strokeWidth: 2 }}
            name="収入"
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="var(--color-expense)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-expense)' }}
            activeDot={{ r: 6, stroke: 'var(--bg-card)', strokeWidth: 2 }}
            name="支出"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Screen reader fallback table */}
      <table className="sr-only">
        <caption>収支トレンドデータ</caption>
        <thead>
          <tr>
            <th>日付</th>
            <th>収入</th>
            <th>支出</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.label || row.date}</td>
              <td>¥{row.income.toLocaleString('ja-JP')}</td>
              <td>¥{row.expense.toLocaleString('ja-JP')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
