import { Test, TestingModule } from '@nestjs/testing';

import { DbService } from '../db/db.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let dbService: DbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: DbService,
          useValue: {
            user: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            quickAction: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    dbService = module.get<DbService>(DbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return user settings', async () => {
      const mockUser = {
        username: 'testuser',
        roles: [],
        wcaUserId: 123,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(dbService.user, 'findFirst')
        .mockResolvedValue(mockUser as any);

      const result = await service.getSettings('user123');

      expect(result).toEqual(mockUser);
      expect(dbService.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user123' },
        select: {
          username: true,
          roles: true,
          wcaUserId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('updateSettings', () => {
    it('should update user settings', async () => {
      const updateData = {
        username: 'newusername',
        notificationToken: 'token123',
      };
      const mockUpdatedUser = {
        username: 'newusername',
        roles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jest
        .spyOn(dbService.user, 'update')
        .mockResolvedValue(mockUpdatedUser as any);

      const result = await service.updateSettings('user123', updateData);

      expect(result).toEqual(mockUpdatedUser);
      expect(dbService.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: updateData,
        select: {
          username: true,
          roles: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });
  });

  describe('getMyQuickActions', () => {
    it('should return quick actions for user', async () => {
      const mockQuickActions = [
        {
          id: 'qa1',
          name: 'Quick Action 1',
          userId: 'user123',
          user: { id: 'user123', fullName: 'Test User' },
        },
      ];
      jest
        .spyOn(dbService.quickAction, 'findMany')
        .mockResolvedValue(mockQuickActions as any);

      const result = await service.getMyQuickActions('user123');

      expect(result).toEqual(mockQuickActions);
      expect(dbService.quickAction.findMany).toHaveBeenCalledWith({
        where: { OR: [{ userId: 'user123' }, { isShared: true }] },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });
  });

  describe('createQuickAction', () => {
    it('should create a new quick action', async () => {
      const quickActionData = {
        name: 'New Action',
        comment: 'Test comment',
        giveExtra: true,
        isShared: false,
      };
      const mockCreatedAction = {
        id: 'qa1',
        ...quickActionData,
        userId: 'user123',
      };
      jest
        .spyOn(dbService.quickAction, 'create')
        .mockResolvedValue(mockCreatedAction as any);

      const result = await service.createQuickAction(
        'user123',
        quickActionData,
      );

      expect(result).toEqual(mockCreatedAction);
      expect(dbService.quickAction.create).toHaveBeenCalledWith({
        data: {
          ...quickActionData,
          user: {
            connect: {
              id: 'user123',
            },
          },
        },
      });
    });
  });

  describe('updateQuickAction', () => {
    it('should update a quick action', async () => {
      const quickActionData = {
        name: 'Updated Action',
        comment: 'Updated comment',
        giveExtra: false,
        isShared: true,
      };
      const mockUpdatedAction = {
        id: 'qa1',
        ...quickActionData,
      };
      jest
        .spyOn(dbService.quickAction, 'update')
        .mockResolvedValue(mockUpdatedAction as any);

      const result = await service.updateQuickAction(
        'user123',
        'qa1',
        quickActionData,
      );

      expect(result).toEqual(mockUpdatedAction);
      expect(dbService.quickAction.update).toHaveBeenCalledWith({
        where: { id: 'qa1', OR: [{ userId: 'user123' }, { isShared: true }] },
        data: quickActionData,
      });
    });
  });

  describe('deleteQuickAction', () => {
    it('should delete a quick action', async () => {
      const mockDeletedAction = {
        id: 'qa1',
        name: 'Deleted Action',
      };
      jest
        .spyOn(dbService.quickAction, 'delete')
        .mockResolvedValue(mockDeletedAction as any);

      const result = await service.deleteQuickAction('user123', 'qa1');

      expect(result).toEqual(mockDeletedAction);
      expect(dbService.quickAction.delete).toHaveBeenCalledWith({
        where: { id: 'qa1', OR: [{ userId: 'user123' }, { isShared: true }] },
      });
    });
  });
});
