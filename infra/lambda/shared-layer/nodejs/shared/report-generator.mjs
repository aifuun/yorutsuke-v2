/**
 * Diagnostic Report Generator (Phase C)
 * Aggregates local + cloud data into diagnostic report
 */
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CloudWatchLogsClient, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { logger } from "./logger.mjs";

const dynamoDbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const cloudwatchLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || "us-east-1" });

export class ReportGenerator {
  constructor(awsClients, logger) {
    this.dynamoDb = awsClients?.dynamoDb || dynamoDbClient;
    this.s3 = awsClients?.s3 || s3Client;
    this.cloudwatch = awsClients?.cloudwatch || cloudwatchLogsClient;
    this.logger = logger;
  }

  async generate({ userId, localData, token, traceId }) {
    if (!userId || userId.trim() === "") {
      throw new Error("userId cannot be empty");
    }
    if (!token || token.trim() === "") {
      throw new Error("token cannot be empty");
    }
    if (!localData) {
      throw new Error("localData is required");
    }

    this.logger.info("DIAGNOSTIC_GENERATION_START", { traceId, userId });

    const startTime = Date.now();

    try {
      const cloudData = await this.collectCloudData(userId, traceId);
      const merged = this.mergeData(localData, cloudData);
      const reportKey = `diagnostics/${userId}/diag-${Date.now()}.json`;
      const fileSize = Buffer.byteLength(JSON.stringify(merged), "utf8");

      await this.uploadReportToS3(reportKey, merged, traceId);
      const s3Url = await this.generatePresignedUrl(reportKey);

      const executionTimeMs = Date.now() - startTime;
      this.logger.info("DIAGNOSTIC_GENERATION_SUCCESS", {
        traceId,
        reportId: reportKey.split("/").pop().replace(".json", ""),
        fileSize,
        executionTimeMs,
      });

      return {
        success: true,
        reportId: reportKey.split("/").pop().replace(".json", ""),
        s3Url,
        timestamp: new Date().toISOString(),
        fileSize,
        report: merged,
      };
    } catch (error) {
      this.logger.error("DIAGNOSTIC_GENERATION_FAILED", { traceId, error: error.message });
      throw error;
    }
  }

  async collectCloudData(userId, traceId) {
    const [transactions, images, logs] = await Promise.all([
      this.queryUserTransactions(userId, traceId),
      this.queryUserImages(userId, traceId),
      this.queryCloudWatchLogs(userId, traceId),
    ]);
    return { transactions, images, logs };
  }

  async queryUserTransactions(userId, traceId) {
    try {
      const command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE || "yorutsuke-transactions-us-dev",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": { S: userId } },
        Limit: 100,
        ScanIndexForward: false,
      });
      const response = await this.dynamoDb.send(command);
      return !response.Items ? [] : response.Items.map((item) => this.unmarshallItem(item));
    } catch (error) {
      this.logger.warn("DYNAMODB_QUERY_FAILED", { traceId, error: error.message });
      return [];
    }
  }

  async queryUserImages(userId, traceId) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: process.env.S3_IMAGES_BUCKET || "yorutsuke-images-us-dev-696249060859",
        Prefix: `${userId}/`,
        MaxKeys: 100,
      });
      const response = await this.s3.send(command);
      return !response.Contents
        ? []
        : response.Contents.map((obj) => ({
            key: obj.Key,
            size: obj.Size,
            uploadedAt: obj.LastModified?.toISOString(),
            status: "uploaded",
          }));
    } catch (error) {
      this.logger.warn("S3_LIST_FAILED", { traceId, error: error.message });
      return [];
    }
  }

  async queryCloudWatchLogs(userId, traceId) {
    try {
      const logGroupName = process.env.CLOUDWATCH_LOG_GROUP || "/aws/lambda/yorutsuke-instant-processor-us-dev";
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
              timestamp: new Date(event.timestamp).toISOString(),
              message: event.message,
              level: this.extractLogLevel(event.message),
            }));
      } catch (error) {
        if (error.name === "ResourceNotFoundException") {
          return [];
        }
        throw error;
      }
    } catch (error) {
      this.logger.warn("CLOUDWATCH_QUERY_FAILED", { traceId, error: error.message });
      return [];
    }
  }

  mergeData(localData, cloudData) {
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

  async uploadReportToS3(reportKey, report, traceId) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_DIAGNOSTICS_BUCKET || "yorutsuke-diagnostics-us-dev",
      Key: reportKey,
      Body: JSON.stringify(report),
      ContentType: "application/json",
      Metadata: {
        "trace-id": traceId,
        "report-type": "diagnostic",
        "created-at": new Date().toISOString(),
      },
    });
    await this.s3.send(command);
    this.logger.debug("DIAGNOSTIC_REPORT_UPLOADED", { traceId, reportKey });
  }

  async generatePresignedUrl(reportKey) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_DIAGNOSTICS_BUCKET || "yorutsuke-diagnostics-us-dev",
      Key: reportKey,
    });
    return await getSignedUrl(this.s3, command, { expiresIn: 604800 });
  }

  unmarshallItem(item) {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
      if (value.S !== undefined) {
        result[key] = value.S;
      } else if (value.N !== undefined) {
        result[key] = Number(value.N);
      } else if (value.BOOL !== undefined) {
        result[key] = value.BOOL;
      } else if (value.NULL !== undefined) {
        result[key] = null;
      } else if (value.L !== undefined) {
        result[key] = value.L.map((v) => this.unmarshallItem(v));
      } else if (value.M !== undefined) {
        result[key] = this.unmarshallItem(value.M);
      }
    }
    return result;
  }

  extractLogLevel(message) {
    const msg = message.toLowerCase();
    if (msg.includes("error")) return "error";
    if (msg.includes("warn")) return "warn";
    if (msg.includes("debug")) return "debug";
    return "info";
  }
}

export const reportGenerator = new ReportGenerator(
  { dynamoDb: dynamoDbClient, s3: s3Client, cloudwatch: cloudwatchLogsClient },
  logger
);

export default reportGenerator;
