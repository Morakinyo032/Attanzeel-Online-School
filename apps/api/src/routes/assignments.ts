import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/assignments - Create assignment
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, dueDate, maxPoints, courseId } = req.body;

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const assignment = await prisma.assignment.create({
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          maxPoints: maxPoints || 100,
          courseId,
        },
      });

      res.status(201).json({ assignment });
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ error: 'Failed to create assignment' });
    }
  }
);

// GET /api/assignments/course/:courseId - Get all assignments for a course
router.get('/course/:courseId', async (req, res: Response) => {
  try {
    const assignments = await prisma.assignment.findMany({
      where: { courseId: req.params.courseId },
      include: {
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /api/assignments/:id - Get single assignment with submissions
router.get(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: {
          submissions: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          course: { select: { instructorId: true } },
        },
      });

      if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
      if (assignment.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      res.json({ assignment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  }
);

// POST /api/assignments/:id/submit - Submit assignment
router.post('/:id/submit', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const { content, fileUrl } = req.body;

    // Check if already submitted
    const existing = await prisma.submission.findFirst({
      where: {
        assignmentId: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (existing) {
      // Update existing submission
      const updated = await prisma.submission.update({
        where: { id: existing.id },
        data: { content, fileUrl },
      });
      return res.json({ submission: updated, message: 'Submission updated' });
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId: req.params.id,
        userId: req.user!.userId,
        content,
        fileUrl,
      },
    });

    res.status(201).json({ submission });
  } catch (error) {
    console.error('Error submitting:', error);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// GET /api/assignments/:id/my-submission - Get student's submission
router.get('/:id/my-submission', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const submission = await prisma.submission.findFirst({
      where: {
        assignmentId: req.params.id,
        userId: req.user!.userId,
      },
    });

    res.json({ submission });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// PUT /api/assignments/submissions/:id/grade - Grade a submission
router.put(
  '/submissions/:id/grade',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { grade, feedback } = req.body;

      const submission = await prisma.submission.findUnique({
        where: { id: req.params.id },
        include: { assignment: { include: { course: true } } },
      });

      if (!submission) return res.status(404).json({ error: 'Submission not found' });
      if (submission.assignment.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const updated = await prisma.submission.update({
        where: { id: req.params.id },
        data: { grade, feedback },
      });

      res.json({ submission: updated });
    } catch (error) {
      console.error('Error grading:', error);
      res.status(500).json({ error: 'Failed to grade' });
    }
  }
);

// GET /api/assignments/course/:courseId/gradebook - Grade book for course
router.get(
  '/course/:courseId/gradebook',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { courseId } = req.params;

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const assignments = await prisma.assignment.findMany({
        where: { courseId },
        include: {
          submissions: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Get all enrolled students
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Build gradebook
      const gradebook = enrollments.map(enrollment => {
        const studentGrades = assignments.map(assignment => {
          const submission = assignment.submissions.find(
            s => s.userId === enrollment.userId
          );
          return {
            assignmentId: assignment.id,
            assignmentTitle: assignment.title,
            maxPoints: assignment.maxPoints,
            submitted: !!submission,
            grade: submission?.grade ?? null,
            feedback: submission?.feedback ?? null,
          };
        });

        const totalEarned = studentGrades.reduce((sum, g) => sum + (g.grade || 0), 0);
        const totalPossible = studentGrades.reduce((sum, g) => sum + g.maxPoints, 0);
        const overallGrade = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

        return {
          student: enrollment.user,
          grades: studentGrades,
          overallGrade,
          totalEarned,
          totalPossible,
        };
      });

      res.json({ gradebook, assignments: assignments.map(a => ({ id: a.id, title: a.title, maxPoints: a.maxPoints })) });
    } catch (error) {
      console.error('Error fetching gradebook:', error);
      res.status(500).json({ error: 'Failed to fetch gradebook' });
    }
  }
);

export default router;