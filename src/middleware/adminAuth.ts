import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';

export interface AdminRequest extends Request {
  admin?: {
    username: string;
    name: string;
    role: string;
  };
}

export const adminAuthMiddleware = (req: AdminRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    if (!decoded.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.admin = {
      username: decoded.username,
      name: decoded.name,
      role: decoded.role
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
