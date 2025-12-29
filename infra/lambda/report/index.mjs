import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const DEFAULT_HISTORY_LIMIT = 7;
const MAX_HISTORY_LIMIT = 30;

/**
 * CORS headers
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Create response with CORS headers
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders },
    body: JSON.stringify(body),
  };
}

/**
 * Query transactions for a specific date
 */
async function queryTransactionsForDate(userId, date) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDate",
    KeyConditionExpression: "userId = :userId AND #date = :date",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: {
      ":userId": { S: userId },
      ":date": { S: date },
    },
  };

  const result = await ddb.send(new QueryCommand(params));
  return (result.Items || []).map((item) => unmarshall(item));
}

/**
 * Query transactions for a date range
 */
async function queryTransactionsForRange(userId, startDate, endDate) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDate",
    KeyConditionExpression: "userId = :userId AND #date BETWEEN :startDate AND :endDate",
    ExpressionAttributeNames: { "#date": "date" },
    ExpressionAttributeValues: {
      ":userId": { S: userId },
      ":startDate": { S: startDate },
      ":endDate": { S: endDate },
    },
    ScanIndexForward: false, // Newest first
  };

  const result = await ddb.send(new QueryCommand(params));
  return (result.Items || []).map((item) => unmarshall(item));
}

/**
 * Calculate summary from transactions
 */
function calculateSummary(transactions) {
  const summary = {
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    transactionCount: transactions.length,
    byCategory: {},
  };

  for (const tx of transactions) {
    const amount = tx.amount || 0;
    const category = tx.category || "other";

    if (tx.type === "income" || amount > 0) {
      summary.totalIncome += Math.abs(amount);
    } else {
      summary.totalExpense += Math.abs(amount);
    }

    // Aggregate by category
    if (!summary.byCategory[category]) {
      summary.byCategory[category] = 0;
    }
    summary.byCategory[category] += amount;
  }

  summary.netProfit = summary.totalIncome - summary.totalExpense;

  return summary;
}

/**
 * Generate report for a specific date
 * POST /report
 */
async function getReport(body) {
  const { userId, date } = body;

  if (!userId) {
    return response(400, { error: "MISSING_USER_ID", message: "userId is required" });
  }

  if (!date) {
    return response(400, { error: "MISSING_DATE", message: "date is required" });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return response(400, { error: "INVALID_DATE", message: "date must be YYYY-MM-DD format" });
  }

  try {
    const transactions = await queryTransactionsForDate(userId, date);
    const summary = calculateSummary(transactions);

    return response(200, {
      date,
      summary,
      transactions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Report error:", error);
    return response(500, { error: "REPORT_FAILED", message: "Failed to generate report" });
  }
}

/**
 * Get report history for recent days
 * POST /report/history
 */
async function getReportHistory(body) {
  const { userId, limit = DEFAULT_HISTORY_LIMIT } = body;

  if (!userId) {
    return response(400, { error: "MISSING_USER_ID", message: "userId is required" });
  }

  const historyLimit = Math.min(Math.max(1, limit), MAX_HISTORY_LIMIT);

  try {
    // Get dates for the last N days
    const dates = [];
    const today = new Date();
    for (let i = 0; i < historyLimit; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().slice(0, 10));
    }

    const startDate = dates[dates.length - 1];
    const endDate = dates[0];

    // Query all transactions in the date range
    const allTransactions = await queryTransactionsForRange(userId, startDate, endDate);

    // Group transactions by date
    const transactionsByDate = {};
    for (const tx of allTransactions) {
      const txDate = tx.date;
      if (!transactionsByDate[txDate]) {
        transactionsByDate[txDate] = [];
      }
      transactionsByDate[txDate].push(tx);
    }

    // Generate reports for each date
    const reports = dates.map((date) => {
      const transactions = transactionsByDate[date] || [];
      const summary = calculateSummary(transactions);
      return {
        date,
        summary,
        transactions,
        generatedAt: new Date().toISOString(),
      };
    });

    return response(200, { reports });
  } catch (error) {
    console.error("History error:", error);
    return response(500, { error: "HISTORY_FAILED", message: "Failed to get report history" });
  }
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const path = event.rawPath || event.path || "";

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    // Route based on path
    if (path.endsWith("/history")) {
      return await getReportHistory(body);
    } else {
      return await getReport(body);
    }
  } catch (error) {
    console.error("Handler error:", error);
    return response(500, { error: "INTERNAL_ERROR", message: "Internal server error" });
  }
}
