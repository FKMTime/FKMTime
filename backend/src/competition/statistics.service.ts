import { forwardRef, Inject } from '@nestjs/common';
import { AttemptStatus, DeviceType } from '@prisma/client';
import { DNS_VALUE } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { getEventShortName } from 'src/events';
import { Activity, Room as WCIFRoom, Venue } from 'wcif-helpers';
import { getActivityInfoFromSchedule, getCompetitionDates } from 'wcif-helpers';

export class StatisticsService {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
  ) {}

  async getCompetitionStatistics() {
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const allAttempts = await this.prisma.attempt.count({
      where: {
        status: {
          not: AttemptStatus.SCRAMBLED,
        },
      },
    });
    const attemptsEnteredManually = await this.prisma.attempt.count({
      where: {
        AND: [
          {
            status: {
              not: AttemptStatus.SCRAMBLED,
            },
          },
          {
            sessionId: null,
          },
          {
            penalty: {
              not: DNS_VALUE,
            },
          },
        ],
      },
    });
    //This is there until we're still using scorecards ;D
    const scorecardsCount = await this.prisma.result.count();
    const scramblerGroups = await this.prisma.attempt.groupBy({
      by: ['scramblerId'],
      where: { scramblerId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { scramblerId: 'desc' } },
    });
    const scramblerRanking = await Promise.all(
      scramblerGroups.map(async (g) => {
        const person = await this.prisma.person.findUnique({
          where: { id: g.scramblerId },
          select: { name: true },
        });
        return { personName: person?.name ?? 'Unknown', count: g._count._all };
      }),
    );
    const judgeGroups = await this.prisma.attempt.groupBy({
      by: ['judgeId'],
      where: { judgeId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { judgeId: 'desc' } },
    });
    const judgeRanking = await Promise.all(
      judgeGroups.map(async (g) => {
        const person = await this.prisma.person.findUnique({
          where: { id: g.judgeId },
          select: { name: true },
        });
        const judgedAttempts = await this.prisma.attempt.findMany({
          where: { judgeId: g.judgeId },
          select: {
            result: {
              select: { personId: true, person: { select: { name: true } } },
            },
          },
        });
        const competitorCounts = new Map<
          string,
          { name: string; count: number }
        >();
        for (const a of judgedAttempts) {
          const personId = a.result.personId;
          const entry = competitorCounts.get(personId) ?? {
            name: a.result.person.name,
            count: 0,
          };
          entry.count++;
          competitorCounts.set(personId, entry);
        }
        let topCompetitorCount = 0;
        let topCompetitorName: string | undefined;
        for (const v of competitorCounts.values()) {
          if (v.count > topCompetitorCount) {
            topCompetitorCount = v.count;
            topCompetitorName = v.name;
          }
        }
        return {
          personName: person?.name ?? 'Unknown',
          count: g._count._all,
          topCompetitorCount,
          topCompetitorName,
        };
      }),
    );
    const extraAttemptsUsed = await this.prisma.attempt.count({
      where: {
        type: 'EXTRA_ATTEMPT',
        status: AttemptStatus.STANDARD,
      },
    });
    const personsCompeted = await this.prisma.person.count({
      where: {
        results: {
          some: {},
        },
      },
    });
    const days = getCompetitionDates(
      new Date(wcif.schedule.startDate),
      wcif.schedule.numberOfDays,
    );
    const eventIds = await this.prisma.result.findMany({
      select: {
        eventId: true,
      },
      distinct: ['eventId'],
    });
    const devices = await this.prisma.device.findMany();
    const attemptsByDevice = await this.prisma.attempt.groupBy({
      by: ['deviceId'],
      _count: {
        _all: true,
      },
    });
    const byEventStats = [];
    const byRoundStats = [];
    for (const eventId of eventIds) {
      const dnf = await this.prisma.attempt.count({
        where: {
          penalty: -1,
          result: {
            eventId: eventId.eventId,
          },
        },
      });
      const attempts = await this.prisma.attempt.count({
        where: {
          result: {
            eventId: eventId.eventId,
          },
        },
      });

      const incidents = await this.prisma.attempt.count({
        where: {
          result: {
            eventId: eventId.eventId,
          },
          OR: [
            {
              status: AttemptStatus.EXTRA_GIVEN,
            },
            {
              status: AttemptStatus.RESOLVED,
            },
          ],
        },
      });

      byEventStats.push({
        eventId: eventId.eventId,
        eventName: getEventShortName(eventId.eventId),
        dnf: dnf,
        attempts: attempts,
        incidents: incidents,
      });
    }
    for (const day of days) {
      const activities = [];
      wcif.schedule.venues.forEach((venue: Venue) => {
        venue.rooms.forEach((room: WCIFRoom) => {
          room.activities.forEach((activity: Activity) => {
            if (new Date(activity.startTime).getDay() === day.getDay()) {
              activities.push(activity);
            }
          });
        });
      });
      activities.sort((a, b) => {
        return (
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      });
      const roundsForDay = [];
      for (const round of activities) {
        const firstResult = await this.prisma.attempt.findFirst({
          where: {
            result: {
              roundId: round.activityCode,
            },
          },
          orderBy: {
            solvedAt: 'asc',
          },
        });
        const activityFromSchedule: Activity = getActivityInfoFromSchedule(
          round.activityCode,
          wcif,
        );
        if (!firstResult || !activityFromSchedule) {
          continue;
        }
        const startTime = new Date(activityFromSchedule.startTime);
        const delay =
          new Date(firstResult.solvedAt).getTime() - startTime.getTime();
        roundsForDay.push({
          roundId: round.activityCode,
          roundName: `${getEventShortName(round.activityCode.split('-r')[0])} - R${round.activityCode.split('-r')[1]}`,
          delayInMinutes: (delay / 60000).toFixed(2),
        });
        const lastResult = await this.prisma.attempt.findFirst({
          where: {
            result: {
              roundId: round.activityCode,
            },
            sessionId: {
              not: {
                equals: null,
              },
            },
            penalty: {
              not: {
                equals: -2,
              },
            },
          },
          orderBy: {
            solvedAt: 'desc',
          },
        });
        if (lastResult) {
          const endTime = new Date(activityFromSchedule.endTime);
          const delayEnd =
            new Date(lastResult.solvedAt).getTime() - endTime.getTime();
          roundsForDay.push({
            roundId: round.activityCode,
            roundName: `${getEventShortName(round.activityCode.split('-r')[0])} - R${round.activityCode.split('-r')[1]} (end)`,
            delayInMinutes: (delayEnd / 60000).toFixed(2),
          });
        }
      }
      byRoundStats.push({
        id: day.getTime(),
        date: day,
        roundsStatistics: roundsForDay,
      });
    }
    const allResults = await this.prisma.result.findMany({
      select: {
        roundId: true,
        person: { select: { name: true } },
        attempts: {
          where: {
            status: { not: AttemptStatus.SCRAMBLED },
            penalty: { not: DNS_VALUE },
            deviceId: { not: null },
            judgeId: { not: null },
          },
          select: {
            deviceId: true,
            judgeId: true,
            device: { select: { name: true } },
            judge: { select: { name: true } },
          },
        },
      },
    });
    const suspiciousAverages = allResults
      .filter((r) => {
        if (r.attempts.length < 2) return false;
        const d = new Set(r.attempts.map((a) => a.deviceId));
        const judges = new Set(r.attempts.map((a) => a.judgeId));
        return d.size === 1 && judges.size === 1;
      })
      .map((r) => ({
        competitorName: r.person.name,
        roundName: `${getEventShortName(r.roundId.split('-r')[0])} - R${r.roundId.split('-r')[1]}`,
        judgeName: r.attempts[0].judge?.name,
        stationName: r.attempts[0].device?.name,
        attemptCount: r.attempts.length,
      }));

    return {
      allAttempts,
      byEventStats,
      byRoundStats,
      attemptsByDevice: devices
        .filter((d) => d.type === DeviceType.STATION)
        .map((device) => ({
          deviceId: device.id,
          deviceName: device.name,
          count:
            attemptsByDevice.find((a) => a.deviceId === device.id)?._count
              ?._all || 0,
        })),
      attemptsEnteredManually,
      extraAttemptsUsed,
      judgeRanking,
      scramblerRanking,
      suspiciousAverages,
      scorecardsCount,
      personsCompeted,
    };
  }
}
