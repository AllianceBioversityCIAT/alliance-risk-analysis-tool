#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AllianceRiskStack } from '../lib/alliance-risk-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

new AllianceRiskStack(app, 'AllianceRiskStack', {
  env,
  description: 'CGIAR Risk Intelligence Tool — MVP infrastructure',
});
