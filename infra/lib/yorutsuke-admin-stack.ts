import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

interface YorutsukeAdminStackProps extends cdk.StackProps {
  // Reference to main stack resources
  imageBucketName: string;
  transactionsTableName: string;
  quotasTableName: string;
  batchProcessLambdaName: string;
}

export class YorutsukeAdminStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: YorutsukeAdminStackProps) {
    super(scope, id, props);

    const env = this.node.tryGetContext("env") || "dev";

    // ========================================
    // Lambda Layer for shared code
    // ========================================
    const sharedLayer = new lambda.LayerVersion(this, "AdminSharedLayer", {
      layerVersionName: `yorutsuke-admin-shared-us-${env}`,
      code: lambda.Code.fromAsset("lambda/shared-layer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared utilities for Yorutsuke Admin Lambdas",
    });

    // ========================================
    // DynamoDB: Control Table (emergency stop state)
    // ========================================
    const controlTable = new dynamodb.Table(this, "ControlTable", {
      tableName: `yorutsuke-control-us-${env}`,
      partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // Cognito: Admin User Pool (no self-signup)
    // ========================================
    const adminUserPool = new cognito.UserPool(this, "AdminUserPool", {
      userPoolName: `yorutsuke-admin-users-us-${env}`,
      selfSignUpEnabled: false, // Admin creates users manually
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      // @security: MFA is optional - users can enable TOTP in their settings
      // For production, consider changing to Mfa.REQUIRED
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,  // SMS costs money, disable
        otp: true,   // TOTP via authenticator app
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    const adminUserPoolClient = adminUserPool.addClient("AdminAppClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // ========================================
    // S3 Bucket for Admin Static Hosting
    // (Moved before API to enable CORS restriction)
    // ========================================
    const adminBucket = new s3.Bucket(this, "AdminBucket", {
      bucketName: `yorutsuke-admin-us-${env}-${this.account}`,
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: env !== "prod",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ========================================
    // ACM Certificate (must be in us-east-1 for CloudFront)
    // ========================================
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "AdminCertificate",
      "arn:aws:acm:us-east-1:696249060859:certificate/b109fc0c-f14f-4c00-8339-99ede709069b"
    );

    // ========================================
    // CloudFront Distribution
    // (Moved before API to enable CORS restriction)
    // ========================================
    const distribution = new cloudfront.Distribution(this, "AdminDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      // TODO: Enable custom domain (panel2.yorutsuke.rolligen.com) after obtaining certificate that covers it
      // domainNames: ["panel2.yorutsuke.rolligen.com"],
      // certificate,
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // ========================================
    // Lambda: Admin Stats
    // ========================================
    const statsLambda = new lambda.Function(this, "AdminStatsLambda", {
      functionName: `yorutsuke-admin-stats-us-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/stats"),
      layers: [sharedLayer],
      environment: {
        CONTROL_TABLE_NAME: controlTable.tableName,
        TRANSACTIONS_TABLE_NAME: props.transactionsTableName,
        QUOTAS_TABLE_NAME: props.quotasTableName,
        IMAGE_BUCKET_NAME: props.imageBucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions
    controlTable.grantReadData(statsLambda);
    statsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Scan",
          "dynamodb:DescribeTable",
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.transactionsTableName}`,
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.quotasTableName}`,
        ],
      })
    );
    statsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [`arn:aws:s3:::${props.imageBucketName}`],
      })
    );
    statsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudwatch:GetMetricData"],
        resources: ["*"],
      })
    );

    // ========================================
    // Lambda: Admin Control (emergency stop)
    // ========================================
    const controlLambda = new lambda.Function(this, "AdminControlLambda", {
      functionName: `yorutsuke-admin-control-us-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/control"),
      layers: [sharedLayer],
      environment: {
        CONTROL_TABLE_NAME: controlTable.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });

    controlTable.grantReadWriteData(controlLambda);

    // ========================================
    // Lambda: Admin Costs
    // ========================================
    const costsLambda = new lambda.Function(this, "AdminCostsLambda", {
      functionName: `yorutsuke-admin-costs-us-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/costs"),
      layers: [sharedLayer],
      environment: {
        // No specific env vars needed
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant Cost Explorer access
    costsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ce:GetCostAndUsage"],
        resources: ["*"],
      })
    );

    // ========================================
    // Lambda: Admin Batch Config
    // ========================================
    const batchConfigLambda = new lambda.Function(this, "AdminBatchConfigLambda", {
      functionName: `yorutsuke-admin-batch-config-us-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/batch-config"),
      layers: [sharedLayer],
      environment: {
        CONTROL_TABLE_NAME: controlTable.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });

    controlTable.grantReadWriteData(batchConfigLambda);

    // ========================================
    // Lambda: Admin Batch
    // ========================================
    const batchLambda = new lambda.Function(this, "AdminBatchLambda", {
      functionName: `yorutsuke-admin-batch-us-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/batch"),
      layers: [sharedLayer],
      environment: {
        BATCH_PROCESS_LAMBDA_NAME: props.batchProcessLambdaName,
        IMAGE_BUCKET_NAME: props.imageBucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions to invoke batch lambda and read logs
    batchLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:${props.batchProcessLambdaName}`,
        ],
      })
    );
    batchLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "logs:FilterLogEvents",
          "logs:GetLogEvents",
          "logs:DescribeLogStreams",
        ],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${props.batchProcessLambdaName}:*`,
        ],
      })
    );
    batchLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [`arn:aws:s3:::${props.imageBucketName}`],
      })
    );

    // ========================================
    // API Gateway with Cognito Authorization
    // ========================================
    const api = new apigateway.RestApi(this, "AdminApi", {
      restApiName: `yorutsuke-admin-api-us-${env}`,
      description: "Admin API for Yorutsuke",
      defaultCorsPreflightOptions: {
        // @security: Restrict CORS to whitelisted admin domains
        allowOrigins: [
          `https://${distribution.distributionDomainName}`,
          "https://admin.yoru.rolligen.com",
          "https://panel2.yorutsuke.rolligen.com",
        ],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
        ],
      },
    });

    // ========================================
    // API Gateway Rate Limiting
    // @security: Prevent brute force and DDoS
    // ========================================
    const usagePlan = api.addUsagePlan("AdminUsagePlan", {
      name: `yorutsuke-admin-usage-us-${env}`,
      description: "Rate limiting for Admin API",
      throttle: {
        rateLimit: 100,  // requests per second
        burstLimit: 200, // maximum burst
      },
      quota: {
        limit: 10000,    // requests per day
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "AdminAuthorizer",
      {
        cognitoUserPools: [adminUserPool],
        identitySource: "method.request.header.Authorization",
      }
    );

    const authOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // /stats endpoint
    const statsResource = api.root.addResource("stats");
    statsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(statsLambda),
      authOptions
    );

    // /control endpoint
    const controlResource = api.root.addResource("control");
    controlResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(controlLambda),
      authOptions
    );
    controlResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(controlLambda),
      authOptions
    );

    // /costs endpoint
    const costsResource = api.root.addResource("costs");
    costsResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(costsLambda),
      authOptions
    );

    // /batch endpoint (legacy batch operations)
    const batchResource = api.root.addResource("batch");
    batchResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(batchLambda),
      authOptions
    );
    batchResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(batchLambda),
      authOptions
    );

    // /batch/config endpoint (new batch configuration)
    const batchConfigResource = batchResource.addResource("config");
    batchConfigResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(batchConfigLambda),
      authOptions
    );
    batchConfigResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(batchConfigLambda),
      authOptions
    );

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, "AdminApiUrl", {
      value: api.url,
      description: "Admin API URL",
    });

    new cdk.CfnOutput(this, "AdminApiId", {
      value: api.restApiId,
      description: "Admin API ID (for SigV4 signing)",
    });

    new cdk.CfnOutput(this, "AdminBucketName", {
      value: adminBucket.bucketName,
      description: "Admin static hosting bucket",
    });

    new cdk.CfnOutput(this, "AdminCloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "Admin CloudFront URL",
    });

    new cdk.CfnOutput(this, "ControlTableName", {
      value: controlTable.tableName,
      description: "Control table for emergency stop",
    });

    new cdk.CfnOutput(this, "AdminUserPoolId", {
      value: adminUserPool.userPoolId,
      description: "Admin Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "AdminUserPoolClientId", {
      value: adminUserPoolClient.userPoolClientId,
      description: "Admin Cognito User Pool Client ID",
    });
  }
}
