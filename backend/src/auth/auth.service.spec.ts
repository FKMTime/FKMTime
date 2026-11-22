import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { WcaService } from '../wca/wca.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let dbService: DbService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DbService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            competition: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: WcaService,
          useValue: {
            getAccessToken: jest.fn(),
            getUserInfo: jest.fn(),
            getUpcomingManageableCompetitions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    dbService = module.get<DbService>(DbService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAuthJwt', () => {
    it('should generate a JWT token', async () => {
      const payload = { userId: 'user123', roles: [] };
      const mockToken = 'mock.jwt.token';
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const result = await service.generateAuthJwt(payload);

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith(payload);
    });
  });

  describe('userExists', () => {
    it('should return user if exists', async () => {
      const mockUser = { id: 'user123', username: 'testuser' };
      jest
        .spyOn(dbService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);

      const result = await service.userExists('user123');

      expect(result).toEqual(mockUser);
      expect(dbService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user123' },
      });
    });

    it('should return null if user does not exist', async () => {
      jest.spyOn(dbService.user, 'findFirst').mockResolvedValue(null);

      const result = await service.userExists('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserInfo', () => {
    it('should return user info', async () => {
      const mockUserInfo = {
        id: 'user123',
        username: 'testuser',
        fullName: 'Test User',
        roles: [],
        wcaAccessToken: null,
        avatarUrl: null,
      };
      jest
        .spyOn(dbService.user, 'findFirst')
        .mockResolvedValue(mockUserInfo as any);

      const result = await service.getUserInfo('user123');

      expect(result).toEqual(mockUserInfo);
      expect(dbService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user123' },
        select: {
          id: true,
          username: true,
          fullName: true,
          roles: true,
          wcaAccessToken: true,
          avatarUrl: true,
        },
      });
    });
  });

  describe('ending sessions on a password change', () => {
    it('refuses a token issued before the password changed', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ userId: 'u1', tokenVersion: 0 } as any);
      jest
        .spyOn(dbService.user, 'findFirst')
        .mockResolvedValue({ id: 'u1', roles: [], tokenVersion: 1 } as any);

      await expect(service.validateJwt('old-token')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('treats a token without a version as version 0', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue({ userId: 'u1', exp: 123 } as any);
      jest
        .spyOn(dbService.user, 'findFirst')
        .mockResolvedValue({ id: 'u1', roles: [], tokenVersion: 0 } as any);

      await expect(service.validateJwt('token')).resolves.toEqual({
        userId: 'u1',
        roles: [],
        tokenVersion: 0,
        exp: 123,
      });
    });

    it('refuses a password change for a user deleted meanwhile', async () => {
      jest.spyOn(dbService.user, 'findFirst').mockResolvedValue(null);

      await expect(
        service.changePassword('u1', 'old-password', 'new-password'),
      ).rejects.toMatchObject({ status: 401 });
      expect(dbService.user.update).not.toHaveBeenCalled();
    });

    it('bumps the version and hands this session a fresh token', async () => {
      const bcrypt = await import('bcrypt');
      jest.spyOn(dbService.user, 'findFirst').mockResolvedValue({
        id: 'u1',
        password: await bcrypt.hash('old-password', 4),
      } as any);
      jest.spyOn(dbService.user, 'update').mockResolvedValue({
        id: 'u1',
        roles: [],
        tokenVersion: 3,
      } as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('fresh-token');

      const result = await service.changePassword(
        'u1',
        'old-password',
        'new-password',
      );

      expect(dbService.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          password: expect.any(String),
          tokenVersion: { increment: 1 },
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: 'u1',
        roles: [],
        tokenVersion: 3,
      });
      expect(result).toEqual({
        message: 'Password changed',
        token: 'fresh-token',
      });
    });
  });
});
