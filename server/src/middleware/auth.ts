import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Extend Express Request to carry user info
declare global {
  namespace Express {
    interface Request {
      user?: { id: number }
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // If JWT_SECRET is not configured, auth is disabled (dev mode)
    req.user = { id: 1 }
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised — no token provided' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, secret) as { user_id: number }
    req.user = { id: payload.user_id }
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorised — invalid or expired token' })
  }
}
