import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Fixed admin credentials (hardcoded)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: '$2a$10$R1YI2DfjXLaPPBvyd/1LhOsMFXKF6egmDPiXPsVITRcxT1e2hI.za', // 'admin123' hashed
  name: 'System Administrator'
};

// Admin login
router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check if username matches
    if (username !== ADMIN_CREDENTIALS.username) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, ADMIN_CREDENTIALS.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: ADMIN_CREDENTIALS.username, 
        name: ADMIN_CREDENTIALS.name,
        role: 'admin',
        isAdmin: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: {
        username: ADMIN_CREDENTIALS.username,
        name: ADMIN_CREDENTIALS.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify admin token
router.get('/verify', (req, res: Response): void => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    
    if (!decoded.isAdmin) {
      res.status(403).json({ error: 'Not an admin' });
      return;
    }

    res.json({
      admin: {
        username: decoded.username,
        name: decoded.name,
        role: decoded.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
