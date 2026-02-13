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
});
