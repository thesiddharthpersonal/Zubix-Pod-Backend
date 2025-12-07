import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { ApiResponse } from '../utils/responses.js';
import { checkChatParticipant, userSelectMinimal } from '../utils/permissions.js';

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
                    avatar: true
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
      lastMessage: cp.chat.messages[0] || null
    }));

    res.json({ chats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
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
                avatar: true
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

    res.json({ chat });
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
      const existingChats = await prisma.chat.findMany({
        where: {
          participants: {
            every: {
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
                  avatar: true
                }
              }
            }
          }
        }
      });

      // Filter to find chat with exactly these two participants
      const existingChat = existingChats.find(chat => 
        chat.participants.length === 2 &&
        chat.participants.some(p => p.userId === currentUserId) &&
        chat.participants.some(p => p.userId === targetUserId)
      );

      if (existingChat) {
        res.json({ chat: existingChat });
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
                  avatar: true
                }
              }
            }
          }
        }
      });

      res.status(201).json({ chat: newChat });
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
    body('content').notEmpty().withMessage('Message content is required')
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { chatId } = req.params;
      const { content } = req.body;
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
          senderId: userId
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
