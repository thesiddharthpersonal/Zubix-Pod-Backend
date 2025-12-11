import prisma from './prisma.js';

/**
 * Check if a user is a member of a pod
 */
export async function checkPodMembership(podId: string, userId: string): Promise<boolean> {
  const membership = await prisma.podMember.findUnique({
    where: {
      podId_userId: {
        podId,
        userId
      }
    }
  });
  return !!membership;
}

/**
 * Check if a user is the owner of a pod
 */
export async function checkPodOwnership(podId: string, userId: string): Promise<boolean> {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { ownerId: true }
  });
  return pod ? pod.ownerId === userId : false;
}

/**
 * Check if a user is a co-owner of a pod
 */
export async function checkPodCoOwnership(podId: string, userId: string): Promise<boolean> {
  const member = await prisma.podMember.findUnique({
    where: {
      podId_userId: {
        podId,
        userId
      }
    },
    select: { isCoOwner: true }
  });
  return member ? member.isCoOwner : false;
}

/**
 * Check if user has access to pod (member, owner, or co-owner)
 */
export async function checkPodAccess(podId: string, userId: string): Promise<{
  hasAccess: boolean;
  isOwner: boolean;
  isCoOwner: boolean;
  isMember: boolean;
}> {
  const [pod, membership] = await Promise.all([
    prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    }),
    prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId
        }
      },
      select: { isCoOwner: true }
    })
  ]);

  if (!pod) {
    return { hasAccess: false, isOwner: false, isCoOwner: false, isMember: false };
  }

  const isOwner = pod.ownerId === userId;
  const isCoOwner = membership?.isCoOwner || false;
  const isMember = !!membership;
  const hasAccess = isOwner || isCoOwner || isMember;

  return { hasAccess, isOwner, isCoOwner, isMember };
}

/**
 * Check if user is a participant in a chat
 */
export async function checkChatParticipant(chatId: string, userId: string): Promise<boolean> {
  const participant = await prisma.chatParticipant.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId
      }
    }
  });
  return !!participant;
}

/**
 * Get user select fields (commonly used)
 */
export const userSelectFields = {
  id: true,
  username: true,
  fullName: true,
  avatar: true,
  email: true,
  role: true
} as const;

/**
 * Get minimal user select fields
 */
export const userSelectMinimal = {
  id: true,
  username: true,
  fullName: true,
  avatar: true
} as const;
