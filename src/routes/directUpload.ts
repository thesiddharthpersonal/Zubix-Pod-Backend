import express, { Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { isValidFileType } from '../utils/s3.js';

const router = express.Router();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log('Direct upload request received');
    try {
      const file = req.file;
      if (!file) {
        console.log('No file in request');
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      console.log('File received:', file.originalname, file.mimetype, file.size);
      const folder = req.body.folder || 'public';
      
      if (!isValidFileType(file.mimetype)) {
        console.log('Invalid file type:', file.mimetype);
        res.status(400).json({ error: 'Invalid file type' });
        return;
      }

      const fileExtension = file.mimetype.split('/')[1] || 'jpg';
      const randomString = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const key = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

      console.log('Uploading to S3:', BUCKET_NAME, key);
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

      console.log('Upload successful:', fileUrl);
      res.json({ fileUrl, key });
    } catch (error: any) {
      console.error('Direct upload error:', error);
      res.status(500).json({ error: 'Failed to upload file: ' + error.message });
    }
  }
);

export default router;
