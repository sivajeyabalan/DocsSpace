import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type AttemptWindow = {
  count: number;
  expiresAt: number;
};

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, AttemptWindow>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.resolveClientIp(request);
    const now = Date.now();
    const current = this.windows.get(ip);

    if (!current || current.expiresAt <= now) {
      this.windows.set(ip, { count: 1, expiresAt: now + WINDOW_MS });
      return true;
    }

    if (current.count >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many login attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.windows.set(ip, current);
    return true;
  }

  private resolveClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0];
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }
}
