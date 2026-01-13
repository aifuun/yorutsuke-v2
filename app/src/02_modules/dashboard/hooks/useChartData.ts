/**
 * useChartData - Process transaction data for charts
 * @see docs/design/DATA-VIZ.md for specifications
 */
import { useMemo } from 'react';
import type { TrendDataPoint } from '../components/TrendChart';
import type { CategoryDataPoint } from '../components/CategoryChart';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: string; // ISO date string
}

interface ChartDataOptions {
  days?: number;
  maxCategories?: number;
}

interface ChartData {
  trendData: TrendDataPoint[];
  categoryData: {
    income: CategoryDataPoint[];
    expense: CategoryDataPoint[];
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  };
}

/**
 * Format date for chart display (MM/DD)
 */
function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * Get date range for last N days
 */
function getDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Process transactions into chart-ready data
 */
export function useChartData(
  transactions: Transaction[],
  options: ChartDataOptions = {}
): ChartData {
  const { days = 7, maxCategories = 5 } = options;

  return useMemo(() => {
    // Get date range
    const dateRange = getDateRange(days);

    // Initialize daily totals
    const dailyTotals: Record<string, { income: number; expense: number }> = {};
    for (const date of dateRange) {
      dailyTotals[date] = { income: 0, expense: 0 };
    }

    // Initialize category totals
    const categoryTotals: {
      income: Record<string, number>;
      expense: Record<string, number>;
    } = { income: {}, expense: {} };

    // Process transactions
    for (const tx of transactions) {
      const txDate = tx.date.split('T')[0]; // Extract date part

      // Add to daily totals (if in range)
      if (dailyTotals[txDate]) {
        if (tx.type === 'income') {
          dailyTotals[txDate].income += tx.amount;
        } else {
          dailyTotals[txDate].expense += tx.amount;
        }
      }

      // Add to category totals
      const catTotals = categoryTotals[tx.type];
      catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    }

    // Convert to trend data
    const trendData: TrendDataPoint[] = dateRange.map((date) => ({
      date: formatChartDate(date),
      income: dailyTotals[date].income,
      expense: dailyTotals[date].expense,
      label: date,
    }));

    // Convert to category data (sorted by amount, descending)
    const incomeCategoryData: CategoryDataPoint[] = Object.entries(categoryTotals.income)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, maxCategories);

    const expenseCategoryData: CategoryDataPoint[] = Object.entries(categoryTotals.expense)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, maxCategories);

    // Calculate summary
    const totalIncome = Object.values(dailyTotals).reduce((sum, d) => sum + d.income, 0);
    const totalExpense = Object.values(dailyTotals).reduce((sum, d) => sum + d.expense, 0);

    return {
      trendData,
      categoryData: {
        income: incomeCategoryData,
        expense: expenseCategoryData,
      },
      summary: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
      },
    };
  }, [transactions, days, maxCategories]);
}

/**
 * Generate mock data for testing/preview
 */
export function useMockChartData(days: number = 7): ChartData {
  return useMemo(() => {
    const dateRange = getDateRange(days);

    const trendData: TrendDataPoint[] = dateRange.map((date) => ({
      date: formatChartDate(date),
      income: Math.floor(Math.random() * 20000) + 5000,
      expense: Math.floor(Math.random() * 15000) + 3000,
      label: date,
    }));

    const expenseCategories = ['食費', '交通費', '日用品', '娯楽', '光熱費', '通信費', '医療費'];
    const incomeCategories = ['売上', '給与', '副業', '投資', 'その他'];

    const expenseCategoryData: CategoryDataPoint[] = expenseCategories
      .slice(0, 5)
      .map((category) => ({
        category,
        amount: Math.floor(Math.random() * 50000) + 10000,
      }))
      .sort((a, b) => b.amount - a.amount);

    const incomeCategoryData: CategoryDataPoint[] = incomeCategories
      .slice(0, 5)
      .map((category) => ({
        category,
        amount: Math.floor(Math.random() * 80000) + 20000,
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalIncome = trendData.reduce((sum, d) => sum + d.income, 0);
    const totalExpense = trendData.reduce((sum, d) => sum + d.expense, 0);

    return {
      trendData,
      categoryData: {
        income: incomeCategoryData,
        expense: expenseCategoryData,
      },
      summary: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
      },
    };
  }, [days]);
}
