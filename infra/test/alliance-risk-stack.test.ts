import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AllianceRiskStack } from '../lib/alliance-risk-stack';

/**
 * Synthesize the stack and run structural assertions.
 * These tests verify that the CDK template contains the expected AWS resources.
 */
describe('AllianceRiskStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new AllianceRiskStack(app, 'TestAllianceRiskStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    template = Template.fromStack(stack);
  });

  describe('Cognito User Pool', () => {
    it('creates a User Pool with email sign-in', () => {
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
        AutoVerifiedAttributes: ['email'],
      });
    });

    it('creates a User Pool Client with AdminUserPassword auth flow', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith([
          'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        ]),
      });
    });

    it('creates an admin group', () => {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: 'admin',
      });
    });
  });

  describe('RDS PostgreSQL', () => {
    it('creates an RDS database instance with PostgreSQL 15', () => {
      template.hasResourceProperties('AWS::RDS::DBInstance', {
        DBInstanceClass: 'db.t3.micro',
        Engine: 'postgres',
        PubliclyAccessible: true,
      });
    });
  });

  describe('Lambda Functions', () => {
    it('creates an API Lambda with ARM64 and Node.js 20', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'alliance-risk-api',
        Runtime: 'nodejs20.x',
        Architectures: ['arm64'],
        MemorySize: 1024,
      });
    });

    it('creates a Worker Lambda with 15-minute timeout', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'alliance-risk-worker',
        Runtime: 'nodejs20.x',
        Architectures: ['arm64'],
        MemorySize: 1024,
        Timeout: 900, // 15 minutes in seconds
      });
    });
  });

  describe('API Gateway', () => {
    it('creates an HTTP API', () => {
      template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    });

    it('creates a Lambda integration', () => {
      template.resourceCountIs('AWS::ApiGatewayV2::Integration', 1);
    });
  });

  describe('S3 Buckets', () => {
    it('creates a file storage bucket with block public access', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `alliance-risk-files-123456789012`,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('creates a web hosting bucket', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `alliance-risk-web-123456789012`,
      });
    });
  });

  describe('CloudFront Distribution', () => {
    it('creates a CloudFront distribution', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    it('configures 403/404 error responses to serve index.html', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.objectLike({
          CustomErrorResponses: Match.arrayWith([
            Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
            Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
          ]),
        }),
      });
    });
  });

  describe('IAM Policies', () => {
    it('grants Bedrock InvokeModel permission to Worker Lambda', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
              ]),
            }),
          ]),
        }),
      });
    });

    it('grants Lambda InvokeFunction to API Lambda role', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunction',
            }),
          ]),
        }),
      });
    });
  });

  describe('CDK Outputs', () => {
    it('exports API URL', () => {
      template.hasOutput('ApiUrl', {
        Export: { Name: 'AllianceRiskApiUrl' },
      });
    });

    it('exports CloudFront URL', () => {
      template.hasOutput('CloudFrontUrl', {
        Export: { Name: 'AllianceRiskCloudFrontUrl' },
      });
    });

    it('exports Cognito User Pool ID', () => {
      template.hasOutput('CognitoUserPoolId', {
        Export: { Name: 'AllianceRiskCognitoUserPoolId' },
      });
    });
  });
});
