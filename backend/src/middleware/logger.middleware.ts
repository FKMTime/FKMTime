import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthService } from 'src/auth/auth.service';

const SENSITIVE_PATHS = ['/auth/', '/scrambling'];

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  private logger = new Logger(`HTTP`);

  async use(req: any, res: Response, next: NextFunction) {
    const url: string = req.originalUrl;

    if (url.includes('health')) {
      return next();
    }

    const isSensitive = SENSITIVE_PATHS.some((p) => url.includes(p));

    if (req.headers.authorization) {
      if (req.headers.authorization.startsWith('Bearer ')) {
        try {
          const user = await this.authService.validateJwt(
            req.headers.authorization.split(' ')[1],
          );
          this.logger.log(`${req.method} ${url} user=${user.userId}`);
        } catch {
          this.logger.log(`${req.method} ${url} [invalid token]`);
        }
      } else {
        // Token / API-key paths — log method + path only, never the credential value
        this.logger.log(`${req.method} ${url} [token auth]`);
      }
    } else if (!isSensitive) {
      // Unauthenticated, non-sensitive route — log after response, no body
      res.on('close', () => {
        this.logger.log(`${req.method} ${url} ${res.statusCode}`);
      });
    }

    next();
  }
}
