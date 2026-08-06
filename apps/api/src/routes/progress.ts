import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/progress/:lessonId - Mark lesson as complete
router.post(
  '/:lessonId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { lessonId } = req.params;

      // Check if lesson exists
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: { course: true },
          },
        },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      // Check if user is enrolled in the course
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: lesson.module.courseId,
          },
        },
      });

      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }

      // Create or update lesson progress
      const progress = await prisma.lessonProgress.upsert({
        where: {
          userId_lessonId: {
            userId,
            lessonId,
          },
        },
        create: {
          userId,
          lessonId,
          completed: true,
        },
        update: {
          completed: true,
        },
      });

      // Update course enrollment progress
      await updateCourseProgress(userId, lesson.module.courseId);

      res.json({ progress });
    } catch (error) {
      console.error('Error updating progress:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }
);

// DELETE /api/progress/:lessonId - Mark lesson as incomplete
router.delete(
  '/:lessonId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { lessonId } = req.params;

      // Find the lesson to get courseId
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          module: {
            include: { course: true },
          },
        },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      // Delete the progress record
      await prisma.lessonProgress.deleteMany({
        where: {
          userId,
          lessonId,
        },
      });

      // Update course enrollment progress
      await updateCourseProgress(userId, lesson.module.courseId);

      res.json({ message: 'Progress removed' });
    } catch (error) {
      console.error('Error removing progress:', error);
      res.status(500).json({ error: 'Failed to remove progress' });
    }
  }
);

// GET /api/progress/course/:courseId - Get progress for a course
router.get(
  '/course/:courseId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { courseId } = req.params;

      // Get all completed lesson IDs
      const completedLessons = await prisma.lessonProgress.findMany({
        where: {
          userId,
          completed: true,
          lesson: {
            module: {
              courseId,
            },
          },
        },
        select: {
          lessonId: true,
        },
      });

      // Get total lessons count
      const totalLessons = await prisma.lesson.count({
        where: {
          module: {
            courseId,
          },
        },
      });

      // Get enrollment progress
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
        select: {
          progress: true,
        },
      });

      res.json({
        completedLessons: completedLessons.map(p => p.lessonId),
        totalLessons,
        progress: enrollment?.progress || 0,
      });
    } catch (error) {
      console.error('Error fetching progress:', error);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  }
);

// Helper function to update course progress
async function updateCourseProgress(userId: string, courseId: string) {
  // Count completed lessons in this course
  const completedCount = await prisma.lessonProgress.count({
    where: {
      userId,
      completed: true,
      lesson: {
        module: {
          courseId,
        },
      },
    },
  });

  // Count total lessons in this course
  const totalLessons = await prisma.lesson.count({
    where: {
      module: {
        courseId,
      },
    },
  });

  // Calculate progress percentage
  const progress = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

  // Update enrollment
  await prisma.enrollment.update({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    data: {
      progress,
    },
  });
}

export default router;