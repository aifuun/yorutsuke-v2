import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * CORS headers (Issue #86: Added GET method for pull sync)
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
 * Encode cursor for pagination
 */
function encodeCursor(lastEvaluatedKey) {
  if (!lastEvaluatedKey) return null;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
}

/**
 * Decode cursor for pagination
 */
function decodeCursor(cursor) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
  } catch {
    return undefined;
  }
}

/**
 * Query transactions with filters
 * POST /transactions
 */
async function queryTransactions(body) {
  const {
    userId,
    startDate,
    endDate,
    status = "all",
    limit = DEFAULT_LIMIT,
    cursor,
  } = body;

  if (!userId) {
    return response(400, { error: "MISSING_USER_ID", message: "userId is required" });
  }

  const queryLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Build query parameters
  const params = {
    TableName: TABLE_NAME,
    IndexName: "byDate",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId },
    },
    Limit: queryLimit,
    ScanIndexForward: false, // Newest first
  };

  // Add date range filter
  if (startDate && endDate) {
    params.KeyConditionExpression += " AND #date BETWEEN :startDate AND :endDate";
    params.ExpressionAttributeNames = { "#date": "date" };
    params.ExpressionAttributeValues[":startDate"] = { S: startDate };
    params.ExpressionAttributeValues[":endDate"] = { S: endDate };
  } else if (startDate) {
    params.KeyConditionExpression += " AND #date >= :startDate";
    params.ExpressionAttributeNames = { "#date": "date" };
    params.ExpressionAttributeValues[":startDate"] = { S: startDate };
  } else if (endDate) {
    params.KeyConditionExpression += " AND #date <= :endDate";
    params.ExpressionAttributeNames = { "#date": "date" };
    params.ExpressionAttributeValues[":endDate"] = { S: endDate };
  }

  // Add status filter
  if (status !== "all") {
    params.FilterExpression =
      status === "confirmed"
        ? "attribute_exists(confirmedAt)"
        : "attribute_not_exists(confirmedAt)";
  }

  // Add pagination cursor
  const exclusiveStartKey = decodeCursor(cursor);
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }

  try {
    const result = await ddb.send(new QueryCommand(params));

    const transactions = (result.Items || []).map((item) => unmarshall(item));
    const nextCursor = encodeCursor(result.LastEvaluatedKey);

    return response(200, { transactions, nextCursor });
  } catch (error) {
    console.error("Query error:", error);
    return response(500, { error: "QUERY_FAILED", message: "Failed to query transactions" });
  }
}

/**
 * Update a transaction
 * PUT /transactions/{id}
 */
async function updateTransaction(userId, transactionId, body, expectedVersion) {
  if (!userId || !transactionId) {
    return response(400, { error: "MISSING_PARAMS", message: "userId and transactionId required" });
  }

  // Build update expression
  const updateFields = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = ["amount", "category", "description", "merchant", "date", "confirmedAt"];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = marshall({ v: body[field] }).v;
    }
  }

  if (updateFields.length === 0) {
    return response(400, { error: "NO_UPDATES", message: "No fields to update" });
  }

  // Add updatedAt and increment version
  updateFields.push("#updatedAt = :updatedAt");
  updateFields.push("#version = #version + :one");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeNames["#version"] = "version";
  expressionAttributeValues[":updatedAt"] = { S: new Date().toISOString() };
  expressionAttributeValues[":one"] = { N: "1" };

  const params = {
    TableName: TABLE_NAME,
    Key: {
      userId: { S: userId },
      transactionId: { S: transactionId },
    },
    UpdateExpression: `SET ${updateFields.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  // Optimistic locking (Pillar F)
  if (expectedVersion !== undefined) {
    params.ConditionExpression = "#version = :expectedVersion";
    expressionAttributeValues[":expectedVersion"] = { N: String(expectedVersion) };
  }

  try {
    const result = await ddb.send(new UpdateItemCommand(params));
    const transaction = unmarshall(result.Attributes);

    return response(200, { transaction });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return response(409, { error: "VERSION_CONFLICT", message: "Transaction was modified by another request" });
    }
    console.error("Update error:", error);
    return response(500, { error: "UPDATE_FAILED", message: "Failed to update transaction" });
  }
}

/**
 * Delete a transaction
 * DELETE /transactions/{id}
 */
async function deleteTransaction(userId, transactionId) {
  if (!userId || !transactionId) {
    return response(400, { error: "MISSING_PARAMS", message: "userId and transactionId required" });
  }

  try {
    await ddb.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          transactionId: { S: transactionId },
        },
      })
    );

    return response(200, { success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return response(500, { error: "DELETE_FAILED", message: "Failed to delete transaction" });
  }
}

/**
 * Fetch all transactions for a user (Issue #86 - Pull Sync)
 * GET /transactions?userId=xxx&startDate=xxx&endDate=xxx
 */
async function fetchAllTransactions(userId, startDate, endDate) {
  if (!userId) {
    return response(400, { error: "MISSING_USER_ID", message: "userId is required" });
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: "byDate",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
      },
      ScanIndexForward: false, // Newest first
    };

    // Add date range filter if provided
    if (startDate && endDate) {
      params.KeyConditionExpression += " AND #date BETWEEN :startDate AND :endDate";
      params.ExpressionAttributeNames = { "#date": "date" };
      params.ExpressionAttributeValues[":startDate"] = { S: startDate };
      params.ExpressionAttributeValues[":endDate"] = { S: endDate };
    } else if (startDate) {
      params.KeyConditionExpression += " AND #date >= :startDate";
      params.ExpressionAttributeNames = { "#date": "date" };
      params.ExpressionAttributeValues[":startDate"] = { S: startDate };
    } else if (endDate) {
      params.KeyConditionExpression += " AND #date <= :endDate";
      params.ExpressionAttributeNames = { "#date": "date" };
      params.ExpressionAttributeValues[":endDate"] = { S: endDate };
    }

    // Fetch all pages
    const transactions = [];
    let lastEvaluatedKey = undefined;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await ddb.send(new QueryCommand(params));
      transactions.push(...(result.Items || []).map((item) => unmarshall(item)));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return response(200, { transactions });
  } catch (error) {
    console.error("Fetch all transactions error:", error);
    return response(500, { error: "FETCH_FAILED", message: "Failed to fetch transactions" });
  }
}

/**
 * Sync transactions from local to cloud (Issue #86 - Push Sync)
 * POST /transactions/sync
 * Body: { userId, transactions: [...] }
 *
 * Uses PutItem with condition to prevent overwriting newer data (Last-Write-Wins)
 * Pillar Q: Idempotent - safe to retry
 */
async function syncTransactionsFromLocal(body) {
  const { userId, transactions } = body;

  if (!userId || !Array.isArray(transactions) || transactions.length === 0) {
    return response(400, {
      error: "INVALID_REQUEST",
      message: "userId and transactions array required",
    });
  }

  console.log(`[SYNC] Starting sync for user ${userId}, ${transactions.length} transactions`);

  const synced = [];
  const failed = [];

  // Process each transaction individually with optimistic concurrency control
  for (const tx of transactions) {
    try {
      if (!tx.transactionId || !tx.updatedAt) {
        failed.push(tx.transactionId || "unknown");
        continue;
      }

      // PutItem with condition: only write if cloud version is older (Last-Write-Wins)
      const item = marshall({
        userId: tx.userId,
        transactionId: tx.transactionId,
        imageId: tx.imageId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        merchant: tx.merchant || "",
        description: tx.description || "",
        confirmedAt: tx.confirmedAt || null,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        version: tx.version || 1,
      });

      await ddb.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: item,
          // Pillar F: Only overwrite if cloud version is older (or doesn't exist)
          ConditionExpression:
            "attribute_not_exists(transactionId) OR updatedAt < :localUpdatedAt",
          ExpressionAttributeValues: {
            ":localUpdatedAt": { S: tx.updatedAt },
          },
        })
      );

      synced.push(tx.transactionId);
      console.log(`[SYNC] Success: ${tx.transactionId}`);
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        // Cloud version is newer - skip this transaction (not a failure)
        console.log(`[SYNC] Skipped (cloud newer): ${tx.transactionId}`);
        synced.push(tx.transactionId); // Consider it synced (cloud wins)
      } else {
        // Real error - mark as failed
        console.error(`[SYNC] Failed: ${tx.transactionId}`, error);
        failed.push(tx.transactionId);
      }
    }
  }

  console.log(`[SYNC] Complete: ${synced.length} synced, ${failed.length} failed`);

  return response(200, {
    synced: synced.length,
    failed,
  });
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "";

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const queryParams = event.queryStringParameters || {};

    // Route: GET / (Issue #86 - Pull Sync)
    if (method === "GET" && path === "/") {
      const { userId, startDate, endDate } = queryParams;
      return await fetchAllTransactions(userId, startDate, endDate);
    }

    // Route: POST /sync (Issue #86 - Push Sync)
    if (method === "POST" && path === "/sync") {
      return await syncTransactionsFromLocal(body);
    }

    // Extract transactionId from path: /{id}
    const pathMatch = path.match(/^\/([^/]+)$/);
    const transactionId = pathMatch ? pathMatch[1] : null;

    // For PUT/DELETE, userId comes from body or query params
    const userId = body.userId || queryParams.userId;

    switch (method) {
      case "POST":
        // POST /transactions - Query transactions (existing)
        return await queryTransactions(body);

      case "PUT":
        // PUT /transactions/{id} - Update transaction
        return await updateTransaction(userId, transactionId, body, body.expectedVersion);

      case "DELETE":
        // DELETE /transactions/{id} - Delete transaction
        return await deleteTransaction(userId, transactionId);

      default:
        return response(405, { error: "METHOD_NOT_ALLOWED", message: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return response(500, { error: "INTERNAL_ERROR", message: "Internal server error" });
  }
}
