import { forwardRef, Inject } from '@nestjs/common';
import { AttemptStatus } from '@prisma/client';
import { Activity, Room as WCIFRoom, Venue } from '@wca/helpers';
import { DbService } from 'src/db/db.service';
import { getEventShortName } from 'src/events';
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
            status: AttemptStatus.SCRAMBLED,
          },
          {
            sessionId: null,
          },
        ],
      },
    });
    //This is there until we're still using scorecards ;D
    const scorecardsCount = await this.prisma.result.count();
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
      }
      byRoundStats.push({
        id: day.getTime(),
        date: day,
        roundsStatistics: roundsForDay,
      });
    }
    return {
      allAttempts,
      byEventStats,
      byRoundStats,
      attemptsByDevice: devices.map((device) => ({
        deviceId: device.id,
        deviceName: device.name,
        count:
          attemptsByDevice.find((a) => a.deviceId === device.id)?._count
            ?._all || 0,
      })),
      attemptsEnteredManually,
      scorecardsCount,
      personsCompeted,
    };
  }
}
