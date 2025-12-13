import express, { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { generatePresignedUploadUrl, isValidFileType } from '../utils/s3.js';

const router = express.Router();

// Generate presigned URL for file upload
router.post(
  '/presigned-url',
  authMiddleware,
  [
    body('fileType').notEmpty().withMessage('File type is required'),
    body('folder').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { fileType, folder = 'public' } = req.body;

      // Validate file type - allow images, videos, and PDFs
      if (!isValidFileType(fileType)) {
        res.status(400).json({ 
          error: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP), videos (MP4, WebM, OGG, MOV, HEVC), and PDF documents are allowed.' 
        });
        return;
      }

      // Generate presigned URL
      const result = await generatePresignedUploadUrl(fileType, folder);

      res.json(result);
    } catch (error) {
      console.error('Generate presigned URL error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
);

// Confirm file upload (optional - for tracking uploaded files)
router.post(
  '/confirm-upload',
  authMiddleware,
  [
    body('fileUrl').isURL().withMessage('Valid file URL is required'),
    body('fileType').notEmpty().withMessage('File type is required'),
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { fileUrl, fileType } = req.body;

      // Here you can optionally store upload metadata in your database
      // For example, track all uploads, file sizes, etc.

      res.json({ 
        success: true, 
        message: 'Upload confirmed',
        fileUrl 
      });
    } catch (error) {
      console.error('Confirm upload error:', error);
      res.status(500).json({ error: 'Failed to confirm upload' });
    }
  }
);

export default router;
