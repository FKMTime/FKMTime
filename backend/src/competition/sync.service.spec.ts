import { SyncService } from './sync.service';

describe('SyncService', () => {
  describe('addUnofficialEventsToWcif', () => {
    it('does not overwrite official FTO with a legacy unofficial event', async () => {
      const prisma = {
        unofficialEvent: {
          findMany: jest.fn().mockResolvedValue([
            { eventId: 'fto', wcif: { id: 'fto', source: 'legacy' } },
            { eventId: 'mirror', wcif: { id: 'mirror', source: 'local' } },
          ]),
        },
        competition: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'competition-1',
            wcif: {
              events: [
                { id: 'fto', source: 'WCA' },
                { id: 'mirror', source: 'stale' },
              ],
            },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new SyncService(prisma as never, {} as never);

      await service.addUnofficialEventsToWcif();

      expect(prisma.competition.update).toHaveBeenCalledWith({
        where: { id: 'competition-1' },
        data: {
          wcif: {
            events: [
              { id: 'fto', source: 'WCA' },
              { id: 'mirror', source: 'local' },
            ],
          },
        },
      });
    });
  });
});
