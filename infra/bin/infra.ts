#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { YorutsukeStack } from "../lib/yorutsuke-stack";

const app = new cdk.App();

const env = app.node.tryGetContext("env") || "dev";

new YorutsukeStack(app, `Yorutsuke2Stack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  tags: {
    Project: "yorutsuke-v2",
    Environment: env,
  },
});
