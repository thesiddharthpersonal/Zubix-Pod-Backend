import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get all active idol pitch decks (public access)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const pitchDecks = await prisma.idolPitchDeck.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: pitchDecks,
    });
  })
);

// Get single pitch deck by ID (public access, increments view count)
router.get(
  '/:deckId',
  asyncHandler(async (req: Request, res: Response) => {
    const { deckId } = req.params;

    const pitchDeck = await prisma.idolPitchDeck.findUnique({
      where: { id: deckId },
    });

    if (!pitchDeck) {
      return res.status(404).json({
        success: false,
        error: 'Pitch deck not found',
      });
    }

    // Increment view count
    await prisma.idolPitchDeck.update({
      where: { id: deckId },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });

    res.json({
      success: true,
      data: pitchDeck,
    });
  })
);

// Create new idol pitch deck (pod owners and co-owners only)
router.post(
  '/',
  authMiddleware,
  [
    body('title').trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('companyName').trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
    body('pdfUrl').isURL().withMessage('Valid PDF URL is required'),
    body('description').optional().trim(),
    body('thumbnailUrl').optional({ values: 'falsy' }).isURL().withMessage('Thumbnail must be a valid URL'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { title, description, companyName, pdfUrl, thumbnailUrl } = req.body;
    const userId = (req as any).user?.id;

    // Check if user is a pod owner or co-owner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'POD_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only pod owners and co-owners can upload pitch decks',
      });
    }

    const pitchDeck = await prisma.idolPitchDeck.create({
      data: {
        title,
        description,
        companyName,
        pdfUrl,
        thumbnailUrl,
        uploadedBy: userId,
      },
    });

    res.status(201).json({
      success: true,
      data: pitchDeck,
    });
  })
);

// Update idol pitch deck (admin only)
router.put(
  '/:deckId',
  authMiddleware,
  [
    body('title').optional().trim().isLength({ min: 3 }).withMessage('Title must be at least 3 characters'),
    body('companyName').optional().trim().isLength({ min: 2 }).withMessage('Company name must be at least 2 characters'),
    body('pdfUrl').optional().isURL().withMessage('Valid PDF URL is required'),
    body('description').optional().trim(),
    body('thumbnailUrl').optional({ values: 'falsy' }).isURL().withMessage('Thumbnail must be a valid URL'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { deckId } = req.params;
    const updateData = req.body;
    const userId = (req as any).user?.id;

    // Check if user is a pod owner or co-owner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'POD_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only pod owners and co-owners can update pitch decks',
      });
    }

    const pitchDeck = await prisma.idolPitchDeck.findUnique({
      where: { id: deckId },
    });

    if (!pitchDeck) {
      return res.status(404).json({
        success: false,
        error: 'Pitch deck not found',
      });
    }

    const updatedDeck = await prisma.idolPitchDeck.update({
      where: { id: deckId },
      data: updateData,
    });

    res.json({
      success: true,
      data: updatedDeck,
    });
  })
);

// Delete idol pitch deck (pod owners and co-owners only)
router.delete(
  '/:deckId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { deckId } = req.params;
    const userId = (req as any).user?.id;

    // Check if user is a pod owner or co-owner
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== 'POD_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only pod owners and co-owners can delete pitch decks',
      });
    }

    const pitchDeck = await prisma.idolPitchDeck.findUnique({
      where: { id: deckId },
    });

    if (!pitchDeck) {
      return res.status(404).json({
        success: false,
        error: 'Pitch deck not found',
      });
    }

    await prisma.idolPitchDeck.delete({
      where: { id: deckId },
    });

    res.json({
      success: true,
      message: 'Pitch deck deleted successfully',
    });
  })
);

export default router;
