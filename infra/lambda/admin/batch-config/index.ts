import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTROL_TABLE = process.env.CONTROL_TABLE_NAME!;

interface BatchConfig {
    processingMode: 'instant' | 'batch' | 'hybrid';
    imageThreshold: number;
    timeoutMinutes: number;
    modelId: string;
    updatedAt: string;
    updatedBy: string;
}

const DEFAULT_CONFIG: BatchConfig = {
    processingMode: 'instant',
    imageThreshold: 100,
    timeoutMinutes: 120,
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
};

export const handler = async (event: any) => {
    console.log('Batch Config API:', JSON.stringify(event, null, 2));

    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.requestContext?.http?.path || event.path;

    try {
        if (method === 'GET') {
            return await getConfig();
        } else if (method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            return await updateConfig(body, event.requestContext?.authorizer?.claims?.sub);
        } else {
            return {
                statusCode: 405,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Method not allowed' }),
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: String(error) }),
        };
    }
};

async function getConfig() {
    const result = await ddbDoc.send(new GetCommand({
        TableName: CONTROL_TABLE,
        Key: { key: 'batch_config' },
    }));

    const config = result.Item || DEFAULT_CONFIG;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    };
}

async function updateConfig(body: Partial<BatchConfig>, userId?: string) {
    // Validation
    const errors: string[] = [];

    if (body.processingMode && !['instant', 'batch', 'hybrid'].includes(body.processingMode)) {
        errors.push('processingMode must be instant, batch, or hybrid');
    }

    if (body.imageThreshold !== undefined) {
        if (body.imageThreshold < 100) {
            errors.push('imageThreshold must be >= 100 (AWS Bedrock Batch requirement)');
        }
        if (body.imageThreshold > 500) {
            errors.push('imageThreshold must be <= 500');
        }
    }

    if (body.timeoutMinutes !== undefined) {
        if (body.timeoutMinutes < 30 || body.timeoutMinutes > 480) {
            errors.push('timeoutMinutes must be between 30 and 480');
        }
    }

    if (errors.length > 0) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ errors }),
        };
    }

    // Get current config
    const current = await ddbDoc.send(new GetCommand({
        TableName: CONTROL_TABLE,
        Key: { key: 'batch_config' },
    }));

    const updatedConfig: BatchConfig = {
        ...(current.Item as BatchConfig || DEFAULT_CONFIG),
        ...body,
        updatedAt: new Date().toISOString(),
        updatedBy: userId || 'unknown',
    };

    // Save to DynamoDB
    await ddbDoc.send(new PutCommand({
        TableName: CONTROL_TABLE,
        Item: {
            key: 'batch_config',
            ...updatedConfig,
        },
    }));

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
    };
}
