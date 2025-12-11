import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma';

const router = Router();

// Get all startup ideas
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ideas = await prisma.startupIdea.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ ideas });
  } catch (error) {
    console.error('Get startup ideas error:', error);
    res.status(500).json({ error: 'Failed to fetch startup ideas' });
  }
});

// Get a single startup idea
router.get('/:ideaId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ideaId } = req.params;

    const idea = await prisma.startupIdea.findUnique({
      where: { id: ideaId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true
          }
        }
      }
    });

    if (!idea) {
      res.status(404).json({ error: 'Startup idea not found' });
      return;
    }

    res.json({ idea });
  } catch (error) {
    console.error('Get startup idea error:', error);
    res.status(500).json({ error: 'Failed to fetch startup idea' });
  }
});

// Create a new startup idea
router.post(
  '/',
  authMiddleware,
  [
    body('title').isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').optional().isString(),
    body('tags').optional().isArray()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { title, description, category, tags } = req.body;

      const idea = await prisma.startupIdea.create({
        data: {
          userId: req.user!.id,
          title,
          description,
          category: category || null,
          tags: tags || []
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePhoto: true,
              role: true
            }
          }
        }
      });

      res.status(201).json({ idea });
    } catch (error) {
      console.error('Create startup idea error:', error);
      res.status(500).json({ error: 'Failed to create startup idea' });
    }
  }
);

// Update a startup idea
router.put(
  '/:ideaId',
  authMiddleware,
  [
    body('title').optional().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('description').optional().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').optional().isString(),
    body('tags').optional().isArray()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { ideaId } = req.params;
      const { title, description, category, tags } = req.body;

      // Check if idea exists and user owns it
      const existingIdea = await prisma.startupIdea.findUnique({
        where: { id: ideaId }
      });

      if (!existingIdea) {
        res.status(404).json({ error: 'Startup idea not found' });
        return;
      }

      if (existingIdea.userId !== req.user!.id) {
        res.status(403).json({ error: 'Unauthorized to update this idea' });
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const updatedIdea = await prisma.startupIdea.update({
        where: { id: ideaId },
        data: {
          title,
          description,
          category,
          tags
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePhoto: true,
              role: true
            }
          }
        }
      });

      res.json({ idea: updatedIdea });
    } catch (error) {
      console.error('Update startup idea error:', error);
      res.status(500).json({ error: 'Failed to update startup idea' });
    }
  }
);

// Delete a startup idea
router.delete('/:ideaId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ideaId } = req.params;

    // Check if idea exists and user owns it
    const existingIdea = await prisma.startupIdea.findUnique({
      where: { id: ideaId }
    });

    if (!existingIdea) {
      res.status(404).json({ error: 'Startup idea not found' });
      return;
    }

    if (existingIdea.userId !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized to delete this idea' });
      return;
    }

    await prisma.startupIdea.delete({
      where: { id: ideaId }
    });

    res.json({ message: 'Startup idea deleted successfully' });
  } catch (error) {
    console.error('Delete startup idea error:', error);
    res.status(500).json({ error: 'Failed to delete startup idea' });
  }
});

export default router;
