/**
 * Admin Control Lambda
 * Emergency stop toggle and status
 */

import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const CONTROL_TABLE = process.env.CONTROL_TABLE_NAME;

/**
 * Get current emergency stop status
 */
async function getStatus() {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: CONTROL_TABLE,
      Key: { key: { S: "global_state" } },
    })
  );

  if (result.Item) {
    return {
      emergencyStop: result.Item.emergency_stop?.BOOL || false,
      reason: result.Item.emergency_reason?.S || null,
      updatedAt: result.Item.updated_at?.S || null,
      updatedBy: result.Item.updated_by?.S || null,
    };
  }

  return {
    emergencyStop: false,
    reason: null,
    updatedAt: null,
    updatedBy: null,
  };
}

/**
 * Get history of emergency stop activations
 */
async function getHistory() {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: CONTROL_TABLE,
        KeyConditionExpression: "#k = :k",
        ExpressionAttributeNames: { "#k": "key" },
        ExpressionAttributeValues: { ":k": { S: "history" } },
        ScanIndexForward: false, // Latest first
        Limit: 10,
      })
    );

    // Note: This requires a different table design with SK for history
    // For now, return empty array
    return [];
  } catch (e) {
    console.error("Error getting history:", e);
    return [];
  }
}

/**
 * Set emergency stop status
 */
async function setStatus(enabled, reason, adminEmail) {
  const now = new Date().toISOString();

  await ddb.send(
    new PutItemCommand({
      TableName: CONTROL_TABLE,
      Item: {
        key: { S: "global_state" },
        emergency_stop: { BOOL: enabled },
        emergency_reason: { S: reason || "" },
        updated_at: { S: now },
        updated_by: { S: adminEmail || "unknown" },
      },
    })
  );

  // Also log to history (using timestamp as sort key)
  await ddb.send(
    new PutItemCommand({
      TableName: CONTROL_TABLE,
      Item: {
        key: { S: `history#${now}` },
        action: { S: enabled ? "activate" : "deactivate" },
        reason: { S: reason || "" },
        timestamp: { S: now },
        admin: { S: adminEmail || "unknown" },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60) }, // 90 days
      },
    })
  );

  return {
    emergencyStop: enabled,
    reason: reason || null,
    updatedAt: now,
    updatedBy: adminEmail || null,
  };
}

export async function handler(event) {
  console.log("Admin control request:", JSON.stringify(event));

  const method = event.httpMethod || event.requestContext?.http?.method;

  try {
    if (method === "GET") {
      // Get current status and history
      const [status, history] = await Promise.all([
        getStatus(),
        getHistory(),
      ]);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ ...status, history }),
      };
    }

    if (method === "POST") {
      // Toggle emergency stop
      const body = JSON.parse(event.body || "{}");
      const { action, reason } = body;

      if (action !== "activate" && action !== "deactivate") {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ error: "Invalid action. Use 'activate' or 'deactivate'" }),
        };
      }

      // Extract admin identity from IAM context
      const adminEmail = event.requestContext?.identity?.userArn || "admin";

      const result = await setStatus(action === "activate", reason, adminEmail);

      console.log(`Emergency stop ${action}d by ${adminEmail}: ${reason}`);

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message: `Emergency stop ${action}d successfully`,
          ...result,
        }),
      };
    }

    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("Error in control handler:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
