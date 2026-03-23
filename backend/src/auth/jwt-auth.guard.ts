import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type JwtPayload = {
  sub: string;
  tenantId: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
};

type RequestWithAuth = Request & {
  authUser?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = await this.jwtService
      .verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      })
      .catch(() => null);

    if (!payload?.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid token');
    }

    request.authUser = payload;
    return true;
  }
}
