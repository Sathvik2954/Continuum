import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include our custom user payload
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
      };
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split('Bearer ')[1];

  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_for_development';
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
    };

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export default verifyToken;
