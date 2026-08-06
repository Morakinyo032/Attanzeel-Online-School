import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEnrollmentEmail } from '../services/email';

const router = Router();

// POST /api/enrollments - Enroll in a course
// POST /api/enrollments - Enroll in a course
router.post(
  '/',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId } = req.body;
      const userId = req.user!.userId;

      if (!courseId) {
        return res.status(400).json({ error: 'courseId is required' });
      }

      // Check if course exists and is published
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (!course.published) {
        return res.status(400).json({ error: 'Course is not available for enrollment' });
      }

      // Check if already enrolled
      const existing = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Already enrolled in this course' });
      }

      // Create enrollment
      const enrollment = await prisma.enrollment.create({
        data: { userId, courseId, progress: 0 },
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      });

      // Send enrollment email (use existing 'course' variable)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        sendEnrollmentEmail(user.email, user.name, course.title).catch(console.error);
      }

      res.status(201).json({ enrollment });
    } catch (error) {
      console.error('Error enrolling:', error);
      res.status(500).json({ error: 'Failed to enroll in course' });
    }
  }
);

// GET /api/enrollments/my-courses - Get student's enrolled courses
router.get(
  '/my-courses',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const enrollments = await prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              instructor: {
                select: { id: true, name: true },
              },
              _count: {
                select: { modules: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ enrollments });
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      res.status(500).json({ error: 'Failed to fetch enrolled courses' });
    }
  }
);

// GET /api/enrollments/check/:courseId - Check if enrolled in a course
router.get(
  '/check/:courseId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { courseId } = req.params;

      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });

      res.json({ enrolled: !!enrollment, enrollment });
    } catch (error) {
      console.error('Error checking enrollment:', error);
      res.status(500).json({ error: 'Failed to check enrollment' });
    }
  }
);

// GET /api/enrollments/course/:courseId/stats - Get enrollment stats for a course (instructor)
router.get(
  '/course/:courseId/stats',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId } = req.params;

      // Check ownership
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      });

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const count = await prisma.enrollment.count({
        where: { courseId },
      });

      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ count, enrollments });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch enrollment stats' });
    }
  }
);

export default router;