import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/analytics/course/:courseId/students - Get all students with progress
router.get(
  '/course/:courseId/students',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId } = req.params;

      // Verify ownership
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Get all enrollments with student info and progress
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get total lessons in course
      const totalLessons = await prisma.lesson.count({
        where: { module: { courseId } },
      });

      // Get completed lessons per student
      const studentsWithProgress = await Promise.all(
        enrollments.map(async (enrollment) => {
          const completedCount = await prisma.lessonProgress.count({
            where: {
              userId: enrollment.userId,
              completed: true,
              lesson: { module: { courseId } },
            },
          });

          // Get quiz attempts for this course
          const quizAttempts = await prisma.quizAttempt.findMany({
            where: {
              userId: enrollment.userId,
              quiz: { lesson: { module: { courseId } } },
            },
            include: {
              quiz: {
                select: { title: true, passingScore: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          return {
            userId: enrollment.user.id,
            name: enrollment.user.name,
            email: enrollment.user.email,
            enrolledAt: enrollment.createdAt,
            progress: enrollment.progress,
            completedLessons: completedCount,
            totalLessons,
            quizAttempts,
          };
        })
      );

      res.json({ students: studentsWithProgress, totalLessons });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

// GET /api/analytics/instructor/overview - Get instructor dashboard overview
router.get(
  '/instructor/overview',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const totalCourses = await prisma.course.count({
        where: { instructorId: userId },
      });

      const totalStudents = await prisma.enrollment.count({
        where: { course: { instructorId: userId } },
      });

      const publishedCourses = await prisma.course.count({
        where: { instructorId: userId, published: true },
      });

      // Recent enrollments
      const recentEnrollments = await prisma.enrollment.findMany({
        where: { course: { instructorId: userId } },
        include: {
          user: { select: { id: true, name: true, email: true } },
          course: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Course-wise student counts
      const courseStats = await prisma.course.findMany({
        where: { instructorId: userId },
        include: {
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        totalCourses,
        totalStudents,
        publishedCourses,
        recentEnrollments,
        courseStats,
      });
    } catch (error) {
      console.error('Error fetching overview:', error);
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  }
);

export default router;