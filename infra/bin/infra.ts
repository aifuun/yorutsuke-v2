#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { YorutsukeStack } from "../lib/yorutsuke-stack";
import { YorutsukeAdminStack } from "../lib/yorutsuke-admin-stack";

const app = new cdk.App();

const env = app.node.tryGetContext("env") || "dev";
const account = process.env.CDK_DEFAULT_ACCOUNT;

// Main application stack
new YorutsukeStack(app, `Yorutsuke2Stack-${env}`, {
  env: {
    account,
    region: "us-east-1",
  },
  tags: {
    Project: "yorutsuke-v2",
    Environment: env,
  },
});

// Admin panel stack
new YorutsukeAdminStack(app, `Yorutsuke2AdminStack-${env}`, {
  env: {
    account,
    region: "us-east-1",
  },
  tags: {
    Project: "yorutsuke-v2",
    Environment: env,
    Component: "admin",
  },
  // Reference main stack resources by naming convention
  imageBucketName: `yorutsuke-images-${env}-${account}-v2`,
  transactionsTableName: `yorutsuke-transactions-${env}`,
  quotasTableName: `yorutsuke-quotas-${env}`,
  batchProcessLambdaName: `yorutsuke-batch-process-${env}`,
});
