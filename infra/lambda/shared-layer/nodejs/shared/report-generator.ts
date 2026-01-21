/**
 * Diagnostic Report Generator (Phase C)
 * Aggregates local + cloud data into diagnostic report
 */
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { logger } from './logger.js';

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatchLogsClient = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * AWS Clients interface for dependency injection
 */
export interface AwsClients {
  dynamoDb?: DynamoDBClient;
  s3?: S3Client;
  cloudwatch?: CloudWatchLogsClient;
}

/**
 * Logger interface
 */
export interface Logger {
  info: (event: string, data?: Record<string, unknown>) => void;
  debug: (event: string, data?: Record<string, unknown>) => void;
  error: (event: string, data?: Record<string, unknown>) => void;
  warn: (event: string, data?: Record<string, unknown>) => void;
}

/**
 * Generation parameters
 */
export interface GenerateParams {
  userId: string;
  localData: LocalData;
  token: string;
  traceId: string;
}

/**
 * Local diagnostic data structure
 */
export interface LocalData {
  timestamp: string;
  appVersion: string;
  platform: string;
  [key: string]: unknown;
}

/**
 * Cloud data collection result
 */
export interface CloudData {
  transactions: Array<Record<string, unknown>>;
  images: Array<{
    key: string;
    size: number;
    uploadedAt?: string;
    status: string;
  }>;
  logs: Array<{
    timestamp: string;
    message: string;
    level: string;
  }>;
}

/**
 * Merged diagnostic report
 */
export interface DiagnosticReport {
  timestamp: string;
  appVersion: string;
  platform: string;
  localData: LocalData;
  cloudData: CloudData;
  mergedAt: string;
  totalTransactions: number;
  totalImages: number;
  totalLogs: number;
}

/**
 * Generation result
 */
export interface GenerationResult {
  success: boolean;
  reportId: string;
  s3Url: string;
  timestamp: string;
  fileSize: number;
  report: DiagnosticReport;
}

/**
 * DynamoDB AttributeValue (simplified)
 */
type AttributeValue =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { NULL: boolean }
  | { L: AttributeValue[] }
  | { M: Record<string, AttributeValue> };

export class ReportGenerator {
  private dynamoDb: DynamoDBClient;
  private s3: S3Client;
  private cloudwatch: CloudWatchLogsClient;
  private logger: Logger;

  constructor(awsClients: AwsClients | undefined, logger: Logger) {
    this.dynamoDb = awsClients?.dynamoDb || dynamoDbClient;
    this.s3 = awsClients?.s3 || s3Client;
    this.cloudwatch = awsClients?.cloudwatch || cloudwatchLogsClient;
    this.logger = logger;
  }

  async generate({ userId, localData, token, traceId }: GenerateParams): Promise<GenerationResult> {
    if (!userId || userId.trim() === '') {
      throw new Error('userId cannot be empty');
    }
    if (!token || token.trim() === '') {
      throw new Error('token cannot be empty');
    }
    if (!localData) {
      throw new Error('localData is required');
    }

    this.logger.info('DIAGNOSTIC_GENERATION_START', { traceId, userId });

    const startTime = Date.now();

    try {
      const cloudData = await this.collectCloudData(userId, traceId);
      const merged = this.mergeData(localData, cloudData);
      const reportKey = `diagnostics/${userId}/diag-${Date.now()}.json`;
      const fileSize = Buffer.byteLength(JSON.stringify(merged), 'utf8');

      await this.uploadReportToS3(reportKey, merged, traceId);
      const s3Url = await this.generatePresignedUrl(reportKey);

      const executionTimeMs = Date.now() - startTime;
      this.logger.info('DIAGNOSTIC_GENERATION_SUCCESS', {
        traceId,
        reportId: reportKey.split('/').pop()!.replace('.json', ''),
        fileSize,
        executionTimeMs,
      });

      return {
        success: true,
        reportId: reportKey.split('/').pop()!.replace('.json', ''),
        s3Url,
        timestamp: new Date().toISOString(),
        fileSize,
        report: merged,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('DIAGNOSTIC_GENERATION_FAILED', { traceId, error: errorMessage });
      throw error;
    }
  }

  async collectCloudData(userId: string, traceId: string): Promise<CloudData> {
    const [transactions, images, logs] = await Promise.all([
      this.queryUserTransactions(userId, traceId),
      this.queryUserImages(userId, traceId),
      this.queryCloudWatchLogs(userId, traceId),
    ]);
    return { transactions, images, logs };
  }

  async queryUserTransactions(
    userId: string,
    traceId: string
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE || 'yorutsuke-transactions-us-dev',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': { S: userId } },
        Limit: 100,
        ScanIndexForward: false,
      });
      const response = await this.dynamoDb.send(command);
      return !response.Items
        ? []
        : response.Items.map((item) =>
            this.unmarshallItem(item as Record<string, AttributeValue>)
          );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('DYNAMODB_QUERY_FAILED', { traceId, error: errorMessage });
      return [];
    }
  }

  async queryUserImages(userId: string, traceId: string): Promise<CloudData['images']> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: process.env.S3_IMAGES_BUCKET || 'yorutsuke-images-us-dev-696249060859',
        Prefix: `${userId}/`,
        MaxKeys: 100,
      });
      const response = await this.s3.send(command);
      return !response.Contents
        ? []
        : response.Contents.map((obj) => ({
            key: obj.Key!,
            size: obj.Size!,
            uploadedAt: obj.LastModified?.toISOString(),
            status: 'uploaded',
          }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('S3_LIST_FAILED', { traceId, error: errorMessage });
      return [];
    }
  }

  async queryCloudWatchLogs(userId: string, traceId: string): Promise<CloudData['logs']> {
    try {
      const logGroupName =
        process.env.CLOUDWATCH_LOG_GROUP || '/aws/lambda/yorutsuke-instant-processor-us-dev';
      const oneHourAgo = Date.now() - 3600000;

      const command = new GetLogEventsCommand({
        logGroupName,
        logStreamName: `user/${userId}`,
        startTime: oneHourAgo,
        limit: 100,
      });

      try {
        const response = await this.cloudwatch.send(command);
        return !response.events
          ? []
          : response.events.map((event) => ({
              timestamp: new Date(event.timestamp!).toISOString(),
              message: event.message!,
              level: this.extractLogLevel(event.message || ''),
            }));
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'name' in error) {
          if ((error as { name: string }).name === 'ResourceNotFoundException') {
            return [];
          }
        }
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('CLOUDWATCH_QUERY_FAILED', { traceId, error: errorMessage });
      return [];
    }
  }

  mergeData(localData: LocalData, cloudData: CloudData): DiagnosticReport {
    return {
      timestamp: new Date().toISOString(),
      appVersion: localData.appVersion,
      platform: localData.platform,
      localData,
      cloudData: {
        transactions: cloudData.transactions,
        images: cloudData.images,
        logs: cloudData.logs,
      },
      mergedAt: new Date().toISOString(),
      totalTransactions: Array.isArray(cloudData.transactions) ? cloudData.transactions.length : 0,
      totalImages: Array.isArray(cloudData.images) ? cloudData.images.length : 0,
      totalLogs: Array.isArray(cloudData.logs) ? cloudData.logs.length : 0,
    };
  }

  async uploadReportToS3(
    reportKey: string,
    report: DiagnosticReport,
    traceId: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_DIAGNOSTICS_BUCKET || 'yorutsuke-diagnostics-us-dev',
      Key: reportKey,
      Body: JSON.stringify(report),
      ContentType: 'application/json',
      Metadata: {
        'trace-id': traceId,
        'report-type': 'diagnostic',
        'created-at': new Date().toISOString(),
      },
    });
    await this.s3.send(command);
    this.logger.debug('DIAGNOSTIC_REPORT_UPLOADED', { traceId, reportKey });
  }

  async generatePresignedUrl(reportKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_DIAGNOSTICS_BUCKET || 'yorutsuke-diagnostics-us-dev',
      Key: reportKey,
    });
    return await getSignedUrl(this.s3, command, { expiresIn: 604800 });
  }

  unmarshallItem(item: Record<string, AttributeValue>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      if ('S' in value) {
        result[key] = value.S;
      } else if ('N' in value) {
        result[key] = Number(value.N);
      } else if ('BOOL' in value) {
        result[key] = value.BOOL;
      } else if ('NULL' in value) {
        result[key] = null;
      } else if ('L' in value) {
        result[key] = value.L.map((v) => this.unmarshallItem({ item: v }).item);
      } else if ('M' in value) {
        result[key] = this.unmarshallItem(value.M);
      }
    }
    return result;
  }

  extractLogLevel(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes('error')) return 'error';
    if (msg.includes('warn')) return 'warn';
    if (msg.includes('debug')) return 'debug';
    return 'info';
  }
}

export const reportGenerator = new ReportGenerator(
  { dynamoDb: dynamoDbClient, s3: s3Client, cloudwatch: cloudwatchLogsClient },
  logger
);

export default reportGenerator;
