import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { notificationService } from '../services/notification.service';
import { asyncHandler, success } from '../utils/response';
import { paramId } from '../utils/params';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === 'true';
    const notifications = await notificationService.listForUser(req.user!.userId, unreadOnly);
    success(res, notifications);
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req, res) => {
    const count = await notificationService.unreadCount(req.user!.userId);
    success(res, { count });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await notificationService.markRead(paramId(req.params.id), req.user!.userId);
    success(res, { read: true });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.user!.userId);
    success(res, { read: true });
  })
);

export default router;
