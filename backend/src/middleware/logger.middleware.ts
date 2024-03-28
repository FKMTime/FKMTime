import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  private logger = new Logger(`HTTP`);

  async use(req: any, res: Response, next: NextFunction) {
    const baseUrl = req.baseUrl;
    if (req.headers.authorization) {
      if (req.headers.authorization.startsWith('Bearer ')) {
        const user = await this.authService.validateJwt(
          req.headers.authorization.split(' ')[1],
        );
        res.on('close', () => {
          this.logger.log(
            `Logging HTTP request from user ${user.userId} ${req.method} ${baseUrl} ${res.statusCode}`,
          );
        });
      } else if (req.headers.authorization.startsWith('Token ')) {
        res.on('close', () => {
          this.logger.log(
            `Logging HTTP request with API token ${req.method} ${baseUrl} ${
              res.statusCode
            } body: ${JSON.stringify(req.body)}`,
          );
        });
      } else {
        res.on('close', () => {
          this.logger.log(
            `Logging HTTP request ${req.method} ${baseUrl} ${
              res.statusCode
            } body: ${JSON.stringify(req.body)}`,
          );
        });
      }
      next();
    }
  }
}
