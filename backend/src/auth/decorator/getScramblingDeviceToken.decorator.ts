import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetScramblingDeviceToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    let token = '';
    if (req && req.headers && req.headers.authorization) {
      token = req.headers.authorization.split('Token ')[1];
    }
    return token;
  },
);
