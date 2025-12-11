import express, { Response } from 'express';
import { authMiddleware, isPodOwner, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';
import { checkPodMembership, checkPodOwnership, userSelectMinimal } from '../utils/permissions.js';

const router = express.Router();

// Search pods by name
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const pods = await prisma.pod.findMany({
      where: {
        isPublic: true,
        name: {
          contains: q as string,
          mode: 'insensitive'
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pods });
  } catch (error) {
    console.error('Search pods error:', error);
    res.status(500).json({ error: 'Failed to search pods' });
  }
});

// Get all public pods
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pods = await prisma.pod.findMany({
      where: { isPublic: true },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pods });
  } catch (error) {
    console.error('Get pods error:', error);
    res.status(500).json({ error: 'Failed to fetch pods' });
  }
});

// Get user's joined pods
router.get('/joined', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const podMemberships = await prisma.podMember.findMany({
      where: { userId: req.user!.id },
      include: {
        pod: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            },
            _count: {
              select: {
                members: true,
                posts: true
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    const pods = podMemberships.map(membership => membership.pod);

    res.json({ pods });
  } catch (error) {
    console.error('Get joined pods error:', error);
    res.status(500).json({ error: 'Failed to fetch joined pods' });
  }
});

// Get user's owned pods
router.get('/owned', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pods = await prisma.pod.findMany({
      where: { ownerId: req.user!.id },
      include: {
        _count: {
          select: {
            members: true,
            posts: true,
            rooms: true,
            events: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pods });
  } catch (error) {
    console.error('Get owned pods error:', error);
    res.status(500).json({ error: 'Failed to fetch owned pods' });
  }
});

// Get pod by ID
router.get('/:podId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true
          }
        },
        coOwners: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                profilePhoto: true,
                email: true,
                mobile: true,
                role: true,
                createdAt: true
              }
            }
          }
        },
        _count: {
          select: {
            posts: true,
            rooms: true,
            events: true
          }
        }
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Check if user is a member
    const isMember = pod.members.some(member => member.userId === req.user!.id);
    const isOwner = pod.ownerId === req.user!.id;

    res.json({ pod, isMember, isOwner });
  } catch (error) {
    console.error('Get pod error:', error);
    res.status(500).json({ error: 'Failed to fetch pod' });
  }
});

// Create pod
router.post('/',
  authMiddleware,
  isPodOwner,
  [
    body('name').isLength({ min: 3 }).withMessage('Pod name must be at least 3 characters'),
    body('subcategory').optional().isString(),
    body('focusAreas').optional().isArray(),
    body('organisationName').optional().isString(),
    body('organisationType').optional().isIn(['GOVERNMENT', 'PRIVATE']),
    body('organisationEmail').optional().isEmail().withMessage('Invalid email format'),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { 
        name, 
        description, 
        isPublic, 
        avatar, 
        logo,
        coverImage,
        subcategory,
        focusAreas,
        organisationName,
        organisationType,
        organisationEmail,
        operatingCity,
        totalInvestmentSize,
        numberOfInvestments,
        briefAboutOrganisation,
        socialLinks,
        website,
        // Advanced fields
        supportedDomains,
        supportedStages,
        communityType,
        investmentAreas,
        investmentStages,
        chequeSize,
        investmentThesis,
        serviceType,
        programmeDuration,
        numberOfStartups,
        focusedSectors,
        benefits,
        innovationFocusArea,
        collaborationModel,
        fundingGrantSupport,
        schemeName,
        programmeObjectives,
        benefitsOffered,
        eligibilityCriteria,
        eventsConducted
      } = req.body;

      // Map socialLinks to individual URL fields
      const podData: any = {
        name,
        description,
        isPublic: isPublic !== undefined ? isPublic : true,
        avatar,
        logo,
        coverImage,
        subcategory,
        focusAreas: focusAreas || [],
        organisationName,
        organisationType,
        organisationEmail,
        operatingCity,
        totalInvestmentSize,
        numberOfInvestments: numberOfInvestments ? parseInt(numberOfInvestments) : null,
        briefAboutOrganisation,
        website,
        // Advanced fields
        supportedDomains: supportedDomains || [],
        supportedStages: supportedStages || [],
        communityType,
        investmentAreas: investmentAreas || [],
        investmentStages: investmentStages || [],
        chequeSize,
        investmentThesis,
        serviceType,
        programmeDuration,
        numberOfStartups: numberOfStartups ? parseInt(numberOfStartups) : null,
        focusedSectors: focusedSectors || [],
        benefits,
        innovationFocusArea,
        collaborationModel,
        fundingGrantSupport,
        schemeName,
        programmeObjectives,
        benefitsOffered,
        eligibilityCriteria,
        eventsConducted: eventsConducted || [],
        ownerId: req.user!.id
      };

      // Map social links if provided
      if (socialLinks) {
        podData.linkedinUrl = socialLinks.linkedin || null;
        podData.othersUrl = socialLinks.others || null;
        podData.additionalLinks = socialLinks.additionalLinks || [];
      }

      const pod = await prisma.pod.create({
        data: podData,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      res.status(201).json({ pod });
    } catch (error) {
      console.error('Create pod error:', error);
      res.status(500).json({ error: 'Failed to create pod' });
    }
  }
);

// Update pod
router.put('/:podId',
  authMiddleware,
  isPodOwner,
  [
    body('name').optional().isLength({ min: 3 }),
    body('description').optional().isString(),
    body('isPublic').optional().isBoolean()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { podId } = req.params;
      const { name, description, isPublic, avatar, coverImage } = req.body;

      // Check ownership
      const pod = await prisma.pod.findUnique({
        where: { id: podId }
      });

      if (!pod) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }

      if (pod.ownerId !== req.user!.id) {
        res.status(403).json({ error: 'You are not the owner of this pod' });
        return;
      }

      const updatedPod = await prisma.pod.update({
        where: { id: podId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(isPublic !== undefined && { isPublic }),
          ...(avatar !== undefined && { avatar }),
          ...(coverImage !== undefined && { coverImage })
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          }
        }
      });

      res.json({ pod: updatedPod });
    } catch (error) {
      console.error('Update pod error:', error);
      res.status(500).json({ error: 'Failed to update pod' });
    }
  }
);

// Delete pod
router.delete('/:podId', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    // Check ownership
    const pod = await prisma.pod.findUnique({
      where: { id: podId }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You are not the owner of this pod' });
      return;
    }

    await prisma.pod.delete({
      where: { id: podId }
    });

    res.json({ message: 'Pod deleted successfully' });
  } catch (error) {
    console.error('Delete pod error:', error);
    res.status(500).json({ error: 'Failed to delete pod' });
  }
});

// Join pod
router.post('/:podId/join', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    // Check if pod exists
    const pod = await prisma.pod.findUnique({
      where: { id: podId }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Check if already a member
    const existingMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: req.user!.id
        }
      }
    });

    if (existingMember) {
      res.status(400).json({ error: 'Already a member of this pod' });
      return;
    }

    const membership = await prisma.podMember.create({
      data: {
        podId,
        userId: req.user!.id
      },
      include: {
        pod: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ membership });
  } catch (error) {
    console.error('Join pod error:', error);
    res.status(500).json({ error: 'Failed to join pod' });
  }
});

// Leave pod
router.post('/:podId/leave', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    const membership = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId: req.user!.id
        }
      }
    });

    if (!membership) {
      res.status(404).json({ error: 'Not a member of this pod' });
      return;
    }

    await prisma.podMember.delete({
      where: {
        podId_userId: {
          podId,
          userId: req.user!.id
        }
      }
    });

    res.json({ message: 'Left pod successfully' });
  } catch (error) {
    console.error('Leave pod error:', error);
    res.status(500).json({ error: 'Failed to leave pod' });
  }
});

// Remove member (owner only)
router.delete('/:podId/members/:userId', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check ownership
    const pod = await prisma.pod.findUnique({
      where: { id: podId }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You are not the owner of this pod' });
      return;
    }

    const membership = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId
        }
      }
    });

    if (!membership) {
      res.status(404).json({ error: 'User is not a member of this pod' });
      return;
    }

    await prisma.podMember.delete({
      where: {
        podId_userId: {
          podId,
          userId
        }
      }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Get pods by subcategory
router.get('/subcategory/:subcategory', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subcategory } = req.params;
    
    const pods = await prisma.pod.findMany({
      where: {
        isPublic: true,
        isApproved: true,
        subcategory: subcategory as any
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pods });
  } catch (error) {
    console.error('Get pods by subcategory error:', error);
    res.status(500).json({ error: 'Failed to fetch pods' });
  }
});

// Get pod members
router.get('/:podId/members', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    const members = await prisma.podMember.findMany({
      where: { podId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            email: true,
            mobile: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        joinedAt: 'asc'
      }
    });

    const memberData = members.map(m => ({
      ...m.user,
      isCoOwner: m.isCoOwner,
      joinedAt: m.joinedAt
    }));
    
    res.json({ members: memberData });
  } catch (error) {
    console.error('Get pod members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add co-owner (owner only)
router.post('/:podId/co-owners', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    // Check ownership
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        coOwners: true
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You are not the owner of this pod' });
      return;
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if already a co-owner
    if (pod.coOwners.some(co => co.id === user.id)) {
      res.status(400).json({ error: 'User is already a co-owner' });
      return;
    }

    // Add co-owner
    const updatedPod = await prisma.pod.update({
      where: { id: podId },
      data: {
        coOwners: {
          connect: { id: user.id }
        }
      },
      include: {
        coOwners: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true
          }
        }
      }
    });

    res.json({ pod: updatedPod });
  } catch (error) {
    console.error('Add co-owner error:', error);
    res.status(500).json({ error: 'Failed to add co-owner' });
  }
});

// Remove co-owner (owner only)
router.delete('/:podId/co-owners/:userId', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check ownership
    const pod = await prisma.pod.findUnique({
      where: { id: podId }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You are not the owner of this pod' });
      return;
    }

    // Remove co-owner
    await prisma.pod.update({
      where: { id: podId },
      data: {
        coOwners: {
          disconnect: { id: userId }
        }
      }
    });

    res.json({ message: 'Co-owner removed successfully' });
  } catch (error) {
    console.error('Remove co-owner error:', error);
    res.status(500).json({ error: 'Failed to remove co-owner' });
  }
});

// Upload pod logo (placeholder)
router.post('/:podId/logo', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const { logoUrl } = req.body;

    if (!logoUrl) {
      res.status(400).json({ error: 'Logo URL is required' });
      return;
    }

    // Check ownership
    const pod = await prisma.pod.findUnique({
      where: { id: podId }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'You are not the owner of this pod' });
      return;
    }

    const updatedPod = await prisma.pod.update({
      where: { id: podId },
      data: {
        logo: logoUrl,
        avatar: logoUrl
      }
    });

    res.json({ logoUrl: updatedPod.logo });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Get pending approval pods (admin only - placeholder)
router.get('/admin/pending', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const pods = await prisma.pod.findMany({
      where: {
        isApproved: false
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            email: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ pods });
  } catch (error) {
    console.error('Get pending pods error:', error);
    res.status(500).json({ error: 'Failed to fetch pending pods' });
  }
});

// Approve pod (admin only - placeholder)
router.post('/:podId/approve', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    const updatedPod = await prisma.pod.update({
      where: { id: podId },
      data: {
        isApproved: true
      }
    });

    res.json({ pod: updatedPod });
  } catch (error) {
    console.error('Approve pod error:', error);
    res.status(500).json({ error: 'Failed to approve pod' });
  }
});

// Promote member to co-owner (owner only)
router.post('/:podId/members/:userId/promote', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check if requester is the pod owner
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Only the pod owner can promote members to co-owner' });
      return;
    }

    // Check if user is a member
    const member = await prisma.podMember.findUnique({
      where: {
        podId_userId: { podId, userId }
      }
    });

    if (!member) {
      res.status(404).json({ error: 'User is not a member of this pod' });
      return;
    }

    if (member.isCoOwner) {
      res.status(400).json({ error: 'User is already a co-owner' });
      return;
    }

    // Promote to co-owner
    const updatedMember = await prisma.podMember.update({
      where: {
        podId_userId: { podId, userId }
      },
      data: {
        isCoOwner: true
      },
      include: {
        user: {
          select: userSelectMinimal
        }
      }
    });

    res.json({ 
      message: 'Member promoted to co-owner successfully',
      member: updatedMember 
    });
  } catch (error) {
    console.error('Promote to co-owner error:', error);
    res.status(500).json({ error: 'Failed to promote member to co-owner' });
  }
});

// Demote co-owner to regular member (owner only)
router.post('/:podId/members/:userId/demote', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check if requester is the pod owner
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Only the pod owner can demote co-owners' });
      return;
    }

    // Check if user is a co-owner
    const member = await prisma.podMember.findUnique({
      where: {
        podId_userId: { podId, userId }
      }
    });

    if (!member) {
      res.status(404).json({ error: 'User is not a member of this pod' });
      return;
    }

    if (!member.isCoOwner) {
      res.status(400).json({ error: 'User is not a co-owner' });
      return;
    }

    // Demote to regular member
    const updatedMember = await prisma.podMember.update({
      where: {
        podId_userId: { podId, userId }
      },
      data: {
        isCoOwner: false
      },
      include: {
        user: {
          select: userSelectMinimal
        }
      }
    });

    res.json({ 
      message: 'Co-owner demoted to regular member successfully',
      member: updatedMember 
    });
  } catch (error) {
    console.error('Demote co-owner error:', error);
    res.status(500).json({ error: 'Failed to demote co-owner' });
  }
});

export default router;
