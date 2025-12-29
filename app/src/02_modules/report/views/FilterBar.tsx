// Filter bar for transactions
import type { TransactionFilters, TransactionCategory, TransactionType } from '../../../01_domains/transaction';
import { useTranslation } from '../../../i18n';

interface FilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  onClear: () => void;
}

const CATEGORIES: Array<TransactionCategory | 'all'> = [
  'all', 'purchase', 'sale', 'shipping', 'packaging', 'fee', 'other'
];

const TYPES: Array<TransactionType | 'all'> = ['all', 'income', 'expense'];

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const { t } = useTranslation();

  const hasFilters = filters.dateStart || filters.dateEnd ||
    (filters.category && filters.category !== 'all') ||
    (filters.type && filters.type !== 'all');

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label>{t('filter.dateRange')}</label>
          <div className="date-inputs">
            <input
              type="date"
              value={filters.dateStart || ''}
              onChange={(e) => onChange({ ...filters, dateStart: e.target.value || undefined })}
              placeholder={t('filter.startDate')}
            />
            <span className="date-separator">~</span>
            <input
              type="date"
              value={filters.dateEnd || ''}
              onChange={(e) => onChange({ ...filters, dateEnd: e.target.value || undefined })}
              placeholder={t('filter.endDate')}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>{t('filter.category')}</label>
          <select
            value={filters.category || 'all'}
            onChange={(e) => onChange({
              ...filters,
              category: e.target.value as TransactionCategory | 'all'
            })}
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {t(`category.${cat}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>{t('filter.type')}</label>
          <select
            value={filters.type || 'all'}
            onChange={(e) => onChange({
              ...filters,
              type: e.target.value as TransactionType | 'all'
            })}
          >
            {TYPES.map(type => (
              <option key={type} value={type}>
                {t(`type.${type}`)}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn-clear-filters"
            onClick={onClear}
          >
            {t('filter.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
