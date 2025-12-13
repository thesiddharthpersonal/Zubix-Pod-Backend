import express, { Response } from 'express';
import { adminAuthMiddleware, AdminRequest } from '../middleware/adminAuth.js';
import prisma from '../utils/prisma.js';
import { createAndEmitNotification } from '../utils/notifications.js';

const router = express.Router();

// Apply admin auth middleware to all routes
router.use(adminAuthMiddleware);

// Dashboard Statistics
router.get('/stats', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalPods,
      pendingPods,
      totalPosts,
      totalEvents,
      totalRooms,
      totalChats,
      recentUsers,
      recentPosts,
      // Active Users Metrics
      dailyActiveUsers,
      weeklyActiveUsers,
      monthlyActiveUsers,
      // Engagement Metrics
      postsToday,
      postsThisWeek,
      postsThisMonth,
      eventsThisWeek,
      eventsThisMonth
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pod.count(),
      prisma.pod.count({ where: { isApproved: false } }),
      prisma.post.count(),
      prisma.event.count(),
      prisma.room.count(),
      prisma.chat.count(),
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      // Count unique users who created posts, comments, or reactions in the last 24 hours
      prisma.user.count({
        where: {
          OR: [
            { posts: { some: { createdAt: { gte: oneDayAgo } } } },
            { comments: { some: { createdAt: { gte: oneDayAgo } } } },
            { reactions: { some: { createdAt: { gte: oneDayAgo } } } }
          ]
        }
      }),
      // Count unique users active in the last 7 days
      prisma.user.count({
        where: {
          OR: [
            { posts: { some: { createdAt: { gte: oneWeekAgo } } } },
            { comments: { some: { createdAt: { gte: oneWeekAgo } } } },
            { reactions: { some: { createdAt: { gte: oneWeekAgo } } } }
          ]
        }
      }),
      // Count unique users active in the last 30 days
      prisma.user.count({
        where: {
          OR: [
            { posts: { some: { createdAt: { gte: oneMonthAgo } } } },
            { comments: { some: { createdAt: { gte: oneMonthAgo } } } },
            { reactions: { some: { createdAt: { gte: oneMonthAgo } } } }
          ]
        }
      }),
      prisma.post.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: oneMonthAgo } } }),
      prisma.event.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.event.count({ where: { createdAt: { gte: oneMonthAgo } } })
    ]);

    const stats = {
      users: { 
        total: totalUsers, 
        recent: recentUsers,
        dau: dailyActiveUsers,
        wau: weeklyActiveUsers,
        mau: monthlyActiveUsers
      },
      pods: { total: totalPods, pending: pendingPods },
      posts: { 
        total: totalPosts, 
        recent: recentPosts,
        today: postsToday,
        thisWeek: postsThisWeek,
        thisMonth: postsThisMonth
      },
      events: { 
        total: totalEvents,
        thisWeek: eventsThisWeek,
        thisMonth: eventsThisMonth
      },
      rooms: { total: totalRooms },
      chats: { total: totalChats }
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Detailed Metrics for Charts (Last 30 Days)
router.get('/metrics/detailed', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Generate daily data points
    const dailyMetrics = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const [dau, posts, newUsers, events] = await Promise.all([
        // Daily Active Users
        prisma.user.count({
          where: {
            OR: [
              { posts: { some: { createdAt: { gte: dayStart, lte: dayEnd } } } },
              { comments: { some: { createdAt: { gte: dayStart, lte: dayEnd } } } },
              { reactions: { some: { createdAt: { gte: dayStart, lte: dayEnd } } } }
            ]
          }
        }),
        // Posts created
        prisma.post.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } }
        }),
        // New users registered
        prisma.user.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } }
        }),
        // Events created
        prisma.event.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } }
        })
      ]);

      dailyMetrics.push({
        date: dayStart.toISOString().split('T')[0],
        dau,
        posts,
        newUsers,
        events
      });
    }

    // Calculate growth rates
    const firstWeek = dailyMetrics.slice(0, 7);
    const lastWeek = dailyMetrics.slice(-7);
    
    const avgDauFirstWeek = firstWeek.reduce((sum, d) => sum + d.dau, 0) / 7;
    const avgDauLastWeek = lastWeek.reduce((sum, d) => sum + d.dau, 0) / 7;
    const dauGrowth = avgDauFirstWeek > 0 
      ? ((avgDauLastWeek - avgDauFirstWeek) / avgDauFirstWeek * 100).toFixed(1)
      : '0';

    res.json({ 
      metrics: dailyMetrics,
      summary: {
        dauGrowth: parseFloat(dauGrowth),
        avgDauLastWeek: Math.round(avgDauLastWeek),
        totalPostsLast30Days: dailyMetrics.reduce((sum, d) => sum + d.posts, 0),
        totalNewUsersLast30Days: dailyMetrics.reduce((sum, d) => sum + d.newUsers, 0)
      }
    });
  } catch (error) {
    console.error('Get detailed metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch detailed metrics' });
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

// Get all users for notification recipient selection
router.get('/users/all', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true
      },
      orderBy: { fullName: 'asc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Send custom notification
router.post('/notifications/send', async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { recipientType, recipientId, role, title, message, type } = req.body;

    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required' });
      return;
    }

    let userIds: string[] = [];

    // Determine recipient user IDs based on type
    if (recipientType === 'all') {
      const allUsers = await prisma.user.findMany({ select: { id: true } });
      userIds = allUsers.map(u => u.id);
    } else if (recipientType === 'specific' && recipientId) {
      userIds = [recipientId];
    } else if (recipientType === 'role' && role) {
      const roleUsers = await prisma.user.findMany({
        where: { role: role as any },
        select: { id: true }
      });
      userIds = roleUsers.map(u => u.id);
    } else {
      res.status(400).json({ error: 'Invalid recipient configuration' });
      return;
    }

    if (userIds.length === 0) {
      res.status(400).json({ error: 'No recipients found' });
      return;
    }

    console.log(`🔥 Sending notifications to ${userIds.length} users: ${title}`);
    
    // Create notifications for all recipients with push notifications
    const notifications = await Promise.allSettled(
      userIds.map(userId => 
        createAndEmitNotification({
          userId,
          type: (type || 'message') as any,
          title,
          message
        })
      )
    );

    const successCount = notifications.filter(n => n.status === 'fulfilled').length;
    const failedCount = notifications.filter(n => n.status === 'rejected').length;
    console.log(`📊 Notifications: ${successCount} successful, ${failedCount} failed`);

    res.json({ 
      message: 'Notifications sent successfully',
      count: successCount,
      total: userIds.length
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

export default router;
