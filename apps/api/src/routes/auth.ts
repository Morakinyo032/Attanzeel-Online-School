import { Router, Request, Response } from 'express'
import { prisma }       from '@lms/database'
import bcrypt           from 'bcryptjs'
import jwt              from 'jsonwebtoken'
import { z }            from 'zod'
import { sendWelcomeEmail } from '../services/email';


const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

//console.log('JWT_SECRET exists:', !!JWT_SECRET)

// Schemas
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already in use' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hash }
    })
    // After user creation, add:
    sendWelcomeEmail(user.email, user.name).catch(console.error);
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })

  } catch (err) {
    res.status(400).json({ error: (err as any).message })
  }
})

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(400).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } })

  } catch (err) {
    res.status(400).json({ error: (err as any).message })
  }
})

export default router