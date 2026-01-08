import * as cdk from "aws-cdk-lib";
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
    // DynamoDB: Control Table (emergency stop state)
    // ========================================
    const controlTable = new dynamodb.Table(this, "ControlTable", {
      tableName: `yorutsuke-control-${env}`,
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
      userPoolName: `yorutsuke-admin-users-${env}`,
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
    // Lambda: Admin Stats
    // ========================================
    const statsLambda = new lambda.Function(this, "AdminStatsLambda", {
      functionName: `yorutsuke-admin-stats-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/stats"),
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
      functionName: `yorutsuke-admin-control-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/control"),
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
      functionName: `yorutsuke-admin-costs-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/costs"),
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
      functionName: `yorutsuke-admin-batch-config-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/batch-config"),
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
      functionName: `yorutsuke-admin-batch-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/admin/batch"),
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
      restApiName: `yorutsuke-admin-api-${env}`,
      description: "Admin API for Yorutsuke",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
        ],
      },
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
    // S3 Bucket for Admin Static Hosting
    // ========================================
    const adminBucket = new s3.Bucket(this, "AdminBucket", {
      bucketName: `yorutsuke-admin-${env}-${this.account}`,
      removalPolicy:
        env === "prod"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: env !== "prod",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ========================================
    // CloudFront Distribution
    // ========================================
    const distribution = new cloudfront.Distribution(this, "AdminDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
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
