import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { formatCentiseconds } from '@wca/helpers';
import {
  publicPersonSelect,
  SHOW_SECONDARY_TEXT_HW_VERSIONS,
} from 'src/constants';
import { DbService } from 'src/db/db.service';
import { StoredWcifService } from 'src/db/storedWcif.service';
import { DeviceService } from 'src/device/device.service';
import { getStationGroupIds } from 'src/device/stationRounds';
import { isInTutorial, TUTORIAL_GROUP_ID } from 'src/device/tutorial';
import { eventsData, getMaxPenalty } from 'src/events';
import { isH2hRound } from 'src/h2h/h2hRound';
import { nextPointOf, readyMatchOf } from 'src/h2h/matchStore';
import {
  attemptTimeWithPenalty,
  checkCutoff,
  getCountingAttempts,
} from 'src/result/helpers';
import { ResultService } from 'src/result/result.service';
import {
  convertToLatin,
  getTranslation,
  isLocaleAvailable,
} from 'src/translations/translations';
import { WcaService } from 'src/wca/wca.service';
import { getMaxAttempts } from 'src/wcif-helpers';
import { Competition as WCIF } from 'wcif-helpers';
import {
  getGroupInfoByActivityId,
  getPersonFromWcif,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { Competition, HardwareVersion } from '../generated/prisma/client';
import { PersonService } from './person.service';

/**
 * Whether the station runs its own inspection for a group: the event's
 * setting, but never in a head-to-head round, where the announcer times
 * inspection for both competitors (I4c)
 */
const useInspectionFor = (groupId: string, wcif: WCIF) =>
  !isH2hRound(groupId.split('-g')[0], wcif) &&
  (eventsData.find((e) => e.id === groupId.split('-')[0])?.useInspection ??
    true);

interface H2hScanRefusal {
  key: 'h2hNoMatchInProgress' | 'h2hWaitingForDelegate';
  shouldResetTime: boolean;
}

@Injectable()
export class PersonForDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    private readonly wcaService: WcaService,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    private readonly storedWcif: StoredWcifService,
  ) {}

  async getPersonInfo(
    cardId: string,
    espId: number,
    isCompetitor: boolean = false,
  ) {
    // The WCIF comes parsed from StoredWcifService, not with the row
    const competition = await this.prisma.competition.findFirst({
      omit: { wcif: true },
    });
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', 'en'),
        shouldResetTime: true,
        status: 404,
        error: true,
        errorDetails: { key: 'competitionNotFound' },
      };
    }
    const person = await this.personService.getPersonByCardId(cardId);
    // Translations fall back to English for a missing locale, too
    const defaultLocale = competition.defaultLocale ?? 'en';
    if (!person) {
      return {
        message: getTranslation('competitorNotFound', defaultLocale),
        shouldResetTime: false,
        status: 404,
        error: true,
        errorDetails: { key: 'competitorNotFound', cardId },
      };
    }
    const device = await this.prisma.device.findFirst({
      where: {
        espId: espId,
        retiredAt: null,
      },
      include: {
        room: true,
      },
    });
    // A station in tutorial mode offers only the tutorial, to anyone with a
    // card: rounds, registration and attempts left don't apply (SPEC-012)
    if (device && isInTutorial(device)) {
      await this.deviceService.extendTutorial(device.id);
      return this.getTutorialPersonInfo(person, defaultLocale);
    }
    // An unregistered station offers no groups
    if (!device) {
      return {
        ...person,
        name: convertToLatin(person.name),
        possibleGroups: [],
      };
    }
    const wcif = await this.storedWcif.getOrThrow();
    // A station pointed at a round offers only that round (SPEC-007)
    const possibleGroups = getStationGroupIds(
      device,
      person.registrantId,
      wcif,
    );
    // Someone added on site has no registrant id, so no WCIF entry or
    // assignments: they can compete in what they're registered for here
    const competitorWcifInfo =
      person.registrantId === null
        ? undefined
        : getPersonFromWcif(person.registrantId, wcif);
    const competitorGroups = (competitorWcifInfo?.assignments ?? [])
      .filter((a) => a.assignmentCode === 'competitor')
      // An assignment to an activity the schedule doesn't have counts for none
      .flatMap(
        (a) => getGroupInfoByActivityId(a.activityId, wcif)?.activityCode ?? [],
      );
    const registeredEventIds: string[] =
      competitorWcifInfo?.registration?.eventIds ?? [];
    const finishedRoundsIds = await this.getFinishedRoundIds(
      person.id,
      competition,
      wcif,
    );

    // A head-to-head round takes a solve only into the competitor's playing
    // match (SPEC-001): told at the scan, before they solve
    const h2hRefusals = isCompetitor
      ? await this.h2hScanRefusals(possibleGroups, wcif, person.id)
      : new Map<string, H2hScanRefusal>();
    const refuse = (refusal: H2hScanRefusal) => ({
      message: getTranslation(refusal.key, person.countryIso2 ?? defaultLocale),
      shouldResetTime: refusal.shouldResetTime,
      status: 400,
      error: true,
      errorDetails: { key: refusal.key, competitorName: person.name },
    });

    if (possibleGroups.length === 1) {
      const currentRoundId = possibleGroups[0].split('-g')[0];
      const currentEventId = currentRoundId.split('-r')[0];
      const hasAssignmentForCurrentRound = competitorGroups.some(
        (g) => g.split('-g')[0] === currentRoundId,
      );
      const isRegisteredForCurrentEvent =
        registeredEventIds.includes(currentEventId);

      if (hasAssignmentForCurrentRound || isRegisteredForCurrentEvent) {
        if (isCompetitor) {
          const hasNoAttemptsLeft = hasAssignmentForCurrentRound
            ? !this.competitorHasAnyPossibleRounds(
                possibleGroups,
                competitorGroups,
                finishedRoundsIds,
              )
            : finishedRoundsIds.includes(currentRoundId);

          const h2hRefusal = h2hRefusals.get(currentRoundId);
          if (h2hRefusal) return refuse(h2hRefusal);
          if (hasNoAttemptsLeft) {
            return {
              message: getTranslation(
                'noAttemptsLeft',
                person.countryIso2 ?? defaultLocale,
              ),
              shouldResetTime: true,
              status: 400,
              error: true,
              errorDetails: {
                key: 'noAttemptsLeft',
                competitorName: person.name,
              },
            };
          }
        }
        return {
          ...person,
          name: convertToLatin(person.name),
          possibleGroups: await Promise.all(
            possibleGroups.map(async (g) => ({
              groupId: g,
              useInspection: useInspectionFor(g, wcif),
              maxPenalty: getMaxPenalty(g.split('-')[0]),
              ...(await this.computeSecondaryText(
                g,
                wcif,
                person.id,
                defaultLocale,
                device.hwVersion,
                cardId,
              )),
            })),
          ),
        };
      }
    }

    const finalGroups = possibleGroups
      .filter((g) => {
        const eventId = g.split('-')[0];
        return (
          competitorGroups.some(
            (group) =>
              group.split('-g')[0] === possibleGroups[0].split('-g')[0],
          ) ||
          eventsData.find((e) => e.id === eventId)?.isUnofficial ||
          registeredEventIds.includes(eventId)
        );
      })
      .filter((g) => !finishedRoundsIds.includes(g.split('-g')[0]));
    const offeredGroups = finalGroups.filter(
      (g) => !h2hRefusals.has(g.split('-g')[0]),
    );
    // Only head-to-head rounds were left, and none can take a solve now
    const [firstRefused] = finalGroups.flatMap(
      (g) => h2hRefusals.get(g.split('-g')[0]) ?? [],
    );
    if (offeredGroups.length === 0 && firstRefused) {
      return refuse(firstRefused);
    }
    const groups = offeredGroups.map(async (g) => {
      const eventId = g.split('-')[0];
      return {
        groupId: g,
        useInspection: useInspectionFor(g, wcif),
        maxPenalty: getMaxPenalty(eventId),
        ...(await this.computeSecondaryText(
          g,
          wcif,
          person.id,
          defaultLocale,
          device.hwVersion,
          cardId,
        )),
      };
    });
    return {
      ...person,
      name: convertToLatin(person.name),
      possibleGroups: await Promise.all(groups),
    };
  }

  /**
   * Why each head-to-head round among these groups can't take the
   * competitor's solve now, by round id: no playing match, or the next
   * point waits for an open incident. A station may let them solve before
   * scanning, so the time is kept only when their match is ready and the
   * stage leader just hasn't started it: it can go in once they have.
   */
  private async h2hScanRefusals(
    groupIds: string[],
    wcif: WCIF,
    personId: string,
  ) {
    const roundIds = [...new Set(groupIds.map((g) => g.split('-g')[0]))];
    const refusals = new Map<string, H2hScanRefusal>();
    for (const roundId of roundIds) {
      if (!isH2hRound(roundId, wcif)) continue;
      const next = await nextPointOf(this.prisma, roundId, personId);
      if (next?.waitingForDelegate) {
        refusals.set(roundId, {
          key: 'h2hWaitingForDelegate',
          shouldResetTime: true,
        });
      } else if (!next) {
        const ready = await readyMatchOf(this.prisma, roundId, personId);
        refusals.set(roundId, {
          key: 'h2hNoMatchInProgress',
          shouldResetTime: ready === null,
        });
      }
    }
    return refusals;
  }

  /** The person with the one tutorial group, labelled in their language */
  private getTutorialPersonInfo(
    person: NonNullable<
      Awaited<ReturnType<PersonService['getPersonByCardId']>>
    >,
    defaultLocale: string,
  ) {
    const country = person.countryIso2?.toLowerCase();
    const label: string = getTranslation(
      'tutorial',
      country && isLocaleAvailable(country) ? country : defaultLocale,
    );
    return {
      ...person,
      name: convertToLatin(person.name),
      possibleGroups: [
        {
          groupId: TUTORIAL_GROUP_ID,
          // Older stations show the name, V4 ones the secondary text
          name: label,
          secondaryText: label,
          useInspection: true,
          maxPenalty: getMaxPenalty('333'),
          limit: null as number | null,
        },
      ],
    };
  }

  private competitorHasAnyPossibleRounds(
    possibleGroups: string[],
    competitorGroups: string[],
    finishedRoundsIds: string[],
  ) {
    return possibleGroups.some(
      (g) =>
        competitorGroups.some((cg) => cg.split('-g')[0] === g.split('-g')[0]) &&
        !finishedRoundsIds.some((fr) => fr === g.split('-g')[0]),
    );
  }

  private async getFinishedRoundIds(
    personId: string,
    competition: Omit<Competition, 'wcif'>,
    wcif: WCIF,
  ) {
    const results = await this.prisma.result.findMany({
      where: {
        personId: personId,
      },
      select: {
        roundId: true,
        attempts: true,
        person: publicPersonSelect,
      },
    });
    const finishedRoundsIds: string[] = [];
    for (const result of results) {
      if (result.attempts.length === 0) {
        continue;
      }
      const roundInfo = getRoundInfoFromWcif(result.roundId, wcif);
      // A round the WCIF no longer has can't be finished in it
      if (!roundInfo) continue;
      // A head-to-head round ends with the competitor's matches, not after a
      // number of attempts (SPEC-001)
      if (isH2hRound(result.roundId, wcif)) continue;
      let maxAttempts = getMaxAttempts(roundInfo.format);
      if (roundInfo.cutoff) {
        const cutoffPassed = checkCutoff(
          getCountingAttempts(result.attempts),
          roundInfo.cutoff.resultValue,
          roundInfo.cutoff.numberOfAttempts,
        );
        if (!cutoffPassed) maxAttempts = roundInfo.cutoff.numberOfAttempts;
      }
      const submittedAttempts = this.wcaService.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      if (submittedAttempts.results[0].attempts.length === maxAttempts) {
        finishedRoundsIds.push(result.roundId);
      }
    }
    return finishedRoundsIds;
  }

  async computeSecondaryText(
    groupId: string | undefined,
    wcif: WCIF,
    personId: string,
    locale: string,
    hwVersion: HardwareVersion | null,
    cardId: string,
  ) {
    if (!groupId) return { name: '', secondaryText: '' };
    // Newer stations show a second line; one with no version shows the name
    const showsSecondaryText =
      hwVersion !== null && SHOW_SECONDARY_TEXT_HW_VERSIONS.includes(hwVersion);
    const roundId = groupId.split('-g')[0];
    const eventId = roundId.split('-r')[0];
    const roundNumber = roundId.split('-r')[1];
    const eventData = eventsData.find((e) => e.id === eventId);
    const eventName = eventData?.shortName ?? eventData?.name ?? eventId;
    const eventText = `${eventName} - R${roundNumber}`;
    const shortEventText = `${eventName} R${roundNumber}`;
    let limitToReturn: number | null = null;

    const roundInfo = getRoundInfoFromWcif(roundId, wcif);
    // A head-to-head solve races the next point of the competitor's match,
    // not a numbered attempt: "Set 1 Point 4"
    if (isH2hRound(roundId, wcif)) {
      const next = await nextPointOf(this.prisma, roundId, personId);
      const limit = roundInfo?.timeLimit?.centiseconds
        ? roundInfo.timeLimit.centiseconds * 10
        : null;
      if (!showsSecondaryText) {
        return { name: eventText, secondaryText: eventText, limit };
      }
      return {
        name: shortEventText,
        secondaryText: next
          ? getTranslation('h2hNextPoint', locale)
              .replace('{0}', `${next.setNumber}`)
              .replace('{1}', `${next.pointNumber}`)
          : '',
        limit,
      };
    }
    let cumulativeText = '';
    let cutoffText = '';
    const nextAttemptData = await this.resultService.getNextAttemptData(
      cardId,
      roundId,
    );
    const shownAttempt =
      nextAttemptData.scrambleData.scramble ?? nextAttemptData.scrambleData;
    const attemptText = `${getTranslation('attempt', locale)} ${shownAttempt.isExtra ? 'E' : ''}${shownAttempt.num}`;

    if (
      showsSecondaryText &&
      roundInfo?.timeLimit &&
      roundInfo.timeLimit.cumulativeRoundIds.length > 0
    ) {
      const roundsIds =
        roundInfo.timeLimit.cumulativeRoundIds.length > 1
          ? roundInfo.timeLimit.cumulativeRoundIds
          : [roundId];
      let used = 0;
      for (const rId of roundsIds) {
        const submittedAttempts = await this.resultService.getSubmittedAttempts(
          rId,
          personId,
        );
        submittedAttempts.forEach((a) => {
          used += attemptTimeWithPenalty(a);
        });
      }
      const limit = roundInfo.timeLimit.centiseconds;
      const remaining = Math.max(0, limit - used);
      cumulativeText = `Remaining: ${formatCentiseconds(remaining)}`;
      limitToReturn = remaining * 10;
    }
    if (showsSecondaryText && roundInfo?.cutoff) {
      cutoffText = `Cutoff: ${formatCentiseconds(roundInfo.cutoff.resultValue)}`;
    }

    // Multi-blind has no time limit in the WCIF: its timeLimit is null
    if (limitToReturn === null) {
      limitToReturn = roundInfo?.timeLimit?.centiseconds
        ? roundInfo.timeLimit.centiseconds * 10
        : null;
    }
    let secondaryText = '';
    if (cumulativeText) {
      secondaryText = cumulativeText;
    } else if (cutoffText) {
      if (
        !nextAttemptData.scrambleData.isExtra &&
        nextAttemptData.scrambleData.num === 1
      ) {
        secondaryText = cutoffText;
      } else {
        secondaryText = attemptText;
      }
    } else {
      secondaryText = attemptText;
    }
    if (showsSecondaryText) {
      return {
        name: shortEventText,
        secondaryText,
        limit: limitToReturn,
      };
    } else {
      return {
        name: eventText,
        secondaryText: eventText,
        limit: limitToReturn,
      };
    }
  }
}
