import { INestApplication, ValidationPipe } from '@nestjs/common';
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

  // Body parsing is handled by NestJS (ExpressAdapter) by default with a 100kb limit.
  // Do NOT add express.json() / express.urlencoded() here — in Lambda,
  // @codegenie/serverless-express pre-parses the body from the API Gateway event,
  // and adding another body parser causes "stream is not readable" errors.
  // To increase the limit, use NestFactory.create(AppModule, { bodyParser: true }) or
  // rawBody options instead.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
}
