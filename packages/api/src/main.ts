import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });
  configureApp(app);
  await app.listen(3001);
  Logger.log('Application is running on: http://localhost:3001/api', 'Bootstrap');
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Failed to start application', err.stack);
  process.exit(1);
});
