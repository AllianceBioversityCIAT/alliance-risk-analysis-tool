import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CognitoService } from '../src/auth/cognito.service';
import { ConfigModule } from '@nestjs/config';

describe('AuthController (e2e) - Throttling', () => {
  let app: INestApplication;
  const mockCognitoService = {
    login: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // Global configuration (will be overridden by decorator on specific endpoints)
        ThrottlerModule.forRoot([{
          ttl: 60000,
          limit: 100,
        }]),
        AuthModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    })
      .overrideProvider(CognitoService)
      .useValue(mockCognitoService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login (POST) - should throttle after 5 requests', async () => {
    mockCognitoService.login.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
    });

    const payload = { email: 'test@example.com', password: 'test-password' };

    // The decorator on login() sets limit to 5
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload)
        .expect(200);
    }

    // 6th request should fail with 429 Too Many Requests
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(payload)
      .expect(429);
  });
});
