import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AppError } from '../utils/response';

export function validateRequest(req: Request, _res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors
      .array()
      .map((e) => ('msg' in e ? String(e.msg) : 'Invalid input'))
      .join('; ');
    return next(new AppError(400, msg || 'Validation failed'));
  }
  next();
}
