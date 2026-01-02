/**
 * Admin Costs Page
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api, endpoints } from '../api/client';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

type Period = '7d' | '30d' | '90d';

interface CostsData {
  period: string;
  startDate: string;
  endDate: string;
  currency: string;
  total: number;
  daily: Array<{ date: string; amount: number }>;
  services: Array<{ service: string; amount: number; percentage: number }>;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

const SERVICE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#f97316',
];

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function Costs() {
  const [costs, setCosts] = useState<CostsData | null>(null);
  const [period, setPeriod] = useState<Period>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<CostsData>(`${endpoints.costs}?period=${period}`);
      setCosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch costs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCosts();
  }, [period]);

  const dailyData = (costs?.daily || []).map((d) => ({
    date: formatDate(d.date),
    amount: d.amount,
  }));

  const total = costs?.total || 0;
  const avgDaily = dailyData.length > 0 ? total / dailyData.length : 0;
  const maxDaily = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.amount)) : 0;
  const topService = costs?.services?.[0];

  const pieData = (costs?.services || []).slice(0, 8).map((s) => ({
    name: s.service.replace('Amazon ', '').replace('AWS ', ''),
    value: s.amount,
  }));

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-app-text">AWS Costs</h1>
            <p className="text-app-text-secondary mt-1">Cost Explorer dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="px-4 py-2 bg-app-surface border border-app-border rounded-lg
                         text-app-text focus:outline-none focus:border-app-accent"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchCosts}
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-app-surface border border-app-border rounded-lg
                         hover:bg-app-border transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-app-surface border border-app-border rounded-lg p-4">
            <p className="text-sm text-app-text-secondary">Total Cost</p>
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(total)}</p>
            <p className="text-xs text-app-text-secondary">{period} period</p>
          </div>
          <div className="bg-app-surface border border-app-border rounded-lg p-4">
            <p className="text-sm text-app-text-secondary">Daily Average</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(avgDaily)}</p>
          </div>
          <div className="bg-app-surface border border-app-border rounded-lg p-4">
            <p className="text-sm text-app-text-secondary">Peak Day</p>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(maxDaily)}</p>
          </div>
          <div className="bg-app-surface border border-app-border rounded-lg p-4">
            <p className="text-sm text-app-text-secondary">Top Service</p>
            <p className="text-2xl font-bold text-purple-400">
              {topService ? formatCurrency(topService.amount) : '-'}
            </p>
            <p className="text-xs text-app-text-secondary">
              {topService?.service.replace('Amazon ', '').replace('AWS ', '')}
            </p>
          </div>
        </div>

        {/* Cost Trend Chart */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-app-text mb-4">Daily Cost Trend</h2>
          <div className="bg-app-surface border border-app-border rounded-lg p-4">
            <div className="h-64">
              {isLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-app-text-secondary">Loading...</div>
                </div>
              ) : dailyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-app-text-secondary">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <YAxis
                      tick={{ fill: '#9ca3af', fontSize: 10 }}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value) => [formatCurrency(Number(value) || 0), 'Cost']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Service Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart */}
          <div>
            <h2 className="text-lg font-semibold text-app-text mb-4">Service Distribution</h2>
            <div className="bg-app-surface border border-app-border rounded-lg p-4">
              <div className="h-64">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-app-text-secondary">
                    No data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#6b7280' }}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                        formatter={(value) => [formatCurrency(Number(value) || 0), 'Cost']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Service List */}
          <div>
            <h2 className="text-lg font-semibold text-app-text mb-4">Service Breakdown</h2>
            <div className="bg-app-surface border border-app-border rounded-lg p-4 h-64 overflow-y-auto">
              {(costs?.services || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-app-text-secondary">
                  No data available
                </div>
              ) : (
                <div className="space-y-3">
                  {(costs?.services || []).map((service, index) => (
                    <div key={service.service} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: SERVICE_COLORS[index % SERVICE_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-app-text truncate">
                            {service.service.replace('Amazon ', '').replace('AWS ', '')}
                          </span>
                          <span className="text-sm text-app-text-secondary ml-2">
                            {formatCurrency(service.amount)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 bg-app-border rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${service.percentage}%`,
                              backgroundColor: SERVICE_COLORS[index % SERVICE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-app-text-secondary w-12 text-right">
                        {service.percentage.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {costs && (
          <p className="mt-6 text-xs text-app-text-secondary text-center">
            Data from {costs.startDate} to {costs.endDate}. Note: Cost data may have a 24-48 hour delay.
          </p>
        )}
      </div>
    </Layout>
  );
}
