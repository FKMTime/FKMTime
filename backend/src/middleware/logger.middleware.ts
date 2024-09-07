import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  private logger = new Logger(`HTTP`);

  async use(req: any, res: Response, next: NextFunction) {
    if (req.headers.authorization) {
      if (req.headers.authorization.startsWith('Bearer ')) {
        const user = await this.authService.validateJwt(
          req.headers.authorization.split(' ')[1],
        );
        this.logger.log(
          `Logging HTTP request ${req.method} ${req.originalUrl} ${res.statusCode} from user ${user.userId}`,
        );
      } else {
        this.logger.log(
          `Logging HTTP request ${req.method} ${req.originalUrl} ${res.statusCode} with API Token ${req.method !== 'GET' ? JSON.stringify(req.body) : ''}`,
        );
      }
    } else {
      const originalUrl = req.originalUrl;
      if (originalUrl.includes('health') || originalUrl.includes('login')) {
        return next();
      }
      res.on('close', () => {
        this.logger.log(
          `Logging HTTP request from ${req.method} ${originalUrl} ${
            res.statusCode
          } body: ${JSON.stringify(req.body)}`,
        );
      });
    }
    next();
  }
}
