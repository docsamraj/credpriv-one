import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@credpriv/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function success<T>(res: Response, data: T, message?: string, statusCode = 200) {
  const body: ApiResponse<T> = { success: true, data, message };
  return res.status(statusCode).json(body);
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    } satisfies ApiResponse);
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  } satisfies ApiResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
