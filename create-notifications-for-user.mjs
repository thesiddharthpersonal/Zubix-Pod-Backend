import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createNotificationsForUser(username) {
  try {
    // Find the user by username
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    if (!user) {
      console.log(`❌ User ${username} not found!`);
      return;
    }

    console.log(`Creating test notifications for: ${user.username} (${user.fullName})`);
    console.log(`User ID: ${user.id}\n`);

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
          message: 'Mike commented: "Great idea! Would love to collaborate"',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'call_booking',
          title: 'Call Booking Request',
          message: 'Emma wants to schedule a 30-minute call with you',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'event_reminder',
          title: 'Event Reminder',
          message: 'Startup Demo Day 2024 starts in 2 hours',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'pod_invite',
          title: 'Pod Invitation',
          message: 'You have been invited to join TechStars Bangalore',
          isRead: false
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
          message: 'Your startup pitch has received 15 new views this week',
          isRead: false
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'post_like',
          title: 'Post Popular',
          message: 'Your post has reached 50 likes! 🎉',
          isRead: true
        }
      }),
      prisma.notification.create({
        data: {
          userId: user.id,
          type: 'event_reminder',
          title: 'Event Tomorrow',
          message: 'Networking Meetup is scheduled for tomorrow at 6 PM',
          isRead: true
        }
      })
    ]);

    console.log(`\n✅ Created ${notifications.length} test notifications successfully!\n`);
    console.log('Notifications created:');
    notifications.forEach(notif => {
      console.log(`  - [${notif.isRead ? 'READ' : 'UNREAD'}] ${notif.type}: ${notif.title}`);
    });
    console.log(`\n📱 Refresh your notifications page to see them!`);

  } catch (error) {
    console.error('❌ Error creating notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get username from command line or use default
const username = process.argv[2] || 'dev3x9agm';
createNotificationsForUser(username);
