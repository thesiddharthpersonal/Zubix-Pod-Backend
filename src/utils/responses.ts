import { Response } from 'express';

export class ApiResponse {
  static success(res: Response, data: any, statusCode: number = 200) {
    return res.status(statusCode).json(data);
  }

  static error(res: Response, message: string, statusCode: number = 500) {
    return res.status(statusCode).json({ error: message });
  }

  static notFound(res: Response, message: string = 'Resource not found') {
    return res.status(404).json({ error: message });
  }

  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return res.status(401).json({ error: message });
  }

  static forbidden(res: Response, message: string = 'Forbidden') {
    return res.status(403).json({ error: message });
  }

  static badRequest(res: Response, message: string) {
    return res.status(400).json({ error: message });
  }

  static validationError(res: Response, errors: any[]) {
    return res.status(400).json({ errors });
  }

  static created(res: Response, data: any) {
    return res.status(201).json(data);
  }
}
