import { ArgumentsHost, Catch, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

const RECORD_NOT_FOUND = 'P2025';

/**
 * Prisma throws P2025 when an update, delete or connect targets a record
 * that does not exist. Without this filter it surfaces as a 500; an unknown
 * id in the URL or body is a 404.
 *
 * Global filters only apply to HTTP: socket.io gateways keep their own
 * exception handling.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaNotFoundFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === RECORD_NOT_FOUND) {
      return super.catch(new NotFoundException('Record not found'), host);
    }
    return super.catch(exception, host);
  }
}
