import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SyncService } from '../competition/sync.service';
import { DbService } from '../db/db.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let dbService: DbService;
  let syncService: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: DbService,
          useValue: {
            unofficialEvent: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            result: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: SyncService,
          useValue: {
            addUnofficialEventsToWcif: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    dbService = module.get<DbService>(DbService);
    syncService = module.get<SyncService>(SyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllEvents', () => {
    it('should return all events', () => {
      const result = service.getAllEvents();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUnofficialEvents', () => {
    it('should return all unofficial events', async () => {
      const mockEvents = [
        { id: 'event1', eventId: '333custom', wcif: {} },
        { id: 'event2', eventId: '444custom', wcif: {} },
      ];
      jest
        .spyOn(dbService.unofficialEvent, 'findMany')
        .mockResolvedValue(mockEvents as any);

      const result = await service.getUnofficialEvents();

      expect(result).toEqual(mockEvents);
      expect(dbService.unofficialEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('createUnofficialEvent', () => {
    it('should create a new unofficial event', async () => {
      const eventData = {
        eventId: '333custom',
        rounds: [{ id: 'round1', format: 'a' }],
      };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(null);
      jest
        .spyOn(dbService.unofficialEvent, 'create')
        .mockResolvedValue({} as any);
      jest.spyOn(syncService, 'addUnofficialEventsToWcif').mockResolvedValue();

      const result = await service.createUnofficialEvent(eventData);

      expect(result).toEqual({
        message: 'Unofficial event created successfully.',
      });
      expect(dbService.unofficialEvent.create).toHaveBeenCalledWith({
        data: {
          eventId: '333custom',
          wcif: {
            id: '333custom',
            rounds: eventData.rounds,
            extensions: [],
            qualification: null,
          },
        },
      });
      expect(syncService.addUnofficialEventsToWcif).toHaveBeenCalled();
    });

    it('should throw error if unofficial event already exists', async () => {
      const eventData = {
        eventId: '333custom',
        rounds: [{ id: 'round1', format: 'a' }],
      };
      const existingEvent = { id: 'event1', eventId: '333custom' };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(existingEvent as any);

      await expect(service.createUnofficialEvent(eventData)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('updateUnofficialEvent', () => {
    it('should update an unofficial event', async () => {
      const eventId = 'event1';
      const updateData = {
        wcif: {
          id: '333custom',
          rounds: [{ id: 'round1', format: 'a' }],
          extensions: [],
          qualification: null,
        },
      };
      const existingEvent = { id: eventId, eventId: '333custom' };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(existingEvent as any);
      jest
        .spyOn(dbService.unofficialEvent, 'update')
        .mockResolvedValue({} as any);
      jest.spyOn(syncService, 'addUnofficialEventsToWcif').mockResolvedValue();

      const result = await service.updateUnofficialEvent(eventId, updateData);

      expect(result).toEqual({
        message: 'Unofficial event updated successfully.',
      });
      expect(dbService.unofficialEvent.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: { wcif: updateData.wcif },
      });
      expect(syncService.addUnofficialEventsToWcif).toHaveBeenCalled();
    });

    it('should throw error if unofficial event does not exist', async () => {
      const eventId = 'nonexistent';
      const updateData = { wcif: {} };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(null);

      await expect(
        service.updateUnofficialEvent(eventId, updateData),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteUnofficialEvent', () => {
    it('should delete an unofficial event', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, eventId: '333custom' };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(existingEvent as any);
      jest.spyOn(dbService.result, 'findFirst').mockResolvedValue(null);
      jest
        .spyOn(dbService.unofficialEvent, 'delete')
        .mockResolvedValue({} as any);
      jest.spyOn(syncService, 'addUnofficialEventsToWcif').mockResolvedValue();

      const result = await service.deleteUnofficialEvent(eventId);

      expect(result).toEqual({
        message: 'Unofficial event deleted successfully.',
      });
      expect(dbService.unofficialEvent.delete).toHaveBeenCalledWith({
        where: { id: eventId },
      });
      expect(syncService.addUnofficialEventsToWcif).toHaveBeenCalled();
    });

    it('should throw error if unofficial event does not exist', async () => {
      const eventId = 'nonexistent';

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(null);

      await expect(service.deleteUnofficialEvent(eventId)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw error if unofficial event has results', async () => {
      const eventId = 'event1';
      const existingEvent = { id: eventId, eventId: '333custom' };
      const mockResult = { id: 'result1', eventId: '333custom' };

      jest
        .spyOn(dbService.unofficialEvent, 'findFirst')
        .mockResolvedValue(existingEvent as any);
      jest
        .spyOn(dbService.result, 'findFirst')
        .mockResolvedValue(mockResult as any);

      await expect(service.deleteUnofficialEvent(eventId)).rejects.toThrow(
        HttpException,
      );
    });
  });
});
