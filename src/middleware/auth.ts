import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import prisma from '../utils/prisma.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
  fullName: string | null;
  profilePhoto: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        email: true, 
        username: true, 
        role: true, 
        fullName: true, 
        profilePhoto: true 
      }
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user as AuthenticatedUser;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const isPodOwner = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const { user } = req;
  const isPodOwner = user?.role === 'pod_owner' || user?.role === 'POD_OWNER';
  console.log('User role:', user?.role, 'isPodOwner:', isPodOwner);

  if (!isPodOwner) {
    res.status(403).json({ error: 'Only pod owners can perform this action' });
    return;
  }
  next();
};

/**
 * Middleware to check if user is owner or co-owner of a specific pod
 * Requires podId in req.params
 */
export const isPodOwnerOrCoOwner = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for podId in params first, then in body
    const podId = req.params.podId || req.body.podId;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!podId) {
      res.status(400).json({ error: 'Pod ID is required' });
      return;
    }

    // Check if user is pod owner
    const pod = await prisma.pod.findUnique({
      where: { id: podId },
      select: { ownerId: true }
    });

    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }

    // If user is the owner, allow
    if (pod.ownerId === userId) {
      next();
      return;
    }

    // Check if user is a co-owner
    const member = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId,
          userId
        }
      },
      select: { isCoOwner: true }
    });

    if (member?.isCoOwner) {
      next();
      return;
    }

    res.status(403).json({ error: 'Only pod owner or co-owners can perform this action' });
  } catch (error) {
    console.error('isPodOwnerOrCoOwner middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Middleware to check if user is pod owner or co-owner via roomId
 * Use this for endpoints that have roomId in params instead of podId
 */
export const isPodOwnerOrCoOwnerViaRoom = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!roomId) {
      res.status(400).json({ error: 'Room ID is required' });
      return;
    }

    // Get room to find podId
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { 
        podId: true,
        pod: {
          select: { ownerId: true }
        }
      }
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // If user is the pod owner, allow
    if (room.pod.ownerId === userId) {
      next();
      return;
    }

    // Check if user is a co-owner
    const member = await prisma.podMember.findUnique({
      where: {
        podId_userId: {
          podId: room.podId,
          userId
        }
      },
      select: { isCoOwner: true }
    });

    if (member?.isCoOwner) {
      next();
      return;
    }

    res.status(403).json({ error: 'Only pod owner or co-owners can perform this action' });
  } catch (error) {
    console.error('isPodOwnerOrCoOwnerViaRoom middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};
