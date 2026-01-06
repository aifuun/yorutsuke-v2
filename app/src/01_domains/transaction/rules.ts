import type { Transaction, TransactionCategory, DailySummary, TransactionFilters } from './types';

// Pure business rules - no side effects

/**
 * Filter transactions based on criteria
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter(t => {
    // Date range filter
    if (filters.dateStart && t.date < filters.dateStart) return false;
    if (filters.dateEnd && t.date > filters.dateEnd) return false;

    // Category filter
    if (filters.category && filters.category !== 'all' && t.category !== filters.category) {
      return false;
    }

    // Type filter
    if (filters.type && filters.type !== 'all' && t.type !== filters.type) {
      return false;
    }

    return true;
  });
}

export function calculateNetProfit(income: number, expense: number): number {
  return income - expense;
}

export function categorizeByType(transactions: Transaction[]): {
  income: Transaction[];
  expense: Transaction[];
} {
  return {
    income: transactions.filter(t => t.type === 'income'),
    expense: transactions.filter(t => t.type === 'expense'),
  };
}

export function summarizeByCategory(
  transactions: Transaction[],
): Record<TransactionCategory, number> {
  const summary: Record<TransactionCategory, number> = {
    purchase: 0,
    sale: 0,
    shipping: 0,
    packaging: 0,
    fee: 0,
    other: 0,
  };

  for (const t of transactions) {
    summary[t.category] += t.amount;
  }

  return summary;
}

export function createDailySummary(
  date: string,
  transactions: Transaction[],
): DailySummary {
  const dayTransactions = transactions.filter(t => t.date === date);
  const { income, expense } = categorizeByType(dayTransactions);

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);

  return {
    date,
    totalIncome,
    totalExpense,
    netProfit: calculateNetProfit(totalIncome, totalExpense),
    transactionCount: dayTransactions.length,
    byCategory: summarizeByCategory(dayTransactions),
  };
}

/**
 * Create monthly summary from all transactions
 * Uses current month by default
 */
export function createMonthlySummary(
  transactions: Transaction[],
  yearMonth?: string, // YYYY-MM format
): { income: number; expense: number; net: number; count: number } {
  // Use local date for current month display
  const targetMonth = yearMonth || new Date().toLocaleDateString('sv-SE').slice(0, 7);

  const monthTransactions = transactions.filter(t => t.date.startsWith(targetMonth));
  const { income, expense } = categorizeByType(monthTransactions);

  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);

  return {
    income: totalIncome,
    expense: totalExpense,
    net: totalIncome - totalExpense,
    count: monthTransactions.length,
  };
}

// Validation rules
export function isValidAmount(amount: number): boolean {
  return amount > 0 && Number.isFinite(amount);
}

export function isHighConfidence(confidence: number | null): boolean {
  return confidence !== null && confidence >= 0.8;
}
