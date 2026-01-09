# Telemetry Design

> Cloud observability for error tracking and usage analytics

## Overview

Yorutsuke uses a **tiered telemetry strategy** to balance observability needs with cost and privacy:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Telemetry Tiers                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tier 1: Error Push (Daily Batch) ← PLANNED                     │
│  └─ error level → nightly batch → S3                            │
│                                                                  │
│  Tier 2: Daily Summary (Configurable Batch)                     │
│  └─ local aggregate → upload during batch → S3 + Athena         │
│                                                                  │
│  Tier 3: Full Logs (On-demand)                                  │
│  └─ user-initiated upload → Support debugging                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Strategy Comparison

| Strategy | Latency | Cost | Use Case |
|----------|---------|------|----------|
| **Real-time Push** | <1s | High | Critical alerts |
| **Batched Push** | Minutes | Medium | General monitoring |
| **Error-only** | Real-time | Low | Budget-conscious |
| **Nightly Sync** | Hours | Lowest | Post-mortem analysis |

## Implementation

### Tier 1: Error Push (Daily Batch) — PLANNED

Collect error-level logs locally, upload summary during batch processing (timing configurable).

```typescript
// telemetryService.ts
interface ErrorSummary {
  date: string;
  userId: string;          // Hashed
  errorCount: number;
  errors: Array<{
    event: string;
    error: string;
    timestamp: string;
  }>;
}

class TelemetryService {
  /**
   * Called during batch processing
   * Extracts errors from today's logs and uploads summary (timing configurable)
   */
  async uploadErrorSummary(userId: UserId): Promise<void> {
    const logs = await this.readTodayLogs();
    const errors = logs.filter(l => l.level === 'error');

    if (errors.length === 0) return;  // Nothing to report

    const summary: ErrorSummary = {
      date: new Date().toISOString().split('T')[0],
      userId: hashUserId(userId),
      errorCount: errors.length,
      errors: errors.map(e => ({
        event: e.event,
        error: String(e.error || ''),
        timestamp: e.timestamp,
      })),
    };

    // Upload to S3 (reuse existing presign mechanism)
    await uploadToS3(`telemetry/errors/${summary.date}/${summary.userId}.json`, summary);
  }
}
```

### Tier 2: Daily Summary

Aggregate local logs and upload during nightly batch processing.

```typescript
// telemetryService.ts
interface DailySummary {
  date: string;
  userId: string;
  counts: Record<string, number>;  // Event counts by type
  errors: LogEntry[];              // All error entries
  performance: {
    avgUploadTime: number;
    avgCompressionTime: number;
  };
}

class TelemetryService {
  /**
   * Called during batch processing (timing configurable)
   * Aggregates today's logs into a summary for upload
   */
  async uploadDailySummary(userId: UserId): Promise<void> {
    const logs = await this.readTodayLogs();

    const summary: DailySummary = {
      date: new Date().toISOString().split('T')[0],
      userId: hashUserId(userId),  // Privacy: hash user ID
      counts: this.countByEvent(logs),
      errors: logs.filter(l => l.level === 'error').map(sanitizeForCloud),
      performance: this.calculatePerformance(logs),
    };

    // Upload to S3 (reuse existing presign mechanism)
    await uploadSummary(userId, summary);
  }

  private countByEvent(logs: LogEntry[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.event] = (acc[log.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

### Tier 3: On-Demand Upload

Manual upload for support cases.

```typescript
// debugService.ts
async function uploadDiagnostics(): Promise<string> {
  const logs = await readAllLocalLogs();  // Last 7 days
  const sanitized = logs.map(sanitizeForCloud);

  const diagnosticId = crypto.randomUUID();
  await uploadToS3(`diagnostics/${diagnosticId}.jsonl`, sanitized);

  return diagnosticId;  // User shares this with support
}
```

## AWS Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AWS Telemetry Stack                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client                                                          │
│    │                                                             │
│    ├─── Error Push ───► API Gateway ───► Lambda ───► CloudWatch │
│    │                                          │                  │
│    │                                          └───► SNS (Alert) │
│    │                                                             │
│    └─── Daily Summary ──► S3 (telemetry/)                       │
│                               │                                  │
│                               └───► Athena (Query)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CDK Stack

```typescript
// infra/lib/telemetry-stack.ts
export class TelemetryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TelemetryStackProps) {
    super(scope, id, props);

    // Error ingestion Lambda
    const errorHandler = new lambda.Function(this, 'ErrorHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/telemetry-error'),
      environment: {
        ALERT_TOPIC_ARN: props.alertTopic.topicArn,
      },
    });

    // API Gateway for error push
    const api = new apigateway.RestApi(this, 'TelemetryApi', {
      restApiName: 'yorutsuke-telemetry',
    });

    api.root.addResource('error').addMethod('POST',
      new apigateway.LambdaIntegration(errorHandler)
    );

    // S3 bucket for daily summaries
    const telemetryBucket = new s3.Bucket(this, 'TelemetryBucket', {
      lifecycleRules: [{
        expiration: cdk.Duration.days(90),  // 90-day retention
      }],
    });

    // Athena for querying
    new glue.CfnTable(this, 'TelemetryTable', {
      databaseName: 'yorutsuke',
      tableInput: {
        name: 'daily_summaries',
        storageDescriptor: {
          location: `s3://${telemetryBucket.bucketName}/summaries/`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
          },
        },
      },
    });
  }
}
```

## Cost Estimate

| Component | Usage Assumption | Monthly Cost |
|-----------|------------------|--------------|
| API Gateway | 10K errors/month | ~$0.04 |
| Lambda (error) | 10K invocations | ~$0.01 |
| CloudWatch Logs | 1GB/month | ~$0.50 |
| S3 (summaries) | 100MB/month | ~$0.01 |
| Athena queries | 10 queries/month | ~$0.05 |
| **Total** | | **~$0.61/month** |

## Privacy Considerations

### Data Sanitization

```typescript
function sanitizeForCloud(entry: LogEntry): LogEntry {
  const sanitized = { ...entry };

  // Remove or hash sensitive fields
  if (sanitized.userId) {
    sanitized.userId = hashUserId(sanitized.userId);
  }

  // Redact file paths
  if (sanitized.localPath) {
    sanitized.localPath = '[REDACTED]';
  }

  // Remove any potential PII from data
  if (sanitized.email) {
    sanitized.email = '[REDACTED]';
  }

  return sanitized;
}

function hashUserId(userId: string): string {
  // One-way hash for correlation without exposing actual ID
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
}
```

### User Settings

```typescript
interface TelemetrySettings {
  errorReporting: boolean;    // Default: true - crash reports
  usageAnalytics: boolean;    // Default: false - usage stats
  fullDiagnostics: boolean;   // Default: false - full logs
}
```

### Settings UI

```
┌─────────────────────────────────────────┐
│ Privacy & Telemetry                     │
├─────────────────────────────────────────┤
│ ☑ Send error reports                    │
│   Help us fix crashes and bugs          │
│                                         │
│ ☐ Send usage analytics                  │
│   Help us improve the app               │
│                                         │
│ [Upload Diagnostics]                    │
│   Manually send logs to support         │
└─────────────────────────────────────────┘
```

## Implementation Priority

| Phase | Feature | Complexity | Status |
|-------|---------|------------|--------|
| **P0** | Error-only (daily batch) | Low | Planned (#93) |
| P1 | Daily summary upload | Medium | Out of scope |
| P2 | Athena dashboard | Medium | Out of scope |
| P3 | User opt-in settings | Low | Out of scope |

> **Current Plan**: Only P0 (error-only daily batch) will be implemented.
> Other features may be considered later based on need.

## Related Documents

- [LOGGING.md](./LOGGING.md) - Local logging system
- [OPERATIONS.md](./OPERATIONS.md) - Operational procedures
- [QUOTA.md](./QUOTA.md) - Usage limits

## References

- [AWS CloudWatch Logs Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [AWS Athena Pricing](https://aws.amazon.com/athena/pricing/)
- [GDPR Telemetry Guidelines](https://gdpr.eu/what-is-gdpr/)
