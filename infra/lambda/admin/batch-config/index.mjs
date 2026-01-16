import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { logger, EVENTS, initContext } from "/opt/nodejs/shared/logger.mjs";
import { BatchConfigSchema } from "/opt/nodejs/shared/schemas.mjs";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTROL_TABLE = process.env.CONTROL_TABLE_NAME;

const DEFAULT_CONFIG = {
    processingMode: 'instant',
    imageThreshold: 100,
    timeoutMinutes: 120,
    primaryModelId: 'us.amazon.nova-lite-v1:0',
    enableComparison: false,
    comparisonModels: [],
    azureConfig: null,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
};

export const handler = async (event) => {
    const ctx = initContext(event);
    logger.info(EVENTS.API_REQUEST_RECEIVED, {
        method: event.requestContext?.http?.method,
        path: event.requestContext?.http?.path
    });

    const method = event.requestContext?.http?.method || event.httpMethod;

    try {
        if (method === 'GET') {
            return await getConfig();
        } else if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';
            return await updateConfig(body, userId);
        } else {
            return response(405, { error: 'Method not allowed' });
        }
    } catch (error) {
        logger.error(EVENTS.UNEXPECTED_ERROR, { error: error.message, stack: error.stack });
        return response(500, { error: 'Internal server error' });
    }
};

async function getConfig() {
    const result = await ddb.send(new GetCommand({
        TableName: CONTROL_TABLE,
        Key: { key: 'batch_config' },
    }));

    if (!result.Item) {
        logger.info("Initializing default config in ControlTable");
        const config = { ...DEFAULT_CONFIG, key: 'batch_config' };
        await ddb.send(new PutCommand({
            TableName: CONTROL_TABLE,
            Item: config,
        }));
        const { key, ...rest } = config;
        return response(200, rest);
    }

    const { key, ...config } = result.Item;
    return response(200, config);
}

async function updateConfig(body, userId) {
    // 1. Get current config for merging
    const currentResult = await ddb.send(new GetCommand({
        TableName: CONTROL_TABLE,
        Key: { key: 'batch_config' },
    }));
    const current = currentResult.Item || { ...DEFAULT_CONFIG, key: 'batch_config' };

    // 2. Prepare update
    let updateData = {
        ...current,
        ...body,
        updatedAt: new Date().toISOString(),
        updatedBy: userId,
    };

    // 2.5 Backward compatibility: migrate old modelId to primaryModelId
    // @ai-intent: Support old field names during migration period (1 sprint)
    if (updateData.modelId && !updateData.primaryModelId) {
        updateData.primaryModelId = updateData.modelId;
        logger.info("MIGRATED_MODEL_ID_TO_PRIMARY", { userId });
    }

    // 3. Validate with Zod (Pillar B: Airlock)
    try {
        const validated = BatchConfigSchema.parse(updateData);

        // 4. Save to DynamoDB
        await ddb.send(new PutCommand({
            TableName: CONTROL_TABLE,
            Item: {
                key: 'batch_config',
                ...validated,
            },
        }));

        logger.info("Config updated successfully", { userId, mode: validated.processingMode });
        return response(200, validated);
    } catch (zodError) {
        logger.warn(EVENTS.AIRLOCK_BREACH, { error: zodError.errors });
        return response(400, { errors: zodError.errors });
    }
}

function response(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify(body),
    };
}
