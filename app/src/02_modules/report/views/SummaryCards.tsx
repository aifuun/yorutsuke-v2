// Summary cards component
import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react';
import type { DailySummary } from '../../../01_domains/transaction';
import { useTranslation } from '../../../i18n';
import { Icon } from '../../../components';

interface SummaryCardsProps {
  summary: DailySummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { t } = useTranslation();
  const { totalIncome, totalExpense, netProfit, transactionCount } = summary;

  return (
    <div className="summary-grid">
      <div className="premium-card stat stat--income">
        <div className="stat__icon">
          <Icon icon={TrendingUp} size="lg" aria-label={t('report.income')} />
        </div>
        <div className="stat__content">
          <p className="stat__label">{t('report.income')}</p>
          <p className="stat__value">¥{totalIncome.toLocaleString()}</p>
        </div>
      </div>
      <div className="premium-card stat stat--expense">
        <div className="stat__icon">
          <Icon icon={TrendingDown} size="lg" aria-label={t('report.expense')} />
        </div>
        <div className="stat__content">
          <p className="stat__label">{t('report.expense')}</p>
          <p className="stat__value">¥{totalExpense.toLocaleString()}</p>
        </div>
      </div>
      <div className={`premium-card stat ${netProfit >= 0 ? 'stat--income' : 'stat--expense'}`}>
        <div className="stat__icon">
          <Icon 
            icon={netProfit >= 0 ? DollarSign : TrendingDown} 
            size="lg" 
            aria-label={t('report.netProfit')}
          />
        </div>
        <div className="stat__content">
          <p className="stat__label">{t('report.netProfit')}</p>
          <p className="stat__value">¥{netProfit.toLocaleString()}</p>
        </div>
      </div>
      <div className="premium-card stat">
        <div className="stat__icon">
          <Icon icon={Receipt} size="lg" aria-label={t('report.transactions')} />
        </div>
        <div className="stat__content">
          <p className="stat__label">{t('report.transactions')}</p>
          <p className="stat__value">{transactionCount}</p>
        </div>
      </div>
    </div>
  );
}
