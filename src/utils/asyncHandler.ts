import { Request, Response, NextFunction } from 'express';

/**
 * Wrapper for async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error logger
 */
export const logError = (context: string, error: any) => {
  console.error(`[${context}] Error:`, error);
};
