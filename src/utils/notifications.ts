import prisma from './prisma.js';
import { ioInstance } from '../socket.js';

interface CreateNotificationParams {
  userId: string;
  type: 'post_like' | 'comment' | 'message' | 'pod_join' | 'event' | 'pitch' | 'pod_approved' | 'pod_rejected';
  title: string;
  message: string;
  linkedId?: string;
}

export const createAndEmitNotification = async (params: CreateNotificationParams) => {
  try {
    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkedId: params.linkedId,
        isRead: false
      }
    });

    // Emit notification via socket if io instance is available
    if (ioInstance) {
      ioInstance.to(`user:${params.userId}`).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
