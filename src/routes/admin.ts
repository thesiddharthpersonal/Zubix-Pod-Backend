import express, { Response } from 'express';
import { adminAuthMiddleware, AdminRequest } from '../middleware/adminAuth.js';
import prisma from '../utils/prisma.js';

const router = express.Router();

// Apply admin auth middleware to all routes
router.use(adminAuthMiddleware);

// Dashboard Statistics
router.get('/stats', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalPods,
      pendingPods,
      totalPosts,
      totalEvents,
      totalRooms,
      totalChats,
      recentUsers,
      recentPosts
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pod.count(),
      prisma.pod.count({ where: { isApproved: false } }),
      prisma.post.count(),
      prisma.event.count(),
      prisma.room.count(),
      prisma.chat.count(),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.post.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
    ]);

    const stats = {
      users: { total: totalUsers, recent: recentUsers },
      pods: { total: totalPods, pending: pendingPods },
      posts: { total: totalPosts, recent: recentPosts },
      events: { total: totalEvents },
      rooms: { total: totalRooms },
      chats: { total: totalChats }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// User Management
router.get('/users', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search, role } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          mobile: true,
          role: true,
          avatar: true,
          createdAt: true,
          _count: {
            select: {
              posts: true,
              ownedPods: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:userId/role', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'pod_owner', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role }
    });

    res.json({ user });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.delete('/users/:userId', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Pod Management

// Get pending pods (awaiting approval) - Must be before /pods route
router.get('/pods/pending', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [pods, total] = await Promise.all([
      prisma.pod.findMany({
        where: { isApproved: false },
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
              email: true,
              mobile: true
            }
          },
          _count: {
            select: {
              members: true,
              posts: true,
              events: true
            }
          }
        }
      }),
      prisma.pod.count({ where: { isApproved: false } })
    ]);

    res.json({ pods, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get pending pods error:', error);
    res.status(500).json({ error: 'Failed to fetch pending pods' });
  }
});

// Approve pod
router.patch('/pods/:podId/approve', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const pod = await prisma.pod.update({
      where: { id: podId },
      data: { isApproved: true },
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

    // Create notification for pod owner
    await prisma.notification.create({
      data: {
        userId: pod.ownerId,
        type: 'POD_APPROVED',
        title: 'Pod Approved! 🎉',
        message: `Your pod "${pod.name}" has been approved by admin. You can now start managing it.`,
        linkedId: pod.id
      }
    });

    res.json({ pod, message: 'Pod approved successfully' });
  } catch (error) {
    console.error('Approve pod error:', error);
    res.status(500).json({ error: 'Failed to approve pod' });
  }
});

// Reject pod
router.patch('/pods/:podId/reject', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    const { reason } = req.body;

    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true, name: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // Create notification for pod owner
    await prisma.notification.create({
      data: {
        userId: pod.ownerId,
        type: 'POD_REJECTED',
        title: 'Pod Registration Rejected',
        message: reason || `Your pod "${pod.name}" registration was not approved. Please contact support for more details.`,
        linkedId: podId
      }
    });

    // Delete the rejected pod
    await prisma.pod.delete({ where: { id: podId } });

    res.json({ message: 'Pod rejected and deleted successfully' });
  } catch (error) {
    console.error('Reject pod error:', error);
    res.status(500).json({ error: 'Failed to reject pod' });
  }
});

router.get('/pods', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [pods, total] = await Promise.all([
      prisma.pod.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
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
              posts: true,
              events: true
            }
          }
        }
      }),
      prisma.pod.count({ where })
    ]);

    res.json({ pods, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get pods error:', error);
    res.status(500).json({ error: 'Failed to fetch pods' });
  }
});

router.delete('/pods/:podId', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { podId } = req.params;
    await prisma.pod.delete({ where: { id: podId } });
    res.json({ message: 'Pod deleted successfully' });
  } catch (error) {
    console.error('Delete pod error:', error);
    res.status(500).json({ error: 'Failed to delete pod' });
  }
});

// Post Management
router.get('/posts', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.content = { contains: search as string, mode: 'insensitive' };
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
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
              name: true
            }
          },
          _count: {
            select: {
              comments: true
            }
          }
        }
      }),
      prisma.post.count({ where })
    ]);

    res.json({ posts, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

router.delete('/posts/:postId', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    await prisma.post.delete({ where: { id: postId } });
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Event Management
router.get('/events', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { date: 'desc' },
        include: {
          pod: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        }
      }),
      prisma.event.count({ where })
    ]);

    res.json({ events, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.delete('/events/:eventId', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    await prisma.event.delete({ where: { id: eventId } });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Room Management
router.get('/rooms', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          pod: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      }),
      prisma.room.count({ where })
    ]);

    res.json({ rooms, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.delete('/rooms/:roomId', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;
    await prisma.room.delete({ where: { id: roomId } });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
