import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication): void {
  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
  app.use(helmet());

  app.setGlobalPrefix('api');

  // CORS: support comma-separated origins
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  // Request body size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
}
