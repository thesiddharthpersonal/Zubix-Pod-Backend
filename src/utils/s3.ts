import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || '';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

/**
 * Generate a presigned URL for uploading files to S3
 * @param fileType - MIME type of the file (e.g., 'image/jpeg')
 * @param folder - Folder path in S3 bucket (e.g., 'profile-photos', 'pod-logos')
 * @returns Presigned URL and final file URL
 */
export const generatePresignedUploadUrl = async (
  fileType: string,
  folder: string = 'public'
): Promise<PresignedUrlResponse> => {
  // Generate unique filename
  const fileExtension = fileType.split('/')[1] || 'jpg';
  const randomString = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const key = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

  // Create S3 command
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  // Generate presigned URL (valid for 5 minutes)
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  // Construct the final file URL
  const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

  return {
    uploadUrl,
    fileUrl,
    key,
  };
};

/**
 * Validate file type for images
 */
export const isValidImageType = (mimeType: string): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(mimeType.toLowerCase());
};

/**
 * Validate file type for videos
 */
export const isValidVideoType = (mimeType: string): boolean => {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  return validTypes.includes(mimeType.toLowerCase());
};

/**
 * Validate file type for media (images and videos)
 */
export const isValidMediaType = (mimeType: string): boolean => {
  return isValidImageType(mimeType) || isValidVideoType(mimeType);
};

/**
 * Get file size limit in bytes (5MB for images, 50MB for videos)
 */
export const getMaxFileSize = (fileType: string): number => {
  if (fileType.startsWith('image/')) {
    return 5 * 1024 * 1024; // 5MB
  }
  if (fileType.startsWith('video/')) {
    return 50 * 1024 * 1024; // 50MB
  }
  return 10 * 1024 * 1024; // 10MB for other files
};