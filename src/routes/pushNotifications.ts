import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';

const router = express.Router();

// Get VAPID public key
router.get('/vapid-public-key', (req, res: Response): void => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications
router.post('/subscribe',
  authMiddleware,
  [
    body('endpoint').notEmpty().withMessage('Endpoint is required'),
    body('keys.p256dh').notEmpty().withMessage('P256DH key is required'),
    body('keys.auth').notEmpty().withMessage('Auth key is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user!.id;
      const { endpoint, keys } = req.body;
      const userAgent = req.headers['user-agent'] || 'Unknown';

      // Check if subscription already exists
      const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint }
      });

      if (existing) {
        // Update if it belongs to different user
        if (existing.userId !== userId) {
          await prisma.pushSubscription.update({
            where: { endpoint },
            data: {
              userId,
              p256dh: keys.p256dh,
              auth: keys.auth,
              userAgent
            }
          });
        }
        res.json({ message: 'Subscription updated', subscription: existing });
        return;
      }

      // Create new subscription
      const subscription = await prisma.pushSubscription.create({
        data: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent
        }
      });

      res.status(201).json({ message: 'Subscribed successfully', subscription });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  }
);

// Unsubscribe from push notifications
router.post('/unsubscribe',
  authMiddleware,
  [body('endpoint').notEmpty().withMessage('Endpoint is required')],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const userId = req.user!.id;
      const { endpoint } = req.body;

      const subscription = await prisma.pushSubscription.findFirst({
        where: {
          userId,
          endpoint
        }
      });

      if (!subscription) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      await prisma.pushSubscription.delete({
        where: { id: subscription.id }
      });

      res.json({ message: 'Unsubscribed successfully' });
    } catch (error) {
      console.error('Unsubscribe error:', error);
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  }
);

// Get user's subscriptions
router.get('/subscriptions',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
        select: {
          id: true,
          endpoint: true,
          userAgent: true,
          createdAt: true
        }
      });

      res.json({ subscriptions });
    } catch (error) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  }
);

export default router;
