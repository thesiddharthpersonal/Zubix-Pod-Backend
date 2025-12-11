import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// Get all job applications
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, domain } = req.query;
    
    const where: any = {};
    if (type && (type === 'JOB' || type === 'INTERNSHIP')) {
      where.type = type;
    }
    if (domain) {
      where.domain = domain;
    }

    const applications = await prisma.jobApplication.findMany({
      where,
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

    res.json({ applications });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to fetch job applications' });
  }
});

// Get a single job application
router.get('/:applicationId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { applicationId } = req.params;

    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true,
            email: true,
            mobile: true
          }
        }
      }
    });

    if (!application) {
      res.status(404).json({ error: 'Job application not found' });
      return;
    }

    res.json({ application });
  } catch (error) {
    console.error('Get job application error:', error);
    res.status(500).json({ error: 'Failed to fetch job application' });
  }
});

// Create a new job application
router.post(
  '/',
  authMiddleware,
  [
    body('candidateName').isLength({ min: 2 }).withMessage('Candidate name must be at least 2 characters'),
    body('type').isIn(['JOB', 'INTERNSHIP']).withMessage('Type must be JOB or INTERNSHIP'),
    body('domain').isLength({ min: 2 }).withMessage('Domain is required'),
    body('brief').isLength({ min: 10 }).withMessage('Brief must be at least 10 characters'),
    body('resumeUrl').isURL().withMessage('Valid resume URL is required'),
    body('contactEmail').optional().isEmail().withMessage('Invalid email format'),
    body('contactPhone').optional().isString()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { candidateName, type, domain, brief, resumeUrl, contactEmail, contactPhone } = req.body;

      const application = await prisma.jobApplication.create({
        data: {
          userId: req.user!.id,
          candidateName,
          type,
          domain,
          brief,
          resumeUrl,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null
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

      res.status(201).json({ application });
    } catch (error) {
      console.error('Create job application error:', error);
      res.status(500).json({ error: 'Failed to create job application' });
    }
  }
);

// Update a job application
router.put(
  '/:applicationId',
  authMiddleware,
  [
    body('candidateName').optional().isLength({ min: 2 }),
    body('type').optional().isIn(['JOB', 'INTERNSHIP']),
    body('domain').optional().isLength({ min: 2 }),
    body('brief').optional().isLength({ min: 10 }),
    body('resumeUrl').optional().isURL(),
    body('contactEmail').optional().isEmail(),
    body('contactPhone').optional().isString()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { candidateName, type, domain, brief, resumeUrl, contactEmail, contactPhone } = req.body;

      // Check if application exists and user owns it
      const existingApplication = await prisma.jobApplication.findUnique({
        where: { id: applicationId }
      });

      if (!existingApplication) {
        res.status(404).json({ error: 'Job application not found' });
        return;
      }

      if (existingApplication.userId !== req.user!.id) {
        res.status(403).json({ error: 'Unauthorized to update this application' });
        return;
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const updatedApplication = await prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          candidateName,
          type,
          domain,
          brief,
          resumeUrl,
          contactEmail,
          contactPhone
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

      res.json({ application: updatedApplication });
    } catch (error) {
      console.error('Update job application error:', error);
      res.status(500).json({ error: 'Failed to update job application' });
    }
  }
);

// Delete a job application
router.delete('/:applicationId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { applicationId } = req.params;

    // Check if application exists and user owns it
    const existingApplication = await prisma.jobApplication.findUnique({
      where: { id: applicationId }
    });

    if (!existingApplication) {
      res.status(404).json({ error: 'Job application not found' });
      return;
    }

    if (existingApplication.userId !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized to delete this application' });
      return;
    }

    await prisma.jobApplication.delete({
      where: { id: applicationId }
    });

    res.json({ message: 'Job application deleted successfully' });
  } catch (error) {
    console.error('Delete job application error:', error);
    res.status(500).json({ error: 'Failed to delete job application' });
  }
});

export default router;
