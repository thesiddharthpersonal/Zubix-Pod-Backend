import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function makeAdmin(username) {
  try {
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    if (!user) {
      console.log(`❌ User ${username} not found!`);
      return;
    }

    if (user.role === 'admin') {
      console.log(`✅ User ${username} is already an admin!`);
      return;
    }

    await prisma.user.update({
      where: { username },
      data: { role: 'ADMIN' }
    });

    console.log(`\n✅ Successfully made ${username} (${user.fullName}) an admin!`);
    console.log(`\n🔑 You can now access the admin panel at /admin`);
    console.log(`\n📱 Look for "Admin Panel" in the More section`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const username = process.argv[2] || 'dev3x9agm';
makeAdmin(username);
