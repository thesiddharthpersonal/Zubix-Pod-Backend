import express, { Response } from 'express';
import { authMiddleware, isPodOwner, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';

const router = express.Router();

// Get all rooms in a pod
router.get('/pod/:podId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const userId = req.user!.id;

    // Check if user is a member or owner of the pod
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' });
    }

    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId
        }
      }
    });

    const isOwner = pod.ownerId === userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of this pod to view rooms' });
    }

    const allRooms = await prisma.room.findMany({
      where: { podId },
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            ownerId: true
          }
        },
        members: {
          where: { userId },
          select: { userId: true }
        },
        joinRequests: {
          where: { userId, status: 'PENDING' },
          select: { id: true, status: true }
        },
        _count: {
          select: {
            messages: true,
            members: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format rooms and include privacy/membership info
    const rooms = allRooms.map(room => {
      const isMemberOfRoom = room.members.length > 0;
      const hasPendingRequest = room.joinRequests.length > 0;
      const isPodOwner = room.pod.ownerId === userId;

      // Show all rooms to pod members, but indicate membership status
      return {
        ...room,
        isMember: isMemberOfRoom || isPodOwner,
        joinRequestStatus: hasPendingRequest ? 'PENDING' : null,
        members: undefined,
        joinRequests: undefined
      };
    });

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get a single room by ID
router.get('/:roomId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            ownerId: true
          }
        },
        _count: {
          select: {
            messages: true,
            members: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is a member or owner of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: room.podId,
          userId
        }
      }
    });

    const isOwner = room.pod.ownerId === userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of this pod to view this room' });
    }

    // Check if room is private and user has access
    if (room.privacy === 'PRIVATE' && !isOwner) {
      const roomMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      });

      if (!roomMember) {
        return res.status(403).json({ error: 'This is a private room. You need to be approved by the pod owner to access it.' });
      }
    }

    res.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create a room (pod owner only)
router.post('/',
  authMiddleware,
  isPodOwner,
  [
    body('name').isLength({ min: 3 }).withMessage('Room name must be at least 3 characters'),
    body('description').optional().isString(),
    body('podId').notEmpty().withMessage('Pod ID is required'),
    body('type').optional().isIn(['GENERAL', 'QA']).withMessage('Type must be GENERAL or QA'),
    body('privacy').optional().isIn(['PUBLIC', 'PRIVATE']).withMessage('Privacy must be PUBLIC or PRIVATE')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, podId, type, privacy } = req.body;

      // Check if user owns the pod
      const pod = await prisma.pod.findUnique({
        where: { id: podId }
      });

      if (!pod) {
        return res.status(404).json({ error: 'Pod not found' });
      }

      if (pod.ownerId !== req.user!.id) {
        return res.status(403).json({ error: 'You are not the owner of this pod' });
      }

      const room = await prisma.room.create({
        data: {
          name,
          description,
          podId,
          type: type || 'GENERAL',
          privacy: privacy || 'PUBLIC',
          createdBy: req.user!.id
        },
        include: {
          pod: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      // Automatically add pod owner as a room member for private rooms
      if (privacy === 'PRIVATE') {
        await prisma.roomMember.create({
          data: {
            roomId: room.id,
            userId: req.user!.id
          }
        });
      }

      res.status(201).json({ room });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  }
);

// Update a room (pod owner only)
router.put('/:roomId',
  authMiddleware,
  isPodOwner,
  [
    body('name').optional().isLength({ min: 3 }),
    body('description').optional().isString()
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { roomId } = req.params;
      const { name, description } = req.body;

      // Check if room exists and user owns the pod
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          pod: {
            select: {
              ownerId: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.pod.ownerId !== req.user!.id) {
        return res.status(403).json({ error: 'You are not the owner of this pod' });
      }

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description })
        },
        include: {
          pod: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      });

      res.json({ room: updatedRoom });
    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  }
);

// Delete a room (pod owner only)
router.delete('/:roomId', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;

    // Check if room exists and user owns the pod
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.pod.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'You are not the owner of this pod' });
    }

    await prisma.room.delete({
      where: { id: roomId }
    });

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Get messages in a room (with pagination)
router.get('/:roomId/messages', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { limit = '50', before } = req.query;
    const userId = req.user!.id;

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is a member or owner of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: room.pod.id,
          userId
        }
      }
    });

    const isOwner = room.pod.ownerId === userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of this pod to view messages' });
    }

    // Check if room is private and user has access
    if (room.privacy === 'PRIVATE' && !isOwner) {
      const roomMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      });

      if (!roomMember) {
        return res.status(403).json({ error: 'This is a private room. You need to be approved by the pod owner to access messages.' });
      }
    }

    const whereClause: any = {
      roomId
    };

    // If 'before' is provided, get messages before that message's createdAt
    if (before && typeof before === 'string') {
      const beforeMessage = await prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true }
      });

      if (beforeMessage) {
        whereClause.createdAt = {
          lt: beforeMessage.createdAt
        };
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(typeof limit === 'string' ? limit : '50')
    });

    res.json({ messages: messages.reverse() }); // Reverse to show oldest first
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add member to a private room (owner only)
router.post('/:roomId/members',
  authMiddleware,
  isPodOwner,
  [
    body('userId').notEmpty().withMessage('User ID is required')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { roomId } = req.params;
      const { userId } = req.body;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          pod: {
            select: {
              ownerId: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.pod.ownerId !== req.user!.id) {
        return res.status(403).json({ error: 'You are not the owner of this pod' });
      }

      // Check if already a member
      const existingMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      });

      if (existingMember) {
        return res.status(400).json({ error: 'User is already a member of this room' });
      }

      await prisma.roomMember.create({
        data: {
          roomId,
          userId
        }
      });

      res.json({ message: 'Member added successfully' });
    } catch (error) {
      console.error('Add room member error:', error);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// Remove member from room (owner only)
router.delete('/:roomId/members/:userId', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId, userId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.pod.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'You are not the owner of this pod' });
    }

    await prisma.roomMember.delete({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove room member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Request to join a private room
router.post('/:roomId/join-request', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user!.id;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is a member of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: room.pod.id,
          userId
        }
      }
    });

    const isOwner = room.pod.ownerId === userId;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of the pod to request joining a room' });
    }

    // Public rooms - directly add member
    if (room.privacy === 'PUBLIC') {
      const existingMember = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: {
            roomId,
            userId
          }
        }
      });

      if (existingMember) {
        return res.status(400).json({ error: 'You are already a member of this room' });
      }

      await prisma.roomMember.create({
        data: {
          roomId,
          userId
        }
      });

      return res.json({ message: 'Joined room successfully', status: 'JOINED' });
    }

    // Private rooms - create join request
    const existingRequest = await prisma.roomJoinRequest.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      }
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return res.status(400).json({ error: 'You already have a pending request for this room' });
      } else if (existingRequest.status === 'ACCEPTED') {
        return res.status(400).json({ error: 'Your request has already been accepted' });
      } else if (existingRequest.status === 'REJECTED') {
        // Update rejected request to pending
        await prisma.roomJoinRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'PENDING' }
        });
        return res.json({ message: 'Join request resubmitted', status: 'PENDING' });
      }
    }

    await prisma.roomJoinRequest.create({
      data: {
        roomId,
        userId
      }
    });

    res.status(201).json({ message: 'Join request submitted', status: 'PENDING' });
  } catch (error) {
    console.error('Room join request error:', error);
    res.status(500).json({ error: 'Failed to submit join request' });
  }
});

// Get pending join requests for a room (pod owner only)
router.get('/:roomId/join-requests', authMiddleware, isPodOwner, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.pod.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the pod owner can view join requests' });
    }

    const joinRequests = await prisma.roomJoinRequest.findMany({
      where: {
        roomId,
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({ joinRequests });
  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// Accept or reject a join request (pod owner only)
router.put('/:roomId/join-requests/:requestId',
  authMiddleware,
  isPodOwner,
  [
    body('status').isIn(['ACCEPTED', 'REJECTED']).withMessage('Status must be ACCEPTED or REJECTED')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { roomId, requestId } = req.params;
      const { status } = req.body;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          pod: {
            select: {
              ownerId: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.pod.ownerId !== req.user!.id) {
        return res.status(403).json({ error: 'Only the pod owner can manage join requests' });
      }

      const joinRequest = await prisma.roomJoinRequest.findUnique({
        where: { id: requestId }
      });

      if (!joinRequest) {
        return res.status(404).json({ error: 'Join request not found' });
      }

      if (joinRequest.roomId !== roomId) {
        return res.status(400).json({ error: 'Join request does not belong to this room' });
      }

      if (joinRequest.status !== 'PENDING') {
        return res.status(400).json({ error: 'This request has already been processed' });
      }

      // Update request status
      await prisma.roomJoinRequest.update({
        where: { id: requestId },
        data: { status }
      });

      // If accepted, add user to room members
      if (status === 'ACCEPTED') {
        const existingMember = await prisma.roomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: joinRequest.userId
            }
          }
        });

        if (!existingMember) {
          await prisma.roomMember.create({
            data: {
              roomId,
              userId: joinRequest.userId
            }
          });
        }
      }

      res.json({ 
        message: `Join request ${status.toLowerCase()} successfully`,
        status 
      });
    } catch (error) {
      console.error('Process join request error:', error);
      res.status(500).json({ error: 'Failed to process join request' });
    }
  }
);

// Get questions in a Q&A room
router.get('/:roomId/questions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        pod: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.type !== 'QA') {
      return res.status(400).json({ error: 'This room is not a Q&A room' });
    }

    // Check if user is a member or owner of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: room.pod.id,
          userId: req.user!.id
        }
      }
    });

    const isOwner = room.pod.ownerId === req.user!.id;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of this pod to view questions' });
    }

    const questions = await prisma.question.findMany({
      where: { roomId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true,
            createdAt: true
          }
        },
        answers: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                fullName: true,
                profilePhoto: true,
                role: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create a question in a Q&A room
router.post('/:roomId/questions',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('Question content is required')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { roomId } = req.params;
      const { content } = req.body;

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          pod: {
            select: {
              id: true,
              ownerId: true
            }
          }
        }
      });

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.type !== 'QA') {
        return res.status(400).json({ error: 'This room is not a Q&A room' });
      }

      // Check if user is a member or owner of the pod
      const isMember = await prisma.podMember.findUnique({
        where: {
          podId_userId: {
            podId: room.pod.id,
            userId: req.user!.id
          }
        }
      });

      const isOwner = room.pod.ownerId === req.user!.id;

      if (!isMember && !isOwner) {
        return res.status(403).json({ error: 'You must be a member of this pod to ask questions' });
      }

      const question = await prisma.question.create({
        data: {
          content,
          roomId,
          authorId: req.user!.id
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePhoto: true,
              role: true,
              createdAt: true
            }
          },
          answers: true
        }
      });

      res.status(201).json({ question });
    } catch (error) {
      console.error('Create question error:', error);
      res.status(500).json({ error: 'Failed to create question' });
    }
  }
);

// Delete a question
router.delete('/:roomId/questions/:questionId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { questionId } = req.params;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        room: {
          include: {
            pod: {
              select: {
                ownerId: true
              }
            }
          }
        }
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if user is the author or the pod owner
    const isAuthor = question.authorId === req.user!.id;
    const isPodOwner = question.room.pod.ownerId === req.user!.id;

    if (!isAuthor && !isPodOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this question' });
    }

    await prisma.question.delete({
      where: { id: questionId }
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Get answers for a question
router.get('/:roomId/questions/:questionId/answers', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { questionId } = req.params;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        room: {
          include: {
            pod: {
              select: {
                id: true,
                ownerId: true
              }
            }
          }
        }
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if user is a member or owner of the pod
    const isMember = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: question.room.pod.id,
          userId: req.user!.id
        }
      }
    });

    const isOwner = question.room.pod.ownerId === req.user!.id;

    if (!isMember && !isOwner) {
      return res.status(403).json({ error: 'You must be a member of this pod to view answers' });
    }

    const answers = await prisma.answer.findMany({
      where: { questionId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            fullName: true,
            profilePhoto: true,
            role: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json({ answers });
  } catch (error) {
    console.error('Get answers error:', error);
    res.status(500).json({ error: 'Failed to fetch answers' });
  }
});

// Add an answer to a question
router.post('/:roomId/questions/:questionId/answers',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('Answer content is required')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { questionId } = req.params;
      const { content } = req.body;

      const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: {
          room: {
            include: {
              pod: {
                select: {
                  id: true,
                  ownerId: true
                }
              }
            }
          }
        }
      });

      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // Check if user is a member or owner of the pod
      const isMember = await prisma.podMember.findUnique({
        where: {
          podId_userId: {
            podId: question.room.pod.id,
            userId: req.user!.id
          }
        }
      });

      const isOwner = question.room.pod.ownerId === req.user!.id;

      if (!isMember && !isOwner) {
        return res.status(403).json({ error: 'You must be a member of this pod to answer questions' });
      }

      const answer = await prisma.answer.create({
        data: {
          content,
          questionId,
          authorId: req.user!.id
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullName: true,
              profilePhoto: true,
              role: true,
              createdAt: true
            }
          }
        }
      });

      res.status(201).json({ answer });
    } catch (error) {
      console.error('Create answer error:', error);
      res.status(500).json({ error: 'Failed to create answer' });
    }
  }
);

// Delete an answer
router.delete('/:roomId/questions/:questionId/answers/:answerId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { answerId } = req.params;

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      include: {
        question: {
          include: {
            room: {
              include: {
                pod: {
                  select: {
                    ownerId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!answer) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    // Check if user is the author or the pod owner
    const isAuthor = answer.authorId === req.user!.id;
    const isPodOwner = answer.question.room.pod.ownerId === req.user!.id;

    if (!isAuthor && !isPodOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this answer' });
    }

    await prisma.answer.delete({
      where: { id: answerId }
    });

    res.json({ message: 'Answer deleted successfully' });
  } catch (error) {
    console.error('Delete answer error:', error);
    res.status(500).json({ error: 'Failed to delete answer' });
  }
});

export default router;

