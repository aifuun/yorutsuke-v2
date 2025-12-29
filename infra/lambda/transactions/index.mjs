import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TRANSACTIONS_TABLE_NAME;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * CORS headers
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
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

export async function handler(event) {
  // Handle CORS preflight
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "";

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    // Extract transactionId from path: /transactions/{id}
    const pathMatch = path.match(/\/transactions\/([^/]+)/);
    const transactionId = pathMatch ? pathMatch[1] : null;

    // For PUT/DELETE, userId comes from body or query params
    const userId = body.userId || event.queryStringParameters?.userId;

    switch (method) {
      case "POST":
        // POST /transactions - Query transactions
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
