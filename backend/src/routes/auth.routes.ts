import { Router } from 'express';
import { body } from 'express-validator';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { rateLimit } from '../middleware/security';
import { validateRequest } from '../middleware/validate';
import { asyncHandler, success } from '../utils/response';

const router = Router();
const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth' });

router.post(
  '/register',
  authRateLimit,
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('privacyNoticeAccepted').custom((v) => v === true || v === 'true').withMessage('You must accept the privacy notice'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await authService.register({
      ...req.body,
      privacyNoticeAccepted: true,
    });
    success(res, result, 'Registration successful', 201);
  })
);

router.post(
  '/login',
  authRateLimit,
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password, req);
    success(res, result, 'Login successful');
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await authService.getProfile(req.user!.userId);
    success(res, profile);
  })
);

export default router;
