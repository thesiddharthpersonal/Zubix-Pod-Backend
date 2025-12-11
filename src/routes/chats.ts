import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';

const router = express.Router();

// Get all chats for the current user
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const chatParticipants = await prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            participants: {
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
            messages: {
              take: 1,
              orderBy: {
                createdAt: 'desc'
              },
              include: {
                sender: {
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
        }
      },
      orderBy: {
        chat: {
          updatedAt: 'desc'
        }
      }
    });

    const chats = chatParticipants.map(cp => ({
      ...cp.chat,
      participants: cp.chat.participants.map(p => p.user),
      lastMessage: cp.chat.messages[0] || null
    }));

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Find chat by participants (GET method for checking if chat exists)
// IMPORTANT: Must be before /:chatId route to avoid matching "find" as a chatId
router.get('/find', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { participantIds } = req.query;
    const currentUserId = req.user!.id;

    if (!participantIds || typeof participantIds !== 'string') {
      res.status(400).json({ error: 'participantIds is required' });
      return;
    }

    const participantIdArray = participantIds.split(',');

    if (participantIdArray.length !== 2) {
      res.status(400).json({ error: 'Exactly 2 participant IDs are required' });
      return;
    }

    // Ensure current user is one of the participants
    if (!participantIdArray.includes(currentUserId)) {
      res.status(403).json({ error: 'You must be one of the participants' });
      return;
    }

    // Find existing chat between these two users
    const allChats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId: {
              in: participantIdArray
            }
          }
        }
      },
      include: {
        participants: {
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
        }
      }
    });

    // Filter to find chat with exactly these two participants
    const existingChat = allChats.find(chat => {
      if (chat.participants.length !== 2) return false;
      const userIds = chat.participants.map(p => p.userId).sort();
      const requestedIds = participantIdArray.sort();
      return userIds[0] === requestedIds[0] && userIds[1] === requestedIds[1];
    });

    // Transform participants to match frontend expectation
    const transformedChat = existingChat ? {
      ...existingChat,
      participants: existingChat.participants.map(p => p.user)
    } : null;

    res.json({ chat: transformedChat });
  } catch (error) {
    console.error('Find chat error:', error);
    res.status(500).json({ error: 'Failed to find chat' });
  }
});

// Get chat by ID
router.get('/:chatId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const userId = req.user!.id;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
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
        }
      }
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(p => p.userId === userId);

    if (!isParticipant) {
      res.status(403).json({ error: 'You are not a participant of this chat' });
      return;
    }

    // Transform participants to match frontend expectation
    const transformedChat = {
      ...chat,
      participants: chat.participants.map(p => p.user)
    };

    res.json({ chat: transformedChat });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Get or create a chat between two users
router.post('/get-or-create',
  authMiddleware,
  [
    body('targetUserId').notEmpty().withMessage('Target user ID is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { targetUserId } = req.body;
      const currentUserId = req.user!.id;

      if (targetUserId === currentUserId) {
        res.status(400).json({ error: 'Cannot create chat with yourself' });
        return;
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId }
      });

      if (!targetUser) {
        res.status(404).json({ error: 'Target user not found' });
        return;
      }

      // Find existing chat between these two users
      const allChats = await prisma.chat.findMany({
        where: {
          participants: {
            some: {
              userId: {
                in: [currentUserId, targetUserId]
              }
            }
          }
        },
        include: {
          participants: {
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
          }
        }
      });

      // Filter to find chat with exactly these two participants
      const existingChat = allChats.find(chat => {
        if (chat.participants.length !== 2) return false;
        const userIds = chat.participants.map(p => p.userId).sort();
        const requestedIds = [currentUserId, targetUserId].sort();
        return userIds[0] === requestedIds[0] && userIds[1] === requestedIds[1];
      });

      if (existingChat) {
        const transformedChat = {
          ...existingChat,
          participants: existingChat.participants.map(p => p.user)
        };
        res.json({ chat: transformedChat });
        return;
      }

      // Create new chat
      const newChat = await prisma.chat.create({
        data: {
          participants: {
            create: [
              { userId: currentUserId },
              { userId: targetUserId }
            ]
          }
        },
        include: {
          participants: {
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
          }
        }
      });

      const transformedChat = {
        ...newChat,
        participants: newChat.participants.map(p => p.user)
      };

      res.status(201).json({ chat: transformedChat });
    } catch (error) {
      console.error('Get or create chat error:', error);
      res.status(500).json({ error: 'Failed to get or create chat' });
    }
  }
);

// Get messages in a chat
router.get('/:chatId/messages', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const { limit = '50', before } = req.query;
    const userId = req.user!.id;

    // Check if user is a participant
    const participant = await prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId
        }
      }
    });

    if (!participant) {
      res.status(403).json({ error: 'You are not a participant of this chat' });
      return;
    }

    const whereClause: any = { chatId };

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
            avatar: true
          }
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(typeof limit === 'string' ? limit : '50')
    });

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message in a chat
router.post('/:chatId/messages',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('Message content is required'),
    body('replyToId').optional().isString()
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { chatId } = req.params;
      const { content, replyToId } = req.body;
      const userId = req.user!.id;

      // Check if user is a participant
      const participant = await prisma.chatParticipant.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId
          }
        }
      });

      if (!participant) {
        res.status(403).json({ error: 'You are not a participant of this chat' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          content,
          chatId,
          senderId: userId,
          replyToId: replyToId || undefined
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true
            }
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              senderId: true,
              sender: {
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

      // Update chat's updatedAt timestamp
      await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() }
      });

      res.status(201).json({ message });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Delete a message
router.delete('/messages/:messageId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.senderId !== userId) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;
