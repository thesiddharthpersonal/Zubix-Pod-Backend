const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestNotifications() {
  try {
    // Get the first user to send notifications to
    const user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('No users found. Please create a user first.');
      return;
    }

    console.log(`Creating test notifications for user: ${user.username} (${user.id})`);

    // Create various test notifications
    const notifications = await Promise.all([
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'message_request',
          title: 'New Message Request',
          message: 'John Doe wants to connect with you',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'post_like',
          title: 'New Like',
          message: 'Sarah liked your post about startup ideas',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'post_comment',
          title: 'New Comment',
          message: 'Mike commented on your post',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'call_booking',
          title: 'Call Booking Request',
          message: 'Emma wants to schedule a call with you',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'event_reminder',
          title: 'Event Reminder',
          message: 'Demo Day 2024 starts in 2 hours',
          isRead: true
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'pod_invite',
          title: 'Pod Invitation',
          message: 'You have been invited to join TechStars Bangalore',
          isRead: true
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'room_message',
          title: 'New Room Message',
          message: 'Alex mentioned you in General Discussion',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'pitch_update',
          title: 'Pitch Update',
          message: 'Your startup pitch has received 10 new views',
          isRead: false
        }
      })
    ]);

    console.log(`✅ Created ${notifications.length} test notifications successfully!`);
    console.log('\nNotifications created:');
    notifications.forEach(notif => {
      console.log(`  - ${notif.type}: ${notif.title}`);
    });

  } catch (error) {
    console.error('Error creating notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNotifications();
