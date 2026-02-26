import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('Alliance Risk Analysis API')
    .setDescription(
      'CGIAR Agricultural Risk Intelligence Tool — Multi-agent pipeline for document parsing, gap detection, risk analysis, and report generation across 7 risk categories.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Cognito JWT access token (from POST /api/auth/login)',
      },
      'cognito-jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(3001);
  Logger.log('Application is running on: http://localhost:3001/api', 'Bootstrap');
  Logger.log('Swagger UI available at: http://localhost:3001/api/docs', 'Bootstrap');
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Failed to start application', err.stack);
  process.exit(1);
});
