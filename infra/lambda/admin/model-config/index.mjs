import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const CONTROL_TABLE_NAME = process.env.CONTROL_TABLE_NAME;

// Default model configuration
const DEFAULT_CONFIG = {
  modelId: "us.amazon.nova-lite-v1:0",
  tokenCode: "nova-lite",
  provider: "aws-bedrock",
  displayName: "Nova Lite",
  description: "Default model (low cost, recommended)",
  config: {},
};

/**
 * Model Config Lambda
 *
 * Endpoints:
 * - GET  /model/config - Read current model configuration
 * - POST /model/config - Update model configuration
 *
 * Storage: DynamoDB control table (key: "modelConfig")
 */
export async function handler(event) {
  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      return await handleGet();
    }

    if (method === 'POST') {
      return await handlePost(event);
    }

    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('MODEL_CONFIG_ERROR', { error: error.message, method });
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error', message: error.message }),
    };
  }
}

/**
 * GET /model/config - Read current configuration
 */
async function handleGet() {
  const response = await ddb.send(new GetItemCommand({
    TableName: CONTROL_TABLE_NAME,
    Key: marshall({ key: 'modelConfig' }),
  }));

  // Return default config if not set
  if (!response.Item) {
    console.log('MODEL_CONFIG_DEFAULT', { config: DEFAULT_CONFIG });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(DEFAULT_CONFIG),
    };
  }

  const config = unmarshall(response.Item).value;
  console.log('MODEL_CONFIG_READ', { modelId: config.modelId, tokenCode: config.tokenCode });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(config),
  };
}

/**
 * POST /model/config - Update configuration
 */
async function handlePost(event) {
  const body = JSON.parse(event.body);
  const userSub = event.requestContext?.authorizer?.claims?.sub || 'unknown';

  // Validate required fields
  if (!body.modelId || !body.tokenCode || !body.provider) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Missing required fields',
        required: ['modelId', 'tokenCode', 'provider']
      }),
    };
  }

  // Build config with metadata
  const config = {
    modelId: body.modelId,
    tokenCode: body.tokenCode,
    provider: body.provider,
    displayName: body.displayName || body.tokenCode,
    description: body.description || '',
    config: body.config || {},
    updatedAt: new Date().toISOString(),
    updatedBy: userSub,
  };

  // Write to DynamoDB
  await ddb.send(new PutItemCommand({
    TableName: CONTROL_TABLE_NAME,
    Item: marshall({
      key: 'modelConfig',
      value: config,
    }),
  }));

  console.log('MODEL_CONFIG_UPDATED', {
    modelId: config.modelId,
    tokenCode: config.tokenCode,
    updatedBy: userSub,
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ success: true, config }),
  };
}

// Force deploy: 2026-01-17 (dynamic model configuration)
