// Category breakdown chart component
import type { TransactionCategory } from '../../../01_domains/transaction';

interface CategoryBreakdownProps {
  byCategory: Record<TransactionCategory, number>;
}

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  purchase: '#4A90D9',
  sale: '#22C55E',
  shipping: '#F59E0B',
  packaging: '#8B5CF6',
  fee: '#EF4444',
  other: '#6B7280',
};

export function CategoryBreakdown({ byCategory }: CategoryBreakdownProps) {
  const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0);

  if (total === 0) return null;

  const entries = Object.entries(byCategory)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="category-breakdown">
      <h3>By Category</h3>
      <div className="category-bars">
        {entries.map(([category, amount]) => {
          const percentage = (amount / total) * 100;
          return (
            <div key={category} className="category-row">
              <div className="category-info">
                <span
                  className="category-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[category as TransactionCategory] }}
                />
                <span className="category-label">{category}</span>
              </div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: CATEGORY_COLORS[category as TransactionCategory],
                  }}
                />
              </div>
              <span className="category-amount">¥{amount.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
