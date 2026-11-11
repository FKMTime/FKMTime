import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from 'src/auth/auth.service';
import { DbService } from 'src/db/db.service';

/** Prefix for usernames of throwaway users created by the setup/scrambling specs */
export const SETUP_USER_PREFIX = 'e2e-setup-';

export interface TestUser {
  id: string;
  username: string;
  token: string;
}

/**
 * Creates a user with the given roles directly in the DB and signs a JWT for
 * it, without going through the throttled login endpoint.
 */
export const createUserWithRoles = async (
  app: INestApplication,
  db: DbService,
  name: string,
  roles: Role[],
): Promise<TestUser> => {
  const username = `${SETUP_USER_PREFIX}${name}`;
  const user = await db.user.create({
    data: { username, fullName: `Test ${name}`, roles },
  });
  const token = await app
    .get(AuthService)
    .generateAuthJwt({ userId: user.id, roles: user.roles });
  return { id: user.id, username, token };
};

/** One user per role below ADMIN, keyed by role */
export const createRoleUsers = async (
  app: INestApplication,
  db: DbService,
  suffix: string,
): Promise<Record<Exclude<Role, 'ADMIN'>, TestUser>> => {
  const [ORGANIZER, DELEGATE, STAGE_LEADER, STAFF] = await Promise.all(
    [Role.ORGANIZER, Role.DELEGATE, Role.STAGE_LEADER, Role.STAFF].map((role) =>
      createUserWithRoles(app, db, `${role.toLowerCase()}-${suffix}`, [role]),
    ),
  );
  return { ORGANIZER, DELEGATE, STAGE_LEADER, STAFF };
};

export const deleteSetupUsers = async (db: DbService, suffix: string) => {
  await db.user.deleteMany({
    where: {
      username: { startsWith: SETUP_USER_PREFIX, endsWith: `-${suffix}` },
    },
  });
};
