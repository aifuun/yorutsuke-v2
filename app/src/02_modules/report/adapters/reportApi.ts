// Pillar B: Airlock - validate all API responses
import type { UserId } from '../../../00_kernel/types';
import type { DailySummary, Transaction } from '../../../01_domains/transaction';

const CONFIG_URL = import.meta.env.VITE_LAMBDA_CONFIG_URL;

interface MorningReportResponse {
  date: string;
  summary: DailySummary;
  transactions: Transaction[];
  generatedAt: string;
}

export async function fetchMorningReport(
  userId: UserId,
  date: string,
): Promise<MorningReportResponse> {
  const response = await fetch(`${CONFIG_URL}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, date }),
  });

  if (!response.ok) {
    throw new Error(`Report fetch failed: ${response.status}`);
  }

  const data = await response.json();

  // Pillar B: Validate response shape
  if (!data.date || !data.summary || !Array.isArray(data.transactions)) {
    throw new Error('Invalid report response');
  }

  return data as MorningReportResponse;
}

export async function fetchReportHistory(
  userId: UserId,
  limit: number = 7,
): Promise<MorningReportResponse[]> {
  const response = await fetch(`${CONFIG_URL}/report/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, limit }),
  });

  if (!response.ok) {
    throw new Error(`History fetch failed: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.reports)) {
    throw new Error('Invalid history response');
  }

  return data.reports;
}
