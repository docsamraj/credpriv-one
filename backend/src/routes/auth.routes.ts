import { Router } from 'express';
import { body } from 'express-validator';
import { authService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';
import { asyncHandler, success } from '../utils/response';

const router = Router();

router.post(
  '/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    success(res, result, 'Registration successful', 201);
  })
);

router.post(
  '/login',
  body('email').isEmail(),
  body('password').notEmpty(),
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
