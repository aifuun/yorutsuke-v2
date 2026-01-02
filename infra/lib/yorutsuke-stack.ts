import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
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
    const transactionsTable = new dynamodb.Table(this, "TransactionsTable", {
      tableName: `yorutsuke-transactions-${env}`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "transactionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
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

    // Lambda for presigned URLs
    const presignLambda = new lambda.Function(this, "PresignLambda", {
      functionName: `yorutsuke-presign-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/presign"),
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
      environment: {
        QUOTA_LIMIT: "50",
        UPLOAD_INTERVAL_MS: "10000",
        BATCH_TIME: "02:00",
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
        allowedHeaders: ["*"],
      },
    });

    // Lambda for batch processing (OCR)
    const batchProcessLambda = new lambda.Function(this, "BatchProcessLambda", {
      functionName: `yorutsuke-batch-process-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/batch-process"),
      environment: {
        BUCKET_NAME: imageBucket.bucketName,
        TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
        MAX_IMAGES_PER_RUN: "100",
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Grant permissions
    imageBucket.grantReadWrite(batchProcessLambda);
    transactionsTable.grantWriteData(batchProcessLambda);

    // Grant Bedrock access
    batchProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0"],
      })
    );

    // EventBridge Rule: Run at 02:00 JST (17:00 UTC previous day)
    const batchRule = new events.Rule(this, "BatchProcessRule", {
      ruleName: `yorutsuke-batch-process-${env}`,
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "17", // 02:00 JST = 17:00 UTC (previous day)
      }),
      enabled: env === "prod", // Only enable in production
    });

    batchRule.addTarget(new targets.LambdaFunction(batchProcessLambda));

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
  }
}
