/**
 * Admin Dashboard Page
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { StatCard } from '../components/StatCard';
import { api, endpoints } from '../api/client';

interface Stats {
  emergency: {
    emergencyStop: boolean;
    reason: string | null;
    updatedAt: string | null;
  };
  images: {
    today: number;
    total: number;
  };
  activeUsers: number;
  generatedAt: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<Stats>(endpoints.stats);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Dashboard</h1>
            <p className="text-app-text-secondary mt-1">System overview</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-app-surface border border-app-border rounded-lg
                       hover:bg-app-border transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && !stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-app-surface border border-app-border rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <>
            {/* Emergency Alert Banner */}
            {stats.emergency.emergencyStop && (
              <div className="mb-6 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="font-bold">Emergency Stop Active</p>
                  <p className="text-sm">{stats.emergency.reason || 'No reason provided'}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Emergency Stop"
                value={stats.emergency.emergencyStop ? 'ACTIVE' : 'OFF'}
                subtitle={stats.emergency.updatedAt ? `Updated: ${new Date(stats.emergency.updatedAt).toLocaleString()}` : undefined}
                icon={stats.emergency.emergencyStop ? '🚨' : '✅'}
                color={stats.emergency.emergencyStop ? 'red' : 'green'}
              />
              <StatCard
                title="Images Today"
                value={stats.images.today}
                subtitle={`${stats.images.total} total in bucket`}
                icon="🖼️"
                color="blue"
              />
              <StatCard
                title="Active Users"
                value={stats.activeUsers}
                subtitle="Users with quota records today"
                icon="👥"
                color="purple"
              />
            </div>

            {/* Generated At */}
            <p className="mt-6 text-xs text-app-text-secondary text-center">
              Generated at {new Date(stats.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
