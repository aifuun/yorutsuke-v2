#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MainStack } from "../lib/main-stack";
import { AdminStack } from "../lib/admin-stack";
import { getStackName, getS3BucketName, getDynamoTableName } from "../lib/generated/config";

const app = new cdk.App();

const cdkEnv = app.node.tryGetContext("env") || "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = "us-east-1";

// Main application stack
new MainStack(app, getStackName(cdkEnv, 'main'), {
  env: {
    account,
    region,
  },
  tags: {
    Project: "recie-v2",
    Environment: cdkEnv,
  },
});

// Admin panel stack
new AdminStack(app, getStackName(cdkEnv, 'admin'), {
  env: {
    account,
    region,
  },
  tags: {
    Project: "recie-v2",
    Environment: cdkEnv,
    Component: "admin",
  },
  // Reference main stack resources by naming convention
  imageBucketName: getS3BucketName('images', 'us', cdkEnv, account!),
  transactionsTableName: getDynamoTableName('transactions', 'us', cdkEnv),
  quotasTableName: getDynamoTableName('quotas', 'us', cdkEnv),
});
