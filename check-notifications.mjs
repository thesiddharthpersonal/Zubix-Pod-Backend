import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkNotifications() {
  try {
    const notifications = await prisma.notification.findMany({
      include: {
        user: {
          select: {
            username: true,
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\nTotal notifications in database: ${notifications.length}\n`);
    
    if (notifications.length === 0) {
      console.log('❌ No notifications found in database!');
    } else {
      notifications.forEach(notif => {
        console.log(`- [${notif.isRead ? 'READ' : 'UNREAD'}] ${notif.type} for ${notif.user.username}: ${notif.title}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();
