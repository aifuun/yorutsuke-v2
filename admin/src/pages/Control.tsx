/**
 * Admin Control Page - Emergency Stop Toggle
 */

import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { api, endpoints } from '../api/client';

interface ControlStatus {
  emergencyStop: boolean;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  history: Array<{
    action: string;
    reason: string;
    timestamp: string;
    admin: string;
  }>;
}

export function Control() {
  const [status, setStatus] = useState<ControlStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState<'activate' | 'deactivate' | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<ControlStatus>(endpoints.control);
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (action: 'activate' | 'deactivate') => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(endpoints.control, { action, reason });
      setReason('');
      setShowConfirm(null);
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle emergency stop');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Emergency Control</h1>
            <p className="text-app-text-secondary mt-1">
              Toggle emergency stop to halt all operations
            </p>
          </div>
          <button
            onClick={fetchStatus}
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

        {/* Main Control Panel */}
        {status && (
          <div className="max-w-2xl">
            {/* Current Status */}
            <div className={`p-6 rounded-lg border-2 mb-6 ${
              status.emergencyStop
                ? 'bg-red-900/30 border-red-500'
                : 'bg-green-900/30 border-green-500'
            }`}>
              <div className="flex items-center gap-4">
                <span className="text-4xl">
                  {status.emergencyStop ? '🚨' : '✅'}
                </span>
                <div>
                  <h2 className="text-xl font-bold">
                    Emergency Stop: {status.emergencyStop ? 'ACTIVE' : 'OFF'}
                  </h2>
                  {status.reason && (
                    <p className="text-app-text-secondary mt-1">
                      Reason: {status.reason}
                    </p>
                  )}
                  {status.updatedAt && (
                    <p className="text-sm text-app-text-secondary mt-1">
                      Last updated: {new Date(status.updatedAt).toLocaleString()}
                      {status.updatedBy && ` by ${status.updatedBy}`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Button */}
            {!showConfirm && (
              <button
                onClick={() => setShowConfirm(status.emergencyStop ? 'deactivate' : 'activate')}
                className={`w-full py-4 text-lg font-bold rounded-lg transition-colors ${
                  status.emergencyStop
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {status.emergencyStop ? 'Deactivate Emergency Stop' : 'Activate Emergency Stop'}
              </button>
            )}

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="bg-app-surface border border-app-border rounded-lg p-6">
                <h3 className="text-lg font-bold mb-4">
                  Confirm {showConfirm === 'activate' ? 'Activation' : 'Deactivation'}
                </h3>

                <div className="mb-4">
                  <label className="block text-sm text-app-text-secondary mb-2">
                    Reason (required)
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for this action..."
                    className="w-full px-4 py-2 bg-app-bg border border-app-border rounded-lg
                               text-app-text placeholder-app-text-secondary
                               focus:outline-none focus:border-app-accent"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => handleToggle(showConfirm)}
                    disabled={isSubmitting || !reason.trim()}
                    className={`flex-1 py-3 font-bold rounded-lg transition-colors disabled:opacity-50 ${
                      showConfirm === 'activate'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirm(null);
                      setReason('');
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-3 font-bold bg-app-border rounded-lg
                               hover:bg-app-text-secondary/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="mt-6 p-4 bg-app-surface border border-app-border rounded-lg">
              <h3 className="text-sm font-medium text-app-text mb-2">When Emergency Stop is Active:</h3>
              <ul className="text-sm text-app-text-secondary space-y-1 list-disc list-inside">
                <li>All API endpoints return 503 Service Unavailable</li>
                <li>Batch processing is halted</li>
                <li>New uploads are rejected</li>
                <li>Users see maintenance message in the app</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
