import express, { Response } from 'express';
import { authMiddleware, isPodOwner, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';
import { userSelectMinimal } from '../utils/permissions.js';

const router = express.Router();

// Get pitches for a pod (owner/co-owners can view all, others can view their own)
router.get('/pod/:podId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const { status } = req.query;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        coOwners: {
          select: { id: true }
        }
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    const isOwner = pod.ownerId === req.user!.id;
    const isCoOwner = pod.coOwners.some(co => co.id === req.user!.id);

    const whereClause: any = { podId };

    // If not owner/co-owner, only show user's own pitches
    if (!isOwner && !isCoOwner) {
      whereClause.founderId = req.user!.id;
    }

    // Filter by status if provided
    if (status && typeof status === 'string') {
      whereClause.status = status;
    }

    const pitches = await prisma.pitch.findMany({
      where: whereClause,
      include: {
        founder: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true
          }
        },
        pod: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pitches });
  } catch (error) {
    console.error('Get pod pitches error:', error);
    res.status(500).json({ error: 'Failed to fetch pitches' });
  }
});

// Get user's pitches
router.get('/user/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Users can only view their own pitches unless they're pod owners
    if (userId !== req.user!.id && req.user!.role !== 'POD_OWNER') {
      res.status(403).json({ error: 'You can only view your own pitches' });
      return;
    }

    const pitches = await prisma.pitch.findMany({
      where: { founderId: userId },
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pitches });
  } catch (error) {
    console.error('Get user pitches error:', error);
    res.status(500).json({ error: 'Failed to fetch user pitches' });
  }
});

// Get single pitch by ID
router.get('/:pitchId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { pitchId } = req.params;

    const pitch = await prisma.pitch.findUnique({
      where: { id: pitchId },
      include: {
        founder: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true
          }
        },
        pod: {
          select: {
            id: true,
            name: true,
            logo: true,
            ownerId: true
          },
          include: {
            coOwners: {
              select: { id: true }
            }
          }
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!pitch) {
      res.status(404).json({ error: 'Pitch not found' });
      return;
    }

    // Check permissions
    const isFounder = pitch.founderId === req.user!.id;
    const isOwner = pitch.pod.ownerId === req.user!.id;
    const isCoOwner = pitch.pod.coOwners.some(co => co.id === req.user!.id);

    if (!isFounder && !isOwner && !isCoOwner) {
      res.status(403).json({ error: 'You do not have permission to view this pitch' });
      return;
    }

    res.json({ pitch });
  } catch (error) {
    console.error('Get pitch error:', error);
    res.status(500).json({ error: 'Failed to fetch pitch' });
  }
});

// Create a pitch
router.post('/',
  authMiddleware,
  [
    body('podId').notEmpty().withMessage('Pod ID is required'),
    body('startupName').notEmpty().withMessage('Startup name is required'),
    body('summary').notEmpty().withMessage('Summary is required'),
    body('sector').notEmpty().withMessage('Sector is required'),
    body('stage').notEmpty().withMessage('Stage is required'),
    body('ask').notEmpty().withMessage('Ask is required'),
    body('operatingCity').notEmpty().withMessage('Operating city is required'),
    body('contactEmail').isEmail().withMessage('Valid contact email is required'),
    body('contactPhone').notEmpty().withMessage('Contact phone is required')
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
        startupName,
        pitchDeckUrl,
        summary,
        sector,
        stage,
        ask,
        operatingCity,
        website,
        contactEmail,
        contactPhone
      } = req.body;

      const pitch = await prisma.pitch.create({
        data: {
          podId,
          founderId: req.user!.id,
          startupName,
          pitchDeckUrl,
          summary,
          sector,
          stage,
          ask,
          operatingCity,
          website,
          contactEmail,
          contactPhone
        },
        include: {
          founder: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          pod: {
            select: {
              id: true,
              name: true,
              logo: true
            }
          }
        }
      });

      res.status(201).json({ pitch });
    } catch (error) {
      console.error('Create pitch error:', error);
      res.status(500).json({ error: 'Failed to create pitch' });
    }
  }
);

// Update a pitch (founder only)
router.put('/:pitchId',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { pitchId } = req.params;

      const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId }
      });

      if (!pitch) {
        res.status(404).json({ error: 'Pitch not found' });
        return;
      }

      if (pitch.founderId !== req.user!.id) {
        res.status(403).json({ error: 'You can only edit your own pitches' });
        return;
      }

      const updateData = req.body;
      delete updateData.founderId;
      delete updateData.podId;
      delete updateData.status;

      const updatedPitch = await prisma.pitch.update({
        where: { id: pitchId },
        data: updateData,
        include: {
          founder: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          pod: {
            select: {
              id: true,
              name: true,
              logo: true
            }
          }
        }
      });

      res.json({ pitch: updatedPitch });
    } catch (error) {
      console.error('Update pitch error:', error);
      res.status(500).json({ error: 'Failed to update pitch' });
    }
  }
);

// Delete a pitch
router.delete('/:pitchId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { pitchId } = req.params;

    const pitch = await prisma.pitch.findUnique({
      where: { id: pitchId },
      include: {
        pod: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!pitch) {
      res.status(404).json({ error: 'Pitch not found' });
      return;
    }

    // Only founder or pod owner can delete
    if (pitch.founderId !== req.user!.id && pitch.pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You do not have permission to delete this pitch' });
      return;
    }

    await prisma.pitch.delete({
      where: { id: pitchId }
    });

    res.json({ message: 'Pitch deleted successfully' });
  } catch (error) {
    console.error('Delete pitch error:', error);
    res.status(500).json({ error: 'Failed to delete pitch' });
  }
});

// Update pitch status (pod owner/co-owner only)
router.patch('/:pitchId/status',
  authMiddleware,
  [
    body('status').notEmpty().withMessage('Status is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { pitchId } = req.params;
      const { status } = req.body;

      const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        include: {
          pod: {
            include: {
              coOwners: {
                select: { id: true }
              }
            }
          }
        }
      });

      if (!pitch) {
        res.status(404).json({ error: 'Pitch not found' });
        return;
      }

      console.log('Pitch pod owner:', pitch.pod.ownerId);
      console.log('Current user:', req.user!.id);
      console.log('Co-owners:', pitch.pod.coOwners);

      const isOwner = pitch.pod.ownerId === req.user!.id;
      const isCoOwner = pitch.pod.coOwners.some(co => co.id === req.user!.id);

      console.log('Is owner:', isOwner, 'Is co-owner:', isCoOwner);

      if (!isOwner && !isCoOwner) {
        res.status(403).json({ error: 'Only pod owners/co-owners can update pitch status' });
        return;
      }

      const updatedPitch = await prisma.pitch.update({
        where: { id: pitchId },
        data: { status },
        include: {
          founder: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          pod: {
            select: {
              id: true,
              name: true,
              logo: true
            }
          }
        }
      });

      res.json({ pitch: updatedPitch });
    } catch (error) {
      console.error('Update pitch status error:', error);
      res.status(500).json({ error: 'Failed to update pitch status' });
    }
  }
);

// Add a reply to a pitch (pod owner/co-owner only)
router.post('/:pitchId/replies',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('Reply content is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { pitchId } = req.params;
      const { content } = req.body;

      const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId },
        include: {
          pod: {
            include: {
              coOwners: {
                select: { id: true }
              }
            }
          }
        }
      });

      if (!pitch) {
        res.status(404).json({ error: 'Pitch not found' });
        return;
      }

      const isOwner = pitch.pod.ownerId === req.user!.id;
      const isCoOwner = pitch.pod.coOwners.some(co => co.id === req.user!.id);

      console.log('Reply attempt:', {
        userId: req.user!.id,
        pitchId,
        podOwnerId: pitch.pod.ownerId,
        coOwners: pitch.pod.coOwners.map(co => co.id),
        isOwner,
        isCoOwner
      });

      if (!isOwner && !isCoOwner) {
        console.log('Permission denied: User is not owner or co-owner');
        res.status(403).json({ 
          error: 'Only pod owners/co-owners can reply to pitches',
          details: {
            isOwner,
            isCoOwner,
            userId: req.user!.id,
            podOwnerId: pitch.pod.ownerId
          }
        });
        return;
      }

      const reply = await prisma.pitchReply.create({
        data: {
          pitchId,
          authorId: req.user!.id,
          content
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      // Update pitch status to REPLIED if it's NEW or VIEWED
      if (pitch.status === 'NEW' || pitch.status === 'VIEWED') {
        await prisma.pitch.update({
          where: { id: pitchId },
          data: { status: 'REPLIED' }
        });
      }

      console.log('Reply created successfully:', reply.id);

      res.status(201).json({ reply });
    } catch (error) {
      console.error('Create reply error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      res.status(500).json({ error: 'Failed to create reply' });
    }
  }
);

// Upload pitch deck
router.post('/:pitchId/pitch-deck',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { pitchId } = req.params;
      const { pitchDeckUrl } = req.body;

      if (!pitchDeckUrl) {
        res.status(400).json({ error: 'Pitch deck URL is required' });
        return;
      }

      const pitch = await prisma.pitch.findUnique({
        where: { id: pitchId }
      });

      if (!pitch) {
        res.status(404).json({ error: 'Pitch not found' });
        return;
      }

      if (pitch.founderId !== req.user!.id) {
        res.status(403).json({ error: 'You can only upload pitch deck for your own pitches' });
        return;
      }

      const updatedPitch = await prisma.pitch.update({
        where: { id: pitchId },
        data: { pitchDeckUrl }
      });

      res.json({ pitch: updatedPitch });
    } catch (error) {
      console.error('Upload pitch deck error:', error);
      res.status(500).json({ error: 'Failed to upload pitch deck' });
    }
  }
);

export default router;
