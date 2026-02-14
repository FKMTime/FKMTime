import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export const canActivateHelper = async (
  context: ExecutionContext,
  roles: string[],
  validateJwt,
) => {
  const req = context.switchToHttp().getRequest();
  let token = '';
  if (Object.prototype.hasOwnProperty.call(req, 'handshake')) {
    token = req.handshake.auth.token;
  }
  if (req && req.headers && req.headers.authorization) {
    token = req.headers.authorization.split(' ')[1];
  }
  const user = await validateJwt(token);
  return !(
    !user ||
    !roles.some(
      (role) =>
        user.roles.includes(role as Role) || user.roles.includes(Role.ADMIN),
    )
  );
};
