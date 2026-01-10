import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as s3_notifications from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";

export class YorutsukeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext("env") || "dev";

    // S3 Bucket for receipt images
    const imageBucket = new s3.Bucket(this, "ImageBucket", {
      bucketName: `yorutsuke-images-${env}-${this.account}`,
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: env !== "prod",
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          prefix: "uploads/",
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    // DynamoDB Table for transactions
    // TTL enabled for guest user data expiration (60 days)
    const transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
      tableName: `yorutsuke-transactions-${env}`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "transactionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",  // Guest data expires after 60 days
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying by date
    transactionsTable.addGlobalSecondaryIndex({
      indexName: "byDate",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
    });

    // DynamoDB Table for daily upload quotas
    const quotasTable = new dynamodb.Table(this, "QuotasTable", {
      tableName: `yorutsuke-quotas-${env}`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Table for idempotency (Pillar Q)
    const intentsTable = new dynamodb.Table(this, "IntentsTable", {
      tableName: `yorutsuke-intents-${env}`,
      partitionKey: { name: "intentId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // DynamoDB Table for Admin Control/Config (Physical table managed by AdminStack)
    const controlTable = dynamodb.Table.fromTableName(this, "ControlTable", `yorutsuke-control-${env}`);

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `yorutsuke-users-${env}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("AppClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Lambda Layer for shared code
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      layerVersionName: `yorutsuke-shared-${env}`,
      code: lambda.Code.fromAsset("lambda/shared-layer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared utilities for Yorutsuke Lambdas",
    });

    // Lambda for presigned URLs
    const presignLambda = new lambda.Function(this, "PresignLambda", {
      functionName: `yorutsuke-presign-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/presign"),
      layers: [sharedLayer],
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        QUOTAS_TABLE_NAME: quotasTable.tableName,
        INTENTS_TABLE_NAME: intentsTable.tableName,  // Pillar Q
        QUOTA_LIMIT: "50",
      },
      timeout: cdk.Duration.seconds(10),
    });

    imageBucket.grantPut(presignLambda);
    quotasTable.grantReadWriteData(presignLambda);
    intentsTable.grantReadWriteData(presignLambda);  // Pillar Q

    // Lambda Function URL for presign
    const presignUrl = presignLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });

    // Lambda for quota check
    const quotaLambda = new lambda.Function(this, "QuotaLambda", {
      functionName: `yorutsuke-quota-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/quota"),
      layers: [sharedLayer],
      environment: {
        QUOTAS_TABLE_NAME: quotasTable.tableName,
        QUOTA_LIMIT: "50",
      },
      timeout: cdk.Duration.seconds(10),
    });

    quotasTable.grantReadData(quotaLambda);

    // Lambda Function URL for quota
    const quotaUrl = quotaLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });

    // SSM Parameter for maintenance mode (can be changed without deploy)
    const maintenanceModeParam = new ssm.StringParameter(
      this,
      "MaintenanceModeParam",
      {
        parameterName: `/yorutsuke/${env}/maintenance-mode`,
        stringValue: "false",
        description: "Set to 'true' to enable maintenance mode",
      }
    );

    // Lambda for app configuration
    const configLambda = new lambda.Function(this, "ConfigLambda", {
      functionName: `yorutsuke-config-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/config"),
      layers: [sharedLayer],
      environment: {
        QUOTA_LIMIT: "50",
        UPLOAD_INTERVAL_MS: "2000",
        BATCH_TIME: "02:00", // Default time; can be overridden by batch config
        MIN_VERSION: "1.0.0",
        LATEST_VERSION: "1.1.0",
        MAINTENANCE_MODE_PARAM: maintenanceModeParam.parameterName,
      },
      timeout: cdk.Duration.seconds(10),
    });

    maintenanceModeParam.grantRead(configLambda);

    // Lambda Function URL for config (public, no auth)
    const configUrl = configLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
        allowedHeaders: ["*"],
      },
    });

    // Lambda for transactions CRUD
    const transactionsLambda = new lambda.Function(this, "TransactionsLambda", {
      functionName: `yorutsuke-transactions-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/transactions"),
      layers: [sharedLayer],
      environment: {
        TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    transactionsTable.grantReadWriteData(transactionsLambda);

    // Lambda Function URL for transactions
    const transactionsUrl = transactionsLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [
          lambda.HttpMethod.POST,
          lambda.HttpMethod.PUT,
          lambda.HttpMethod.DELETE,
        ],
        allowedHeaders: ["*"],
      },
    });

    // Lambda for report generation
    const reportLambda = new lambda.Function(this, "ReportLambda", {
      functionName: `yorutsuke-report-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/report"),
      layers: [sharedLayer],
      environment: {
        TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    transactionsTable.grantReadData(reportLambda);

    // Lambda Function URL for report
    const reportUrl = reportLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
      },
    });

    // Lambda for batch processing (OCR)
    const batchProcessLambda = new lambda.Function(this, "BatchProcessLambda", {
      functionName: `yorutsuke-batch-process-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/batch-process"),
      layers: [sharedLayer],
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
        MAX_IMAGES_PER_RUN: "100",
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Lambda for instant processing (On-Demand OCR)
    const instantProcessLambda = new lambda.Function(this, "InstantProcessLambda", {
      functionName: `yorutsuke-instant-processor-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/instant-processor"),
      layers: [sharedLayer],
      environment: {
        TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
        BUCKET_NAME: imageBucket.bucketName,
        CONTROL_TABLE_NAME: controlTable.tableName,
      },
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
    });

    // S3 Trigger for instant processing
    imageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.LambdaDestination(instantProcessLambda),
      { prefix: "uploads/" }
    );

    // Grant permissions for instant processor
    imageBucket.grantReadWrite(instantProcessLambda);
    transactionsTable.grantWriteData(instantProcessLambda);
    controlTable.grantReadData(instantProcessLambda);
    instantProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/*"],
      })
    );

    // Lambda for batch orchestration (Bedrock Batch Inference)
    const batchOrchestratorLambda = new lambda.Function(this, "BatchOrchestratorLambda", {
      functionName: `yorutsuke-batch-orchestrator-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/batch-orchestrator"),
      layers: [sharedLayer],
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        PENDING_IMAGES_TABLE: "yorutsuke-pending-images",
        BATCH_JOBS_TABLE: "yorutsuke-batch-jobs",
        CONTROL_TABLE_NAME: controlTable.tableName,
        API_BASE_URL: `https://api.${env}.example.com`,  // For statusUrl
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Grant permissions for batch orchestrator
    imageBucket.grantRead(batchOrchestratorLambda);  // Read images for manifest
    imageBucket.grantWrite(batchOrchestratorLambda);  // Write manifest.jsonl
    batchOrchestratorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:CreateModelInvocationJob",
          "bedrock:GetModelInvocationJob",
        ],
        resources: ["arn:aws:bedrock:*::foundation-model/*"],
      })
    );

    // Grant DynamoDB access for batch jobs table
    // Pillar Q: Using intentId as partition key for idempotency
    const batchJobsTable = new dynamodb.Table(this, "BatchJobsTable", {
      tableName: `yorutsuke-batch-jobs-${env}`,
      partitionKey: {
        name: "intentId",  // Pillar Q: Idempotency key
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "submitTime",  // For ordering submissions
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
    });
    
    // Add GSI for jobId lookup (reverse index)
    batchJobsTable.addGlobalSecondaryIndex({
      indexName: "jobIdIndex",
      partitionKey: {
        name: "jobId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    batchJobsTable.grantReadWriteData(batchOrchestratorLambda);

    // ========================================
    // Batch Result Handler Lambda (Issue #99)
    // Improvement #7: IAM least privilege - explicit S3/DynamoDB actions only
    // ========================================
    const batchResultHandlerLambda = new lambda.Function(
      this,
      "BatchResultHandlerLambda",
      {
        functionName: `yorutsuke-batch-result-handler-${env}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "index.handler",
        code: lambda.Code.fromAsset("lambda/batch-result-handler"),
        layers: [sharedLayer],
        environment: {
          BUCKET_NAME: imageBucket.bucketName,
          TRANSACTIONS_TABLE: transactionsTable.tableName,
          BATCH_JOBS_TABLE: batchJobsTable.tableName,
        },
        timeout: cdk.Duration.minutes(10),
        memorySize: 1024, // Increase for streaming large JSONL files
      }
    );

    // Improvement #7: IAM least privilege - only needed actions
    batchResultHandlerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",    // Read Bedrock output JSONL
          "s3:PutObject",    // Write to processed/
          "s3:DeleteObject", // Delete from uploads/
          "s3:HeadObject",   // Check file existence
        ],
        resources: [
          `${imageBucket.bucketArn}/batch-output/*`,
          `${imageBucket.bucketArn}/uploads/*`,
          `${imageBucket.bucketArn}/processed/*`,
        ],
      })
    );

    batchResultHandlerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
        ],
        resources: [
          transactionsTable.tableArn,
          batchJobsTable.tableArn,
          `${batchJobsTable.tableArn}/index/*`, // For jobIdIndex
        ],
      })
    );

    // S3 event notification: batch-output/ → Lambda
    // Trigger batch-result-handler when Bedrock outputs results
    imageBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3_notifications.LambdaDestination(batchResultHandlerLambda),
      { prefix: "batch-output/" }
    );

    // Grant permissions for instant processor
    imageBucket.grantReadWrite(batchProcessLambda);
    transactionsTable.grantWriteData(batchProcessLambda);

    // Grant Bedrock access
    batchProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/*"],
      })
    );

    // EventBridge Rule: Fallback schedule at 02:00 JST (17:00 UTC previous day)
    // Note: With configurable processing modes, this is only used for Batch/Hybrid modes
    // when automatic S3 triggers are not sufficient
    const batchRule = new events.Rule(this, "BatchProcessRule", {
      ruleName: `yorutsuke-batch-process-${env}`,
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "17", // 02:00 JST = 17:00 UTC (previous day) - fallback only
      }),
      enabled: env === "prod", // Only enable in production
    });

    batchRule.addTarget(new targets.LambdaFunction(batchProcessLambda));

    // ========================================
    // Cost Control & Monitoring (Issue #37)
    // ========================================

    // SNS Topic for alarms
    const alertsTopic = new sns.Topic(this, "AlertsTopic", {
      topicName: `yorutsuke-alerts-${env}`,
      displayName: "Yorutsuke Cost Alerts",
    });

    // SSM Parameter for emergency stop (circuit breaker)
    const emergencyStopParam = new ssm.StringParameter(
      this,
      "EmergencyStopParam",
      {
        parameterName: `/yorutsuke/${env}/emergency-stop`,
        stringValue: "false",
        description: "Set to 'true' to stop all uploads (circuit breaker)",
      }
    );

    // Grant presign Lambda permission to read emergency stop
    emergencyStopParam.grantRead(presignLambda);
    presignLambda.addEnvironment(
      "EMERGENCY_STOP_PARAM",
      emergencyStopParam.parameterName
    );

    // Alarm: S3 uploads > 1500/day
    const s3UploadAlarm = new cloudwatch.Alarm(this, "S3UploadLimitAlarm", {
      alarmName: `yorutsuke-s3-upload-limit-${env}`,
      alarmDescription: "S3 uploads exceeded 1500/day limit",
      metric: new cloudwatch.Metric({
        namespace: "AWS/S3",
        metricName: "PutRequests",
        dimensionsMap: {
          BucketName: imageBucket.bucketName,
          FilterId: "AllRequests",
        },
        statistic: "Sum",
        period: cdk.Duration.hours(24),
      }),
      threshold: 1500,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    s3UploadAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm: Presign Lambda errors > 100/5min (circuit breaker trigger)
    const presignErrorAlarm = new cloudwatch.Alarm(this, "PresignErrorAlarm", {
      alarmName: `yorutsuke-presign-errors-${env}`,
      alarmDescription: "Presign Lambda errors exceeded 100/5min - circuit breaker",
      metric: presignLambda.metricErrors({
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 100,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    presignErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm: Batch process Lambda errors (LLM failures)
    const batchErrorAlarm = new cloudwatch.Alarm(this, "BatchErrorAlarm", {
      alarmName: `yorutsuke-batch-errors-${env}`,
      alarmDescription: "Batch process (LLM) errors detected",
      metric: batchProcessLambda.metricErrors({
        statistic: "Sum",
        period: cdk.Duration.hours(1),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    batchErrorAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm: Batch process invocations > 900/day (LLM cost control)
    const batchInvocationAlarm = new cloudwatch.Alarm(
      this,
      "BatchInvocationAlarm",
      {
        alarmName: `yorutsuke-batch-invocations-${env}`,
        alarmDescription: "LLM invocations approaching daily limit (900/day)",
        metric: batchProcessLambda.metricInvocations({
          statistic: "Sum",
          period: cdk.Duration.hours(24),
        }),
        threshold: 900,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    batchInvocationAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // Alarm: All Lambda concurrent executions (global throttle warning)
    const throttleAlarm = new cloudwatch.Alarm(this, "ThrottleAlarm", {
      alarmName: `yorutsuke-throttle-warning-${env}`,
      alarmDescription: "Lambda throttling detected",
      metric: new cloudwatch.Metric({
        namespace: "AWS/Lambda",
        metricName: "Throttles",
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    throttleAlarm.addAlarmAction(new cw_actions.SnsAction(alertsTopic));

    // ========================================
    // Admin Delete Data Lambda (Debug/Admin Only)
    // ========================================
    const adminDeleteDataLambda = new lambda.Function(this, "AdminDeleteDataLambda", {
      functionName: `yorutsuke-admin-delete-data-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin-delete-data"),
      environment: {
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        IMAGES_BUCKET: imageBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Grant DynamoDB permissions (Query + BatchWrite for user data deletion)
    adminDeleteDataLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "dynamodb:Query",           // Query transactions by userId
          "dynamodb:BatchWriteItem",  // Batch delete transactions
        ],
        resources: [
          transactionsTable.tableArn,
        ],
      })
    );

    // Grant S3 permissions (List + Delete for user images)
    adminDeleteDataLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:ListBucket",      // List objects with userId prefix
          "s3:DeleteObject",    // Delete individual objects
        ],
        resources: [
          imageBucket.bucketArn,
          `${imageBucket.bucketArn}/*`,
        ],
      })
    );

    // Lambda Function URL for admin delete data
    const adminDeleteDataUrl = adminDeleteDataLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "ImageBucketName", {
      value: imageBucket.bucketName,
      exportName: `${id}-ImageBucket`,
    });

    new cdk.CfnOutput(this, "TransactionsTableName", {
      value: transactionsTable.tableName,
      exportName: `${id}-TransactionsTable`,
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      exportName: `${id}-UserPoolId`,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      exportName: `${id}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, "PresignLambdaUrl", {
      value: presignUrl.url,
      exportName: `${id}-PresignUrl`,
    });

    new cdk.CfnOutput(this, "QuotasTableName", {
      value: quotasTable.tableName,
      exportName: `${id}-QuotasTable`,
    });

    new cdk.CfnOutput(this, "IntentsTableName", {
      value: intentsTable.tableName,
      exportName: `${id}-IntentsTable`,
    });

    new cdk.CfnOutput(this, "QuotaLambdaUrl", {
      value: quotaUrl.url,
      exportName: `${id}-QuotaUrl`,
    });

    new cdk.CfnOutput(this, "ConfigLambdaUrl", {
      value: configUrl.url,
      exportName: `${id}-ConfigUrl`,
    });

    new cdk.CfnOutput(this, "TransactionsLambdaUrl", {
      value: transactionsUrl.url,
      exportName: `${id}-TransactionsUrl`,
    });

    new cdk.CfnOutput(this, "ReportLambdaUrl", {
      value: reportUrl.url,
      exportName: `${id}-ReportUrl`,
    });

    new cdk.CfnOutput(this, "AlertsTopicArn", {
      value: alertsTopic.topicArn,
      exportName: `${id}-AlertsTopicArn`,
    });

    new cdk.CfnOutput(this, "EmergencyStopParamName", {
      value: emergencyStopParam.parameterName,
      exportName: `${id}-EmergencyStopParam`,
    });

    new cdk.CfnOutput(this, "AdminDeleteDataUrl", {
      value: adminDeleteDataUrl.url,
      exportName: `${id}-AdminDeleteDataUrl`,
    });
  }
}
