import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AllianceRiskStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Environment Parameter ───────────────────────────────────────────────────
    const environmentParam = new cdk.CfnParameter(this, 'Environment', {
      type: 'String',
      default: 'dev',
      allowedValues: ['dev', 'staging', 'production'],
      description: 'Deployment environment (dev | staging | production)',
    });
    const environment = environmentParam.valueAsString;

    // ─── Cognito User Pool ──────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'alliance-risk-user-pool',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'alliance-risk-api-client',
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.hours(1),
    });

    // Admin group
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Platform administrators',
    });

    // ─── RDS PostgreSQL ─────────────────────────────────────────────────────────

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true }),
      allowAllOutbound: false,
      description: 'Security group for Alliance Risk RDS instance',
    });

    // Allow inbound PostgreSQL from anywhere (MVP — restrict in production)
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from anywhere (MVP)',
    );

    const dbInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc: ec2.Vpc.fromLookup(this, 'DefaultVpcForDb', { isDefault: true }),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      publiclyAccessible: true,
      databaseName: 'alliance_risk',
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: 'alliance-risk/db-credentials',
      }),
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ─── S3 File Bucket ─────────────────────────────────────────────────────────

    const fileBucket = new s3.Bucket(this, 'FileBucket', {
      bucketName: `alliance-risk-files-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3600,
        },
      ],
    });

    // ─── Lambda Execution Role ──────────────────────────────────────────────────

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    // Cognito permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminRespondToAuthChallenge',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
          'cognito-idp:ListGroups',
          'cognito-idp:ForgotPassword',
          'cognito-idp:ConfirmForgotPassword',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    // Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:Retrieve',
        ],
        resources: ['*'],
      }),
    );

    // Textract permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
        ],
        resources: ['*'],
      }),
    );

    // S3 permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`${fileBucket.bucketArn}/*`],
      }),
    );

    // ─── Worker Lambda ──────────────────────────────────────────────────────────

    const workerLambda = new lambda.Function(this, 'WorkerLambda', {
      functionName: 'alliance-risk-worker',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'dist/worker.handler',
      code: lambda.Code.fromAsset('../packages/api/dist', {
        exclude: ['**/*.spec.js', '**/*.spec.d.ts'],
      }),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      role: lambdaRole,
      environment: {
        ENVIRONMENT: 'production',
        AWS_ACCOUNT_ID: this.account,
        S3_BUCKET_NAME: fileBucket.bucketName,
      },
    });

    // ─── API Lambda ─────────────────────────────────────────────────────────────

    // Additional permission: API Lambda can invoke Worker Lambda
    const apiLambdaRole = new iam.Role(this, 'ApiLambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    // Copy all permissions from lambdaRole to apiLambdaRole
    apiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminRespondToAuthChallenge',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
          'cognito-idp:ListGroups',
          'cognito-idp:ForgotPassword',
          'cognito-idp:ConfirmForgotPassword',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

    apiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:Retrieve',
        ],
        resources: ['*'],
      }),
    );

    apiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:StartDocumentAnalysis',
          'textract:GetDocumentAnalysis',
        ],
        resources: ['*'],
      }),
    );

    apiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        resources: [`${fileBucket.bucketArn}/*`],
      }),
    );

    // Permission to invoke Worker Lambda
    apiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [workerLambda.functionArn],
      }),
    );

    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: 'alliance-risk-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'dist/lambda.handler',
      code: lambda.Code.fromAsset('../packages/api/dist', {
        exclude: ['**/*.spec.js', '**/*.spec.d.ts'],
      }),
      timeout: cdk.Duration.seconds(29), // < API Gateway 30s limit
      memorySize: 1024,
      role: apiLambdaRole,
      environment: {
        ENVIRONMENT: 'production',
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        S3_BUCKET_NAME: fileBucket.bucketName,
        AWS_ACCOUNT_ID: this.account,
        WORKER_FUNCTION_NAME: workerLambda.functionName,
        CORS_ORIGIN: 'https://app.alliance-risk.example.com',
      },
    });

    // ─── API Gateway HTTP API ───────────────────────────────────────────────────

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'alliance-risk-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
          apigwv2.CorsHttpMethod.PATCH,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
      defaultIntegration: new apigwv2integrations.HttpLambdaIntegration(
        'ApiIntegration',
        apiLambda,
        { payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_2_0 },
      ),
    });

    // ─── Frontend S3 + CloudFront ───────────────────────────────────────────────

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `alliance-risk-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      'WebOAI',
      { comment: 'Alliance Risk web bucket OAI' },
    );
    webBucket.grantRead(originAccessIdentity);

    // CloudFront Function: rewrite extensionless URLs to .html, block direct .txt access
    const urlRewriteFunction = new cloudfront.Function(
      this,
      'UrlRewriteFunction',
      {
        functionName: `alliance-risk-url-rewrite-${environment}`,
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('.txt')) {
    var rscHeader = request.headers['rsc'];
    if (!rscHeader || rscHeader.value !== '1') {
      request.uri = uri.slice(0, -4) + '.html';
    }
    return request;
  }
  if (uri.endsWith('/') && uri !== '/') {
    request.uri = uri.slice(0, -1) + '.html';
    return request;
  }
  if (uri.includes('.')) {
    return request;
  }
  request.uri = uri + '.html';
  return request;
}
`),
      },
    );

    const webDistribution = new cloudfront.Distribution(
      this,
      'WebDistribution',
      {
        defaultBehavior: {
          origin: new cloudfrontOrigins.S3Origin(webBucket, {
            originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              function: urlRewriteFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.seconds(0),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.seconds(0),
          },
        ],
        defaultRootObject: 'index.html',
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        httpVersion: cloudfront.HttpVersion.HTTP2,
      },
    );

    // ─── CDK Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway HTTP API endpoint URL',
      exportName: 'AllianceRiskApiUrl',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${webDistribution.distributionDomainName}`,
      description: 'CloudFront distribution URL for the frontend',
      exportName: 'AllianceRiskCloudFrontUrl',
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'AllianceRiskCognitoUserPoolId',
    });

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
      exportName: 'AllianceRiskCognitoClientId',
    });

    new cdk.CfnOutput(this, 'FileBucketName', {
      value: fileBucket.bucketName,
      description: 'S3 bucket name for file storage',
      exportName: 'AllianceRiskFileBucketName',
    });

    new cdk.CfnOutput(this, 'WebBucketName', {
      value: webBucket.bucketName,
      description: 'S3 bucket name for static web hosting',
      exportName: 'AllianceRiskWebBucketName',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'WorkerLambdaName', {
      value: workerLambda.functionName,
      description: 'Worker Lambda function name',
    });
  }
}
