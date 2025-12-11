import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';
import { userSelectMinimal } from '../utils/permissions.js';

const router = express.Router();

// Get bookings made by user
router.get('/requested', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const bookings = await prisma.callBooking.findMany({
      where: {
        requesterId: userId
      },
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        target: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            organisationName: true,
            designation: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ bookings });
  } catch (error) {
    console.error('Get requested bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch requested bookings' });
  }
});

// Get bookings received by user (as pod owner/co-owner)
router.get('/received', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const bookings = await prisma.callBooking.findMany({
      where: {
        targetUserId: userId
      },
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        requester: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            organisationName: true,
            designation: true,
            email: true,
            mobile: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ bookings });
  } catch (error) {
    console.error('Get received bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch received bookings' });
  }
});

// Get pending count
router.get('/pending/count', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const count = await prisma.callBooking.count({
      where: {
        targetUserId: userId,
        status: 'PENDING'
      }
    });

    res.json({ count });
  } catch (error) {
    console.error('Get pending count error:', error);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
});

// Create a call booking
router.post('/',
  authMiddleware,
  [
    body('podId').notEmpty().withMessage('Pod ID is required'),
    body('targetUserId').notEmpty().withMessage('Target user ID is required'),
    body('targetRole').isIn(['owner', 'co-owner']).withMessage('Invalid target role'),
    body('purpose').notEmpty().withMessage('Purpose is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        podId,
        targetUserId,
        targetRole,
        purpose,
        preferredDate,
        preferredTime
      } = req.body;
      const requesterId = req.user!.id;

      if (requesterId === targetUserId) {
        res.status(400).json({ error: 'Cannot book a call with yourself' });
        return;
      }

      // Check if pod exists
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        select: {
          id: true,
          ownerId: true
        }
      });

      if (!pod) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }

      // Verify target user role
      const isOwner = pod.ownerId === targetUserId;
      
      // Check if target user is a co-owner via PodMember table
      const coOwnerMembership = await prisma.podMember.findUnique({
        where: {
          podId_userId: {
            podId,
            userId: targetUserId
          }
        },
        select: { isCoOwner: true }
      });
      
      const isCoOwner = coOwnerMembership?.isCoOwner || false;

      if (targetRole === 'owner' && !isOwner) {
        res.status(400).json({ error: 'Target user is not the owner of this pod' });
        return;
      }

      if (targetRole === 'co-owner' && !isCoOwner) {
        res.status(400).json({ error: 'Target user is not a co-owner of this pod' });
        return;
      }

      const booking = await prisma.callBooking.create({
        data: {
          podId,
          requesterId,
          targetUserId,
          targetRole,
          purpose,
          preferredDate: preferredDate ? new Date(preferredDate) : null,
          preferredTime
        },
        include: {
          pod: {
            select: {
              id: true,
              name: true,
              logo: true
            }
          },
          requester: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          target: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      res.status(201).json({ booking });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
);

// Respond to a call booking (accept or reject)
router.post('/:bookingId/respond',
  authMiddleware,
  [
    body('status').isIn(['accepted', 'rejected']).withMessage('Invalid status'),
    body('remark').optional().isString()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { bookingId } = req.params;
      const { status, remark } = req.body;
      const userId = req.user!.id;

      const booking = await prisma.callBooking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      if (booking.targetUserId !== userId) {
        res.status(403).json({ error: 'You can only respond to bookings sent to you' });
        return;
      }

      if (booking.status !== 'PENDING') {
        res.status(400).json({ error: 'Booking has already been processed' });
        return;
      }

      const updatedBooking = await prisma.callBooking.update({
        where: { id: bookingId },
        data: {
          status: status === 'accepted' ? 'ACCEPTED' : 'REJECTED',
          remark,
          respondedAt: new Date()
        },
        include: {
          pod: {
            select: {
              id: true,
              name: true,
              logo: true
            }
          },
          requester: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          target: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      res.json({ booking: updatedBooking });
    } catch (error) {
      console.error('Respond to booking error:', error);
      res.status(500).json({ error: 'Failed to respond to booking' });
    }
  }
);

// Cancel a booking (requester only, before it's responded)
router.delete('/:bookingId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = req.user!.id;

    const booking = await prisma.callBooking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    if (booking.requesterId !== userId) {
      res.status(403).json({ error: 'You can only cancel your own bookings' });
      return;
    }

    if (booking.status !== 'PENDING') {
      res.status(400).json({ error: 'Can only cancel pending bookings' });
      return;
    }

    await prisma.callBooking.delete({
      where: { id: bookingId }
    });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
