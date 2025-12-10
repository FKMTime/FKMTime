import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { DbService } from '../db/db.service';
import { WcaService } from '../wca/wca.service';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let dbService: DbService;
  let wcaService: WcaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DbService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: WcaService,
          useValue: {
            getUserInfoByWcaId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    dbService = module.get<DbService>(DbService);
    wcaService = module.get<WcaService>(WcaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [
        {
          id: 'user1',
          username: 'testuser',
          fullName: 'Test User',
          roles: [Role.ORGANIZER],
          wcaUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          avatarUrl: null,
        },
      ];
      jest
        .spyOn(dbService.user, 'findMany')
        .mockResolvedValue(mockUsers as any);

      const result = await service.getAllUsers();

      expect(result).toEqual(mockUsers);
      expect(dbService.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          username: true,
          fullName: true,
          roles: true,
          wcaUserId: true,
          createdAt: true,
          updatedAt: true,
          avatarUrl: true,
        },
        orderBy: {
          username: 'asc',
        },
      });
    });
  });

  describe('createUser', () => {
    it('should create a user with WCA ID', async () => {
      const userData = {
        fullName: 'WCA User',
        wcaId: '123',
        username: undefined,
        password: undefined,
        roles: [Role.ORGANIZER],
      };
      const currentUserId = 'admin1';
      const mockWcaUser = { user: { id: 123, name: 'WCA User' } };

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);
      jest
        .spyOn(wcaService, 'getUserInfoByWcaId')
        .mockResolvedValue(mockWcaUser as any);
      jest.spyOn(dbService.user, 'create').mockResolvedValue({} as any);

      const result = await service.createUser(userData, currentUserId);

      expect(result).toEqual({ message: 'User created successfully' });
      expect(wcaService.getUserInfoByWcaId).toHaveBeenCalledWith('123');
      expect(dbService.user.create).toHaveBeenCalled();
    });

    it('should create a user with username and password', async () => {
      const userData = {
        fullName: 'Local User',
        username: 'localuser',
        password: 'password123',
        wcaId: undefined,
        roles: [Role.ORGANIZER],
      };
      const currentUserId = 'admin1';

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);
      jest.spyOn(dbService.user, 'create').mockResolvedValue({} as any);

      const result = await service.createUser(userData, currentUserId);

      expect(result).toEqual({ message: 'User created successfully' });
      expect(dbService.user.create).toHaveBeenCalled();
    });

    it('should throw error if username is provided without password', async () => {
      const userData = {
        fullName: 'Local User',
        username: 'localuser',
        wcaId: undefined,
        password: undefined,
        roles: [Role.ORGANIZER],
      };
      const currentUserId = 'admin1';

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);

      await expect(service.createUser(userData, currentUserId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error if trying to assign higher roles', async () => {
      const userData = {
        fullName: 'User',
        username: 'user',
        password: 'password',
        wcaId: undefined,
        roles: [Role.ADMIN],
      };
      const currentUserId = 'organizer1';

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ORGANIZER] } as any);

      await expect(service.createUser(userData, currentUserId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error if username is already taken', async () => {
      const userData = {
        fullName: 'User',
        username: 'existinguser',
        password: 'password',
        wcaId: undefined,
        roles: [Role.ORGANIZER],
      };
      const currentUserId = 'admin1';

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);
      jest.spyOn(dbService.user, 'create').mockRejectedValue(prismaError);

      await expect(service.createUser(userData, currentUserId)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      const updateData = {
        username: 'updateduser',
        fullName: 'Updated User',
        roles: [Role.ORGANIZER],
      };
      const currentUserId = 'admin1';
      const targetUserId = 'user1';

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);
      jest.spyOn(dbService.user, 'update').mockResolvedValue({} as any);

      const result = await service.updateUser(
        targetUserId,
        updateData,
        currentUserId,
      );

      expect(result).toEqual({ message: 'User updated successfully' });
      expect(dbService.user.update).toHaveBeenCalledWith({
        where: { id: targetUserId },
        data: {
          username: updateData.username,
          fullName: updateData.fullName,
          roles: updateData.roles,
        },
      });
    });

    it('should throw error if trying to assign higher roles', async () => {
      const updateData = {
        username: 'user',
        fullName: 'User',
        roles: [Role.ADMIN],
      };
      const currentUserId = 'organizer1';
      const targetUserId = 'user1';

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ORGANIZER] } as any);

      await expect(
        service.updateUser(targetUserId, updateData, currentUserId),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const userId = 'user1';
      const newPassword = 'newpassword123';

      jest.spyOn(dbService.user, 'update').mockResolvedValue({} as any);

      await service.updatePassword(userId, newPassword);

      expect(dbService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password: expect.any(String),
        },
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      const userId = 'user1';

      jest.spyOn(dbService.user, 'delete').mockResolvedValue({} as any);

      await service.deleteUser(userId);

      expect(dbService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });
  });

  describe('getFilteredRoles', () => {
    it('should return all roles for admin', async () => {
      const userId = 'admin1';
      const roles = [Role.ADMIN, Role.DELEGATE, Role.ORGANIZER];

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ADMIN] } as any);

      const result = await service.getFilteredRoles(userId, roles);

      expect(result).toEqual(roles);
    });

    it('should filter out admin role for delegate', async () => {
      const userId = 'delegate1';
      const roles = [Role.ADMIN, Role.DELEGATE, Role.ORGANIZER];

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.DELEGATE] } as any);

      const result = await service.getFilteredRoles(userId, roles);

      expect(result).toEqual([Role.DELEGATE, Role.ORGANIZER]);
    });

    it('should filter out admin and delegate roles for organizer', async () => {
      const userId = 'organizer1';
      const roles = [Role.ADMIN, Role.DELEGATE, Role.ORGANIZER];

      jest
        .spyOn(dbService.user, 'findUnique')
        .mockResolvedValue({ roles: [Role.ORGANIZER] } as any);

      const result = await service.getFilteredRoles(userId, roles);

      expect(result).toEqual([Role.ORGANIZER]);
    });

    it('should return empty array if user not found', async () => {
      const userId = 'nonexistent';
      const roles = [Role.ORGANIZER];

      jest.spyOn(dbService.user, 'findUnique').mockResolvedValue(null);

      const result = await service.getFilteredRoles(userId, roles);

      expect(result).toEqual([]);
    });
  });
});
