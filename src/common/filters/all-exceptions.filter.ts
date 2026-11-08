import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Error as MongooseError } from 'mongoose';
import { Request, Response } from 'express';

interface MongoWriteError {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  correlationId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const { status, message, error } = this.resolve(exception);

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.correlationId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${request.correlationId}] ${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return {
          status: exception.getStatus(),
          message: res,
          error: exception.name,
        };
      }
      const obj = res as Record<string, unknown>;
      return {
        status: exception.getStatus(),
        message: (obj.message as string | string[]) ?? exception.message,
        error: (obj.error as string) ?? exception.name,
      };
    }

    // Duplicate key (unique index) -> 409 Conflict
    if (this.isMongoDuplicateKey(exception)) {
      return {
        status: HttpStatus.CONFLICT,
        message: `Duplicate value for unique field: ${this.duplicateFields(exception)}`,
        error: 'Conflict',
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: Object.values(exception.errors).map((e) => e.message),
        error: 'Bad Request',
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid value for ${exception.path}`,
        error: 'Bad Request',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }

  private isMongoDuplicateKey(
    exception: unknown,
  ): exception is MongoWriteError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as MongoWriteError).code === 11000
    );
  }

  private duplicateFields(exception: MongoWriteError): string {
    return Object.keys(exception.keyPattern ?? {}).join(', ') || 'unknown';
  }
}
