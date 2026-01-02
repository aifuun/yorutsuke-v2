/**
 * Stat Card Component
 */

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorClasses = {
  blue: 'text-blue-400 bg-blue-900/20 border-blue-800',
  green: 'text-green-400 bg-green-900/20 border-green-800',
  yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
  red: 'text-red-400 bg-red-900/20 border-red-800',
  purple: 'text-purple-400 bg-purple-900/20 border-purple-800',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
}: StatCardProps) {
  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-app-text-secondary">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-app-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}
