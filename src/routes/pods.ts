import express, { Response } from 'express';
import { authMiddleware, isPodOwner, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';
import { checkPodMembership, checkPodOwnership, userSelectMinimal } from '../utils/permissions.js';
import { createAndEmitNotification } from '../utils/notifications.js';

const router = express.Router();

// Search pods by name
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q) {
      res.status(400).json({ error: 'Please enter a search term to find pods.' });
      return;
    }

    const pods = await prisma.pod.findMany({
      where: {
        isPublic: true,
        isApproved: true, // Only search approved pods
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
      where: { 
        isPublic: true,
        isApproved: true // Only show approved pods
      },
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

    // Get pods where user is a member
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
            members: {
              where: { isCoOwner: true },
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

    // Get pods where user is the owner (only approved pods)
    const ownedPods = await prisma.pod.findMany({
      where: { 
        ownerId: req.user!.id,
        isApproved: true // Only show approved pods
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
        members: {
          where: { isCoOwner: true },
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
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      }
    });

    // Combine and deduplicate pods with co-owner status
    const memberPodsWithStatus = podMemberships.map(membership => {
      const coOwners = membership.pod.members.map(m => m.user);
      const coOwnerIds = coOwners.map(co => co.id);
      return {
        ...membership.pod,
        coOwners,
        coOwnerIds,
        members: undefined, // Remove the members object from response
        isCoOwner: membership.isCoOwner, // Add co-owner flag to each pod
        userRole: membership.pod.ownerId === req.user!.id ? 'owner' : (membership.isCoOwner ? 'co-owner' : 'member')
      };
    });
    
    const ownedPodsWithStatus = ownedPods.map(pod => {
      const coOwners = pod.members.map(m => m.user);
      const coOwnerIds = coOwners.map(co => co.id);
      return {
        ...pod,
        coOwners,
        coOwnerIds,
        members: undefined, // Remove the members object from response
        isCoOwner: false, // Owners are not co-owners
        userRole: 'owner'
      };
    });
    
    const allPods = [...ownedPodsWithStatus, ...memberPodsWithStatus];
    
    // Remove duplicates by pod ID, keeping the one with highest privilege
    const podMap = new Map();
    allPods.forEach(pod => {
      const existing = podMap.get(pod.id);
      if (!existing || pod.userRole === 'owner' || (pod.userRole === 'co-owner' && existing.userRole === 'member')) {
        podMap.set(pod.id, pod);
      }
    });
    
    const uniquePods = Array.from(podMap.values());

    res.json({ pods: uniquePods });
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

    const pod = await prisma.pod.findFirst({
      where: { 
        id: podId,
        OR: [
          { isApproved: true }, // Approved pods visible to all
          { ownerId: req.user!.id } // Owners can see their own unapproved pods
        ]
      },
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
            createdAt: true,
            acceptingCalls: true
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
                createdAt: true,
                acceptingCalls: true
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
      res.status(404).json({ error: 'This pod does not exist or has been removed.' });
      return;
    }

    // Get co-owners from members where isCoOwner = true
    const coOwners = pod.members
      .filter(member => member.isCoOwner)
      .map(member => member.user);

    // Get team members from members where isTeamMember = true
    const teamMembers = pod.members
      .filter(member => member.isTeamMember)
      .map(member => ({
        ...member.user,
        joinedAt: member.joinedAt,
        isTeamMember: true
      }));

    // Check if user is a member
    const isMember = pod.members.some(member => member.userId === req.user!.id);
    const isOwner = pod.ownerId === req.user!.id;
    
    // Check if user is team member
    const userMembership = pod.members.find(member => member.userId === req.user!.id);
    const isTeamMember = userMembership?.isTeamMember || false;

    // Format social links for frontend
    const formattedPod = {
      ...pod,
      coOwners,
      teamMembers,
      socialLinks: {
        linkedin: pod.linkedinUrl,
        instagram: pod.instagramUrl,
        facebook: pod.facebookUrl,
        twitter: pod.twitterUrl,
        youtube: pod.youtubeUrl,
        github: pod.githubUrl,
        portfolio: pod.portfolioUrl,
        others: pod.othersUrl,
        additionalLinks: pod.additionalLinks || []
      }
    };

    res.json({ pod: formattedPod, isMember, isOwner, isTeamMember });
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
    body('name').isLength({ min: 3, max: 20 }).withMessage('Pod name must be between 3 and 20 characters'),
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
        console.error('Pod creation validation errors:', JSON.stringify(errors.array(), null, 2));
        res.status(400).json({ 
          error: 'Validation failed',
          errors: errors.array(),
          details: errors.array().map(e => `${(e as any).path || 'unknown'}: ${e.msg}`)
        });
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
        eventsConducted,
        coOwnerUsernames
      } = req.body;

      // Map socialLinks to individual URL fields
      const podData: any = {
        name,
        description,
        isPublic: isPublic !== undefined ? isPublic : true,
        isApproved: false, // Require admin approval for new pods
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

      // Automatically add pod owner as a member
      await prisma.podMember.create({
        data: {
          podId: pod.id,
          userId: req.user!.id,
          isCoOwner: false
        }
      });

      // Add co-owners if provided
      if (coOwnerUsernames && coOwnerUsernames.length > 0) {
        const coOwnerUsers = await prisma.user.findMany({
          where: {
            username: {
              in: coOwnerUsernames
            }
          },
          select: {
            id: true,
            username: true
          }
        });

        if (coOwnerUsers.length > 0) {
          await prisma.podMember.createMany({
            data: coOwnerUsers.map(user => ({
              podId: pod.id,
              userId: user.id,
              isCoOwner: true
            })),
            skipDuplicates: true
          });
        }
      }

      res.status(201).json({ pod });
    } catch (error) {
      console.error('Create pod error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      res.status(500).json({ 
        error: 'Failed to create pod',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Update pod
router.put('/:podId',
  authMiddleware,
  [
    body('name').optional().isLength({ min: 3, max: 20 }).withMessage('Pod name must be between 3 and 20 characters'),
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

      // Check ownership or co-ownership
      const pod = await prisma.pod.findUnique({
        where: { id: podId },
        include: {
          members: {
            where: {
              userId: req.user!.id,
              isCoOwner: true
            }
          }
        }
      });

      if (!pod) {
        res.status(404).json({ error: 'Pod not found' });
        return;
      }

      // Check if user is owner or co-owner
      const isOwner = pod.ownerId === req.user!.id;
      const isCoOwner = pod.members.length > 0;

      if (!isOwner && !isCoOwner) {
        res.status(403).json({ error: 'Only pod owners and co-owners can edit this pod.' });
        return;
      }

      const {
        name,
        description,
        isPublic,
        avatar,
        coverImage,
        logo,
        organisationName,
        organisationType,
        organisationEmail,
        operatingCity,
        website,
        focusAreas,
        totalInvestmentSize,
        numberOfInvestments,
        briefAboutOrganisation,
        socialLinks,
        coOwnerUsernames,
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

      // Prepare update data
      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isPublic !== undefined) updateData.isPublic = isPublic;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (coverImage !== undefined) updateData.coverImage = coverImage;
      if (logo !== undefined) updateData.logo = logo;
      if (organisationName !== undefined) updateData.organisationName = organisationName;
      if (organisationType !== undefined) updateData.organisationType = organisationType;
      if (organisationEmail !== undefined) updateData.organisationEmail = organisationEmail;
      if (operatingCity !== undefined) updateData.operatingCity = operatingCity;
      if (website !== undefined) updateData.website = website;
      if (focusAreas !== undefined) updateData.focusAreas = focusAreas;
      if (totalInvestmentSize !== undefined) updateData.totalInvestmentSize = totalInvestmentSize;
      if (numberOfInvestments !== undefined) updateData.numberOfInvestments = numberOfInvestments;
      if (briefAboutOrganisation !== undefined) updateData.briefAboutOrganisation = briefAboutOrganisation;
      
      // Social links (Pod model only has linkedin, instagram, facebook, twitter, youtube, others)
      if (socialLinks !== undefined) {
        if (socialLinks.linkedin !== undefined) updateData.linkedinUrl = socialLinks.linkedin;
        if (socialLinks.instagram !== undefined) updateData.instagramUrl = socialLinks.instagram;
        if (socialLinks.facebook !== undefined) updateData.facebookUrl = socialLinks.facebook;
        if (socialLinks.twitter !== undefined) updateData.twitterUrl = socialLinks.twitter;
        if (socialLinks.youtube !== undefined) updateData.youtubeUrl = socialLinks.youtube;
        if (socialLinks.others !== undefined) updateData.othersUrl = socialLinks.others;
        // Note: Pod model doesn't have githubUrl or portfolioUrl fields
      }

      // Advanced fields
      if (supportedDomains !== undefined) updateData.supportedDomains = supportedDomains;
      if (supportedStages !== undefined) updateData.supportedStages = supportedStages;
      if (communityType !== undefined) updateData.communityType = communityType;
      if (investmentAreas !== undefined) updateData.investmentAreas = investmentAreas;
      if (investmentStages !== undefined) updateData.investmentStages = investmentStages;
      if (chequeSize !== undefined) updateData.chequeSize = chequeSize;
      if (investmentThesis !== undefined) updateData.investmentThesis = investmentThesis;
      if (serviceType !== undefined) updateData.serviceType = serviceType;
      if (programmeDuration !== undefined) updateData.programmeDuration = programmeDuration;
      if (numberOfStartups !== undefined) updateData.numberOfStartups = numberOfStartups;
      if (focusedSectors !== undefined) updateData.focusedSectors = focusedSectors;
      if (benefits !== undefined) updateData.benefits = benefits;
      if (innovationFocusArea !== undefined) updateData.innovationFocusArea = innovationFocusArea;
      if (collaborationModel !== undefined) updateData.collaborationModel = collaborationModel;
      if (fundingGrantSupport !== undefined) updateData.fundingGrantSupport = fundingGrantSupport;
      if (schemeName !== undefined) updateData.schemeName = schemeName;
      if (programmeObjectives !== undefined) updateData.programmeObjectives = programmeObjectives;
      if (benefitsOffered !== undefined) updateData.benefitsOffered = benefitsOffered;
      if (eligibilityCriteria !== undefined) updateData.eligibilityCriteria = eligibilityCriteria;
      if (eventsConducted !== undefined) updateData.eventsConducted = eventsConducted;

      // Handle co-owners update (only owner can modify co-owners)
      if (coOwnerUsernames !== undefined && isOwner) {
        // Get current co-owners
        const currentCoOwners = await prisma.podMember.findMany({
          where: { podId, isCoOwner: true }
        });

        // Find users by username
        const newCoOwners = await prisma.user.findMany({
          where: { username: { in: coOwnerUsernames } }
        });

        // Remove old co-owners
        await prisma.podMember.deleteMany({
          where: {
            podId,
            isCoOwner: true,
            userId: { notIn: newCoOwners.map(u => u.id) }
          }
        });

        // Add new co-owners
        for (const coOwner of newCoOwners) {
          await prisma.podMember.upsert({
            where: {
              podId_userId: {
                podId,
                userId: coOwner.id
              }
            },
            update: { isCoOwner: true },
            create: {
              userId: coOwner.id,
              podId,
              isCoOwner: true
            }
          });
        }
      }

      console.log('Updating pod with data:', JSON.stringify(updateData, null, 2));

      const updatedPod = await prisma.pod.update({
        where: { id: podId },
        data: updateData,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          members: {
            where: { isCoOwner: true },
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
          },
          _count: {
            select: {
              members: true,
              posts: true
            }
          }
        }
      });

      // Format response to match frontend expectations
      const formattedPod = {
        ...updatedPod,
        socialLinks: {
          linkedin: updatedPod.linkedinUrl,
          instagram: updatedPod.instagramUrl,
          facebook: updatedPod.facebookUrl,
          twitter: updatedPod.twitterUrl,
          youtube: updatedPod.youtubeUrl,
          github: updatedPod.githubUrl,
          portfolio: updatedPod.portfolioUrl,
          others: updatedPod.othersUrl,
          additionalLinks: updatedPod.additionalLinks || []
        },
        coOwners: updatedPod.members.map(m => ({
          id: m.user.id,
          username: m.user.username,
          fullName: m.user.fullName,
          avatar: m.user.avatar
        }))
      };

      res.json({ pod: formattedPod });
    } catch (error: any) {
      console.error('Update pod error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      res.status(500).json({ 
        error: 'Failed to update pod',
        details: error.message 
      });
    }
  }
);

// Toggle accepting pitches for a pod
router.patch('/:podId/accepting-pitches', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const { acceptingPitches } = req.body;

    if (typeof acceptingPitches !== 'boolean') {
      res.status(400).json({ error: 'acceptingPitches must be a boolean value' });
      return;
    }

    // Check if pod exists and user has permission
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      include: {
        members: {
          where: {
            userId: req.user!.id,
            isCoOwner: true
          }
        }
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Check if user is owner or co-owner
    const isOwner = pod.ownerId === req.user!.id;
    const isCoOwner = pod.members.length > 0;

    if (!isOwner && !isCoOwner) {
      res.status(403).json({ error: 'Only pod owners and co-owners can modify pitch acceptance settings' });
      return;
    }

    // Update the pod
    const updatedPod = await prisma.pod.update({
      where: { id: podId },
      data: { acceptingPitches },
      select: {
        id: true,
        name: true,
        acceptingPitches: true
      }
    });

    res.json({ 
      message: `Pod is now ${acceptingPitches ? 'accepting' : 'not accepting'} pitches`,
      pod: updatedPod 
    });
  } catch (error) {
    console.error('Toggle accepting pitches error:', error);
    res.status(500).json({ error: 'Failed to update pitch acceptance settings' });
  }
});

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
      where: { id: podId },
      select: { id: true, name: true, ownerId: true }
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

    // Create notification for pod owner
    if (pod && pod.ownerId !== req.user!.id) {
      await createAndEmitNotification({
        userId: pod.ownerId,
        type: 'pod_join',
        title: 'New Member',
        message: `${req.user!.fullName} joined ${pod.name}`,
        linkedId: podId
      });
    }

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
      isTeamMember: m.isTeamMember,
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

// Assign member as team member (owner only)
router.post('/:podId/members/:userId/assign-team-member', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check if requesting user is the pod owner
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Only the pod owner can assign team members' });
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
      res.status(400).json({ error: 'Co-owners cannot be team members. Please demote from co-owner first.' });
      return;
    }

    if (member.isTeamMember) {
      res.status(400).json({ error: 'User is already a team member' });
      return;
    }

    // Assign as team member
    const updatedMember = await prisma.podMember.update({
      where: {
        podId_userId: { podId, userId }
      },
      data: {
        isTeamMember: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            profilePhoto: true,
            email: true,
            mobile: true
          }
        }
      }
    });

    res.json({ 
      message: 'Member assigned as team member successfully',
      member: updatedMember 
    });
  } catch (error) {
    console.error('Assign team member error:', error);
    res.status(500).json({ error: 'Failed to assign team member' });
  }
});

// Remove team member status (owner only)
router.delete('/:podId/members/:userId/remove-team-member', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId, userId } = req.params;

    // Check if requesting user is the pod owner
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (pod.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Only the pod owner can remove team members' });
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

    if (!member.isTeamMember) {
      res.status(400).json({ error: 'User is not a team member' });
      return;
    }

    // Remove team member status
    const updatedMember = await prisma.podMember.update({
      where: {
        podId_userId: { podId, userId }
      },
      data: {
        isTeamMember: false
      },
      include: {
        user: {
          select: userSelectMinimal
        }
      }
    });

    res.json({ 
      message: 'Team member status removed successfully',
      member: updatedMember 
    });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Get team members of a pod
router.get('/:podId/team-members', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    // Check if pod exists
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { id: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Get team members
    const teamMembers = await prisma.podMember.findMany({
      where: {
        podId,
        isTeamMember: true
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
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

    const teamMemberUsers = teamMembers.map(tm => ({
      ...tm.user,
      joinedAt: tm.joinedAt,
      isTeamMember: true
    }));

    res.json({ teamMembers: teamMemberUsers });
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get pod shareable link and QR code
router.get('/:podId/share', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: {
        id: true,
        name: true,
        shareableCode: true,
        isPublic: true,
        isApproved: true
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (!pod.isPublic || !pod.isApproved) {
      res.status(403).json({ error: 'This pod is not available for sharing' });
      return;
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareableLink = `${baseUrl}/join/${pod.shareableCode}`;

    res.json({
      shareableCode: pod.shareableCode,
      shareableLink,
      podName: pod.name
    });
  } catch (error) {
    console.error('Get shareable link error:', error);
    res.status(500).json({ error: 'Failed to get shareable link' });
  }
});

// Join pod via shareable code
router.post('/join/:shareableCode', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { shareableCode } = req.params;
    const userId = req.user!.id;

    const pod = await prisma.pod.findUnique({
      where: { shareableCode },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true
          }
        },
        members: {
          where: { userId },
          select: { id: true }
        }
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Invalid or expired link' });
      return;
    }

    if (!pod.isPublic || !pod.isApproved) {
      res.status(403).json({ error: 'This pod is not available for joining' });
      return;
    }

    // Check if user is already a member
    if (pod.members.length > 0) {
      res.status(400).json({ error: 'You are already a member of this pod' });
      return;
    }

    // Check if user is the owner
    if (pod.ownerId === userId) {
      res.status(400).json({ error: 'You are the owner of this pod' });
      return;
    }

    // Add user to pod
    await prisma.podMember.create({
      data: {
        userId,
        podId: pod.id
      }
    });

    // Create notification for pod owner
    await createAndEmitNotification({
      userId: pod.ownerId,
      type: 'pod_new_member',
      title: 'New Member Joined',
      message: `${req.user!.fullName || req.user!.username} joined ${pod.name} via shared link`,
      metadata: {
        podId: pod.id,
        podName: pod.name,
        newMemberId: userId,
        newMemberName: req.user!.fullName || req.user!.username
      }
    });

    res.json({
      success: true,
      message: 'Successfully joined the pod',
      pod: {
        id: pod.id,
        name: pod.name,
        description: pod.description,
        logo: pod.logo
      }
    });
  } catch (error) {
    console.error('Join pod by code error:', error);
    res.status(500).json({ error: 'Failed to join pod' });
  }
});

// Get pod by shareable code (public view for non-members)
router.get('/preview/:shareableCode', async (req, res): Promise<void> => {
  try {
    const { shareableCode } = req.params;

    const pod = await prisma.pod.findUnique({
      where: { shareableCode },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            profilePhoto: true
          }
        },
        _count: {
          select: {
            members: true,
            posts: true
          }
        }
      }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    if (!pod.isPublic || !pod.isApproved) {
      res.status(403).json({ error: 'This pod is not available' });
      return;
    }

    res.json({ pod });
  } catch (error) {
    console.error('Get pod preview error:', error);
    res.status(500).json({ error: 'Failed to fetch pod details' });
  }
});

export default router;
