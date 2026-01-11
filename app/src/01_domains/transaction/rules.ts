import type { Transaction, TransactionCategory, DailySummary, DailySummaryBreakdown, TransactionFilters } from './types';

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
 * Create daily summary with confirmed/unconfirmed breakdown
 * Used for Dashboard daily view with reactive updates
 */
export function createDailySummaryWithBreakdown(
  date: string,
  transactions: Transaction[],
): DailySummaryBreakdown {
  const dayTransactions = transactions.filter(t => t.date === date);
  const confirmed = dayTransactions.filter(t => t.confirmedAt !== null);
  const unconfirmed = dayTransactions.filter(t => t.confirmedAt === null);

  const { income: confIncome, expense: confExpense } = categorizeByType(confirmed);
  const { income: unconfIncome, expense: unconfExpense } = categorizeByType(unconfirmed);

  const confirmedIncomeTotal = confIncome.reduce((sum, t) => sum + t.amount, 0);
  const confirmedExpenseTotal = confExpense.reduce((sum, t) => sum + t.amount, 0);
  const unconfirmedIncomeTotal = unconfIncome.reduce((sum, t) => sum + t.amount, 0);
  const unconfirmedExpenseTotal = unconfExpense.reduce((sum, t) => sum + t.amount, 0);

  return {
    date,
    totalIncome: confirmedIncomeTotal + unconfirmedIncomeTotal,
    totalExpense: confirmedExpenseTotal + unconfirmedExpenseTotal,
    confirmedIncome: confirmedIncomeTotal,
    confirmedExpense: confirmedExpenseTotal,
    unconfirmedIncome: unconfirmedIncomeTotal,
    unconfirmedExpense: unconfirmedExpenseTotal,
    count: dayTransactions.length,
    confirmedCount: confirmed.length,
    unconfirmedCount: unconfirmed.length,
  };
}

/**
 * Create weekly summary for trend comparison
 * Calculates net profit for a week starting from startDate
 */
export function createWeeklySummary(
  startDate: string, // YYYY-MM-DD (Monday of the week)
  transactions: Transaction[],
): { net: number; income: number; expense: number; count: number } {
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + 7); // 7 days later

  const weekTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= start && txDate < end;
  });

  const { income, expense } = categorizeByType(weekTransactions);
  const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = expense.reduce((sum, t) => sum + t.amount, 0);

  return {
    net: totalIncome - totalExpense,
    income: totalIncome,
    expense: totalExpense,
    count: weekTransactions.length,
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
