import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';

const router = express.Router();

// Valid reaction types
const VALID_REACTION_TYPES = ['like', 'love', 'wow', 'sad', 'angry'];

// Add or update reaction to a post
router.post('/',
  authMiddleware,
  [
    body('postId').notEmpty().withMessage('Post ID is required'),
    body('type').isIn(VALID_REACTION_TYPES).withMessage(`Type must be one of: ${VALID_REACTION_TYPES.join(', ')}`)
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { postId, type } = req.body;

      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          pod: {
            select: {
              id: true,
              ownerId: true
            }
          }
        }
      });

      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      // Check if user is a member or owner of the pod
      const isMember = await prisma.podMember.findUnique({
        where: {
          podId_userId: {
            podId: post.podId,
            userId: req.user!.id
          }
        }
      });

      const isOwner = post.pod.ownerId === req.user!.id;

      if (!isMember && !isOwner) {
        res.status(403).json({ error: 'You must be a member of this pod to react to posts' });
        return;
      }

      // Check if user already has a reaction of this type on this post
      const existingReaction = await prisma.reaction.findUnique({
        where: {
          postId_userId_type: {
            postId,
            userId: req.user!.id,
            type
          }
        }
      });

      if (existingReaction) {
        res.status(400).json({ error: 'You have already reacted with this type' });
        return;
      }

      // Delete any other reaction from this user on this post
      await prisma.reaction.deleteMany({
        where: {
          postId,
          userId: req.user!.id
        }
      });

      // Create new reaction
      const reaction = await prisma.reaction.create({
        data: {
          type,
          postId,
          userId: req.user!.id
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      res.status(201).json({ reaction });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  }
);

// Remove reaction from a post
router.delete('/:postId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Delete all reactions from this user on this post
    const result = await prisma.reaction.deleteMany({
      where: {
        postId,
        userId: req.user!.id
      }
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'No reaction found to remove' });
      return;
    }

    res.json({ message: 'Reaction removed successfully' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get reactions for a post
router.get('/post/:postId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        pod: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Check if user is a member or owner of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: post.podId,
          userId: req.user!.id
        }
      }
    });

    const isOwner = post.pod.ownerId === req.user!.id;

    if (!isMember && !isOwner) {
      res.status(403).json({ error: 'You must be a member of this pod to view reactions' });
      return;
    }

    const reactions = await prisma.reaction.findMany({
      where: { postId },
      include: {
        user: {
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
    });

    // Group reactions by type
    const reactionSummary = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.type]) {
        acc[reaction.type] = [];
      }
      acc[reaction.type].push({
        id: reaction.id,
        user: reaction.user,
        createdAt: reaction.createdAt
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({ 
      reactions,
      summary: reactionSummary,
      totalCount: reactions.length
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

export default router;
