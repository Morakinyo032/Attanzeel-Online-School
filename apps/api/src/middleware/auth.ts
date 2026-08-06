import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  user?: { userId: string; role: string }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345'

export function authenticate(roles: string[] = []) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization?.split(' ')[1]
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const payload = jwt.verify(auth, JWT_SECRET) as any
      req.user = payload
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}