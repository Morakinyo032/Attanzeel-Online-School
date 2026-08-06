import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/liveclass - Schedule a live class (instructor)
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, courseId, scheduledAt, duration } = req.body;

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Generate unique room name
      const roomName = `lms-${courseId}-${Date.now()}`;

      const liveClass = await prisma.liveClass.create({
        data: {
          title,
          description,
          courseId,
          roomName,
          scheduledAt: new Date(scheduledAt),
          duration: duration || 60,
        },
      });

      res.status(201).json({ liveClass });
    } catch (error) {
      console.error('Error creating live class:', error);
      res.status(500).json({ error: 'Failed to create live class' });
    }
  }
);

// GET /api/liveclass/course/:courseId - Get live classes for a course
router.get('/course/:courseId', async (req, res: Response) => {
  try {
    const liveClasses = await prisma.liveClass.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json({ liveClasses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live classes' });
  }
});

// PUT /api/liveclass/:id/start - Start a live class
router.put(
  '/:id/start',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const liveClass = await prisma.liveClass.update({
        where: { id: req.params.id },
        data: { isActive: true },
      });
      res.json({ liveClass });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start class' });
    }
  }
);

// PUT /api/liveclass/:id/end - End a live class
router.put(
  '/:id/end',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const liveClass = await prisma.liveClass.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      res.json({ liveClass });
    } catch (error) {
      res.status(500).json({ error: 'Failed to end class' });
    }
  }
);

// PUT /api/liveclass/:id - Update live class
router.put(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, scheduledAt, duration } = req.body;

      const liveClass = await prisma.liveClass.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      });

      if (!liveClass) return res.status(404).json({ error: 'Live class not found' });
      if (liveClass.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const updated = await prisma.liveClass.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
          ...(duration && { duration }),
        },
      });

      res.json({ liveClass: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update live class' });
    }
  }
);

// DELETE /api/liveclass/:id - Delete live class
router.delete(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const liveClass = await prisma.liveClass.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      });

      if (!liveClass) return res.status(404).json({ error: 'Live class not found' });
      if (liveClass.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await prisma.liveClass.delete({ where: { id: req.params.id } });

      res.json({ message: 'Live class deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete live class' });
    }
  }
);
export default router;