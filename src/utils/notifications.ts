import prisma from './prisma.js';
import { ioInstance } from '../socket.js';
import webpush from 'web-push';

// Configure web-push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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

    // Send push notification to all user's subscriptions
    await sendPushNotification(params.userId, {
      title: params.title,
      body: params.message,
      icon: '/pwa-192x192.png',
      badge: '/zubixfavicon.png',
      data: {
        notificationId: notification.id,
        type: params.type,
        linkedId: params.linkedId,
        url: getNotificationUrl(params.type, params.linkedId)
      }
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send push notification to user's subscriptions
export const sendPushNotification = async (
  userId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: any;
  }
) => {
  try {
    // Get all push subscriptions for the user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    // Send to all subscriptions
    const notifications = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );
        console.log(`✅ Push notification sent to ${sub.endpoint.substring(0, 50)}...`);
      } catch (error: any) {
        console.error(`❌ Failed to send push notification:`, error.message);
        
        // Remove subscription if it's no longer valid
        if (error.statusCode === 410 || error.statusCode === 404) {
          await prisma.pushSubscription.delete({
            where: { id: sub.id }
          });
          console.log(`🗑️ Removed invalid subscription for user ${userId}`);
        }
      }
    });

    await Promise.allSettled(notifications);
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
};

// Helper to generate notification URL
const getNotificationUrl = (type: string, linkedId?: string): string => {
  switch (type) {
    case 'post_like':
    case 'comment':
      return linkedId ? `/post/${linkedId}` : '/home';
    case 'message':
      return '/chat';
    case 'pod_join':
      return linkedId ? `/pods/${linkedId}` : '/discover';
    case 'event':
      return linkedId ? `/events/${linkedId}` : '/events';
    case 'pitch':
      return '/pitches';
    default:
      return '/notifications';
  }
};
