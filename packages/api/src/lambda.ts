import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedServer: any;

async function bootstrap() {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  configureApp(app);
  await app.init();

  cachedServer = serverlessExpress({ app: expressApp });
  return cachedServer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: any, context: any, callback: any) => {
  // Prevent Lambda from waiting for the event loop to drain.
  // Prisma keeps persistent DB connections open, which would otherwise
  // cause the function to hang until timeout on warm invocations.
  context.callbackWaitsForEmptyEventLoop = false;

  const server = await bootstrap();
  return server(event, context, callback);
};
