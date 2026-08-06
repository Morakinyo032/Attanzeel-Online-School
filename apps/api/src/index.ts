import dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from '@lms/database';
import authRouter from './routes/auth';
import { authenticate } from './middleware/auth';
import coursesRouter from './routes/courses';
import modulesRouter from './routes/modules';
import enrollmentsRouter from './routes/enrollments';
import progressRouter from './routes/progress';
import certificatesRouter from './routes/certificates';
import quizzesRouter from './routes/quizzes';
import assignmentsRouter from './routes/assignments';
import analyticsRouter from './routes/analytics';
import liveclassRouter from './routes/liveclass';
import forumRouter from './routes/forum';
import uploadRouter from './routes/upload';
import resourcesRouter from './routes/resources';
import schoolRouter from './routes/school';



const app: Application = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));
app.use('/api', uploadRouter);
app.use('/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/liveclass', liveclassRouter);
app.use('/api/forum', forumRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/school', schoolRouter);



// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// Test DB connection
app.get('/api/test-db', async (req: Request, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ success: true, userCount, message: 'Database connected!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// Health check and auth routes go here…

// Protected profile endpoint
app.get(
  '/api/profile',
  authenticate(),       // <-- protects this route
  async (req, res) => {
    const { userId } = req.user!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true }
    })
    res.json({ user })
  }
)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;