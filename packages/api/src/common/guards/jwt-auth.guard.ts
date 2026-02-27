import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

export interface TokenClaims {
  userId: string;   // Cognito sub claim (from token)
  email: string;
  username: string;
  isAdmin: boolean;
}

export interface UserClaims {
  userId: string;   // DB internal UUID (users.id)
  cognitoId: string; // Cognito sub claim
  email: string;
  username: string;
  isAdmin: boolean;
}

export interface CognitoVerifier {
  verifyToken(token: string): Promise<TokenClaims>;
}

export const COGNITO_VERIFIER = 'COGNITO_VERIFIER';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject(COGNITO_VERIFIER) private cognitoVerifier: CognitoVerifier,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: UserClaims }>();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    try {
      const claims = await this.cognitoVerifier.verifyToken(token);
      const cognitoId = claims.userId; // TokenClaims.userId is the Cognito sub

      // Upsert user in DB so FK references are always valid
      const dbUser = await this.prisma.user.upsert({
        where: { cognitoId },
        create: { cognitoId, email: claims.email || cognitoId },
        update: { email: claims.email || cognitoId },
        select: { id: true },
      });

      request.user = {
        userId: dbUser.id,    // DB internal UUID used for FK relations
        cognitoId,
        email: claims.email,
        username: claims.username,
        isAdmin: claims.isAdmin,
      };
      return true;
    } catch (error) {
      this.logger.error(
        `Auth guard failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
