import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AttemptStatus, DelegateGrantPermission } from '@prisma/client';
import { GetUser } from 'src/auth/decorator/getUser.decorator';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { DelegateGuard } from 'src/auth/guards/delegate.guard';
import { DelegateOrGrantGuard } from 'src/auth/guards/delegateOrGrant.guard';
import { DbService } from 'src/db/db.service';
import { DelegateGrantService } from 'src/delegate-grant/delegateGrant.service';
import {
  actionForAttemptUpdate,
  attemptLabel,
  describeAttemptUpdate,
  formatAttemptTime,
} from 'src/delegate-grant/delegateGrantRules';
import { ParseRoundIdPipe } from 'src/roundId.pipe';

import { AttemptService } from './attempt.service';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { DnfAttemptsDto } from './dto/dnfAttempts.dto';
import { EnterScorecardDto } from './dto/enterScorecard.dto';
import { GiveExtrasDto } from './dto/giveExtras.dto';
import { ReorderAttemptsDto } from './dto/reorderAttempts.dto';
import { RestoreDnfAttemptsDto } from './dto/restoreDnfAttempts.dto';
import { RestoreExtraGrantDto } from './dto/restoreExtraGrant.dto';
import { SetReplacementDto } from './dto/setReplacement.dto';
import { SwapAttemptsDto } from './dto/swapAttempts.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

const {
  ADD_ATTEMPT,
  REORDER_ATTEMPTS,
  DELETE_ATTEMPT,
  EXTRAS_FOR_SEVERAL,
  DNF_ALL,
} = DelegateGrantPermission;

/**
 * Delegates can do all of this. A user with delegate access for a group
 * (SPEC-013) gets through DelegateOrGrantGuard, and each endpoint asks the
 * grant whether this action on this competitor is allowed; endpoints a grant
 * never allows keep DelegateGuard.
 */
@UseGuards(AuthGuard('jwt'), DelegateOrGrantGuard)
@Controller('attempt')
export class AttemptController {
  constructor(
    private readonly attemptService: AttemptService,
    private readonly delegateGrants: DelegateGrantService,
    private readonly prisma: DbService,
  ) {}

  @Post()
  async createAttempt(
    @Body() data: CreateAttemptDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { personId: data.competitorId, roundId: data.roundId };
    const grant = await this.delegateGrants.authorize(
      user,
      ADD_ATTEMPT,
      target,
    );
    const created = await this.attemptService.createAttempt(data, user.userId);
    await this.delegateGrants.record(grant, target, {
      kind: ADD_ATTEMPT,
      summary: `Added ${attemptLabel(data)}: ${formatAttemptTime(data)}`,
    });
    return created;
  }

  @Put('swap')
  async swapAttempts(
    @Body() data: SwapAttemptsDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const grant = await this.delegateGrants.authorizeAll(
      user,
      REORDER_ATTEMPTS,
      [{ attemptId: data.firstAttemptId }, { attemptId: data.secondAttemptId }],
    );
    const [first, second] = await Promise.all(
      [data.firstAttemptId, data.secondAttemptId].map((id) =>
        this.findAttempt(id),
      ),
    );
    const swapped = await this.attemptService.swapAttempts(
      data.firstAttemptId,
      data.secondAttemptId,
      user.userId,
    );
    await this.delegateGrants.record(
      grant,
      { attemptId: data.firstAttemptId },
      {
        kind: REORDER_ATTEMPTS,
        summary: `Swapped ${attemptLabel(first)} and ${attemptLabel(second)}`,
        attemptId: data.firstAttemptId,
      },
    );
    return swapped;
  }

  @Put('reorder')
  async reorderAttempts(
    @Body() data: ReorderAttemptsDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const grant = await this.delegateGrants.authorize(user, REORDER_ATTEMPTS, {
      resultId: data.resultId,
    });
    const reordered = await this.attemptService.reorderAttempts(
      data.attemptIds,
      data.resultId,
      user.userId,
    );
    await this.delegateGrants.record(
      grant,
      { resultId: data.resultId },
      { kind: REORDER_ATTEMPTS, summary: 'Reordered attempts' },
    );
    return reordered;
  }

  @Put(':id/replacement')
  async setAttemptReplacement(
    @Param('id') id: string,
    @Body() data: SetReplacementDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { attemptId: id };
    const grant = await this.delegateGrants.authorize(
      user,
      REORDER_ATTEMPTS,
      target,
    );
    const attempt = await this.findAttempt(id);
    const updated = await this.attemptService.setAttemptReplacement(
      id,
      data.replacedByExtraNumber,
      user.userId,
    );
    await this.delegateGrants.record(grant, target, {
      kind: REORDER_ATTEMPTS,
      summary:
        data.replacedByExtraNumber === null ||
        data.replacedByExtraNumber === undefined
          ? `Took the replacement off ${attemptLabel(attempt)}`
          : `Extra ${data.replacedByExtraNumber} now replaces ${attemptLabel(attempt)}`,
      attemptId: id,
    });
    return updated;
  }

  @UseGuards(DelegateGuard)
  @HttpCode(HttpStatus.OK)
  @Post('scorecard')
  async enterScorecard(
    @Body() data: EnterScorecardDto,
    @GetUser() user: JwtAuthDto,
  ) {
    return await this.attemptService.enterScorecard(data, user.userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('give-extras-for-all')
  async giveExtras(@Body() data: GiveExtrasDto, @GetUser() user: JwtAuthDto) {
    const grant = await this.delegateGrants.authorizeAll(
      user,
      EXTRAS_FOR_SEVERAL,
      [
        { resultId: data.resultId },
        ...data.attemptIds.map((attemptId) => ({ attemptId })),
      ],
    );
    const given = await this.attemptService.giveExtras(data, user.userId);
    await this.delegateGrants.record(
      grant,
      { resultId: data.resultId },
      {
        kind: EXTRAS_FOR_SEVERAL,
        summary: `Gave extras for ${data.attemptIds.length} attempts`,
      },
    );
    return given;
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore-extra-grant')
  async restoreExtraGrant(
    @Body() data: RestoreExtraGrantDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { extraGrantId: data.grantId };
    const grant = await this.delegateGrants.authorize(
      user,
      EXTRAS_FOR_SEVERAL,
      target,
    );
    const restored = await this.attemptService.restoreExtraGrant(
      data.grantId,
      user.userId,
    );
    await this.delegateGrants.record(grant, target, {
      kind: EXTRAS_FOR_SEVERAL,
      summary: 'Took back extras for several attempts',
    });
    return restored;
  }

  @HttpCode(HttpStatus.OK)
  @Post('reapply-extra-grant')
  async reapplyExtraGrant(
    @Body() data: RestoreExtraGrantDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { extraGrantId: data.grantId };
    const grant = await this.delegateGrants.authorize(
      user,
      EXTRAS_FOR_SEVERAL,
      target,
    );
    const reapplied = await this.attemptService.reapplyExtraGrant(
      data.grantId,
      user.userId,
    );
    await this.delegateGrants.record(grant, target, {
      kind: EXTRAS_FOR_SEVERAL,
      summary: 'Gave extras for several attempts again',
    });
    return reapplied;
  }

  @HttpCode(HttpStatus.OK)
  @Post('dnf')
  async dnfAttempts(@Body() data: DnfAttemptsDto, @GetUser() user: JwtAuthDto) {
    const targets = [
      ...data.attemptIds.map((attemptId) => ({ attemptId })),
      ...(data.remainingInResultId
        ? [{ resultId: data.remainingInResultId }]
        : []),
    ];
    if (targets.length === 0) {
      throw new HttpException('Nothing to rule DNF', 400);
    }
    const grant = await this.delegateGrants.authorizeAll(
      user,
      DNF_ALL,
      targets,
    );
    // Removing results is never part of delegate access (SPEC-013)
    if (grant && data.removeLaterRounds) {
      throw new HttpException(
        'Only delegates can remove results in later rounds',
        403,
      );
    }
    const ruled = await this.attemptService.dnfAttempts(data, user.userId);
    await this.delegateGrants.record(grant, targets[0], {
      kind: DNF_ALL,
      summary: data.remainingInResultId
        ? 'Ruled all attempts DNF'
        : `Ruled ${data.attemptIds.length} attempts DNF`,
    });
    return ruled;
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore-dnf')
  async restoreDnfAttempts(
    @Body() data: RestoreDnfAttemptsDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { resultId: data.resultId };
    const grant = await this.delegateGrants.authorize(user, DNF_ALL, target);
    const restored = await this.attemptService.restoreDnfAttempts(
      data.resultId,
      user.userId,
    );
    await this.delegateGrants.record(grant, target, {
      kind: DNF_ALL,
      summary: 'Undid the DNF ruling',
    });
    return restored;
  }

  // Shown on the result page, so anyone who may open the result may read it
  @Get('dnf/:resultId')
  async getDnfRuling(
    @Param('resultId') resultId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.delegateGrants.authorizeRead(user, { resultId });
    return await this.attemptService.getDnfRuling(resultId);
  }

  @Get('give-extras-for-all/:resultId')
  async getExtrasContext(
    @Param('resultId') resultId: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.delegateGrants.authorizeRead(user, { resultId });
    return await this.attemptService.getExtrasContext(resultId);
  }

  @UseGuards(DelegateGuard)
  @Get('round/:roundId/recent')
  async getRecentAttemptsByRoundId(
    @Param('roundId', ParseRoundIdPipe) roundId: string,
  ) {
    return await this.attemptService.getRecentAttemptsByRoundId(roundId);
  }

  @Get(':id/edit-log')
  async getAttemptEditLog(
    @Param('id') id: string,
    @GetUser() user: JwtAuthDto,
  ) {
    await this.delegateGrants.authorizeRead(user, { attemptId: id });
    return await this.attemptService.getAttemptEditLog(id);
  }

  @Get(':id')
  async getAttemptById(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    const grant = await this.delegateGrants.authorizeRead(user, {
      attemptId: id,
    });
    const found = await this.attemptService.getAttemptById(id);
    // A competitor's earlier incidents are history, which stays with
    // delegates
    return grant ? { ...found, previousIncidents: [] } : found;
  }

  @Put(':id')
  async updateAttempt(
    @Param('id') id: string,
    @Body() data: UpdateAttemptDto,
    @GetUser() user: JwtAuthDto,
  ) {
    const target = { attemptId: id };
    const before = await this.findAttempt(id);
    const action = actionForAttemptUpdate(before, data);
    const grant = await this.delegateGrants.authorize(user, action, target);
    // Saving an incident as noteworthy stays with delegates
    if (grant && data.noteworthy) data.noteworthy = false;
    const updated = await this.attemptService.updateAttempt(
      id,
      data,
      user.userId,
    );
    await this.delegateGrants.record(grant, target, {
      kind: action,
      summary: describeAttemptUpdate(action, before, data),
      attemptId: id,
    });
    return updated;
  }

  @Delete(':id')
  async deleteAttempt(@Param('id') id: string, @GetUser() user: JwtAuthDto) {
    const target = { attemptId: id };
    const grant = await this.delegateGrants.authorize(
      user,
      DELETE_ATTEMPT,
      target,
    );
    // Before deleting, which can delete the result with its last attempt
    const attempt = grant ? await this.findAttempt(id) : null;
    const result = grant ? await this.delegateGrants.findResult(target) : null;
    const deleted = await this.attemptService.deleteAttempt(id);
    if (attempt) {
      const what =
        attempt.status === AttemptStatus.UNRESOLVED
          ? `the incident on ${attemptLabel(attempt)}`
          : attemptLabel(attempt);
      await this.delegateGrants.record(grant, target, {
        kind: DELETE_ATTEMPT,
        summary: `Deleted ${what} (${formatAttemptTime(attempt)})`,
        attemptId: id,
        result,
      });
    }
    return deleted;
  }

  private async findAttempt(id: string) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id } });
    if (!attempt) throw new HttpException('Attempt not found', 404);
    return attempt;
  }
}
