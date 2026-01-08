import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const ddbDoc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE_NAME!;

export const handler = async (event: S3Event) => {
    console.log('Instant Processor Triggered:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // 1. 提取元数据 (uploads/{userId}/{imageId}.webp)
        const keyParts = key.split('/');
        if (keyParts.length < 3) continue;

        const userId = keyParts[1];
        const imageId = keyParts[2].replace('.webp', '');

        console.log(`Processing image ${imageId} for user ${userId}`);

        try {
            // 2. 获取图片内容
            const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const imageBytes = await s3Response.Body?.transformToUint8Array();
            if (!imageBytes) throw new Error('Could not read image body');

            // 3. 准备 Bedrock 调用 (Claude 3 Haiku)
            const prompt = `Extract receipt information into JSON format with the following fields: 
            - merchant: string (English/Japanese)
            - amount: number (numeric only)
            - category: string (one of: Food, Transport, Consumables, Others)
            - date: string (YYYY-MM-DD or ISO format)
            - description: string (summary)

            Return ONLY pure JSON.`;

            const input = {
                modelId: "anthropic.claude-3-haiku-20240307-v1:0",
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 500,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "image",
                                    source: {
                                        type: "base64",
                                        media_type: "image/webp",
                                        data: Buffer.from(imageBytes).toString('base64'),
                                    },
                                },
                                {
                                    type: "text",
                                    text: prompt,
                                },
                            ],
                        },
                    ],
                }),
            };

            const command = new InvokeModelCommand(input);
            const bedrockResponse = await bedrock.send(command);
            const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));

            // 解析 JSON (处理可能带有的 markdown 代码块)
            const textResponse = responseBody.content[0].text;
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            const result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textResponse);

            // 4. 写入 DynamoDB
            const transaction = {
                userId,
                transactionId: `tx_${imageId}`,
                imageId,
                amount: result.amount,
                merchant: result.merchant,
                category: result.category,
                date: result.date,
                description: result.description,
                status: 'unconfirmed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await ddbDoc.send(new PutCommand({
                TableName: TRANSACTIONS_TABLE,
                Item: transaction,
            }));

            console.log(`Successfully processed ${imageId} into transaction tx_${imageId}`);
        } catch (error) {
            console.error(`Error processing ${imageId}:`, error);
            // 注意：这里不 throw 错误，防止 S3 EventBridge 异常重试
        }
    }
};
