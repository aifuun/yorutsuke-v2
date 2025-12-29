// Summary cards component
import type { DailySummary } from '../../../01_domains/transaction';
import { useTranslation } from '../../../i18n';

interface SummaryCardsProps {
  summary: DailySummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { t } = useTranslation();
  const { totalIncome, totalExpense, netProfit, transactionCount } = summary;

  return (
    <div className="summary-grid">
      <div className="summary-card income">
        <span className="card-label">{t('report.income')}</span>
        <span className="card-value">¥{totalIncome.toLocaleString()}</span>
      </div>
      <div className="summary-card expense">
        <span className="card-label">{t('report.expense')}</span>
        <span className="card-value">¥{totalExpense.toLocaleString()}</span>
      </div>
      <div className="summary-card net">
        <span className="card-label">{t('report.netProfit')}</span>
        <span className={`card-value ${netProfit >= 0 ? 'positive' : 'negative'}`}>
          ¥{netProfit.toLocaleString()}
        </span>
      </div>
      <div className="summary-card count">
        <span className="card-label">{t('report.transactions')}</span>
        <span className="card-value">{transactionCount}</span>
      </div>
    </div>
  );
}
