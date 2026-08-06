import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/forum/course/:courseId - Get threads for a course
router.get('/course/:courseId', async (req, res: Response) => {
  try {
    const threads = await prisma.forumThread.findMany({
      where: { courseId: req.params.courseId },
      include: {
        user: { select: { id: true, name: true } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ threads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// POST /api/forum/course/:courseId - Create thread
router.post('/course/:courseId', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const thread = await prisma.forumThread.create({
      data: {
        title: req.body.title,
        content: req.body.content,
        courseId: req.params.courseId,
        userId: req.user!.userId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ thread });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// GET /api/forum/thread/:threadId - Get thread with replies
router.get('/thread/:threadId', async (req, res: Response) => {
  try {
    const thread = await prisma.forumThread.findUnique({
      where: { id: req.params.threadId },
      include: {
        user: { select: { id: true, name: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    res.json({ thread });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// POST /api/forum/thread/:threadId/reply - Reply to thread
router.post('/thread/:threadId/reply', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const reply = await prisma.forumReply.create({
      data: {
        content: req.body.content,
        threadId: req.params.threadId,
        userId: req.user!.userId,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ reply });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

export default router;