import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testAPI() {
  try {
    // Get the user
    const user = await prisma.user.findFirst();
    console.log('\n👤 User:', user.username, '(' + user.id + ')');
    
    // Get notifications for this user
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📬 Notifications for ${user.username}: ${notifications.length}`);
    
    if (notifications.length > 0) {
      console.log('\nFirst 3 notifications:');
      notifications.slice(0, 3).forEach(n => {
        console.log(`  - ${n.type}: ${n.title}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPI();
