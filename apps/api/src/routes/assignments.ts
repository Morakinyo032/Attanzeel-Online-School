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
      const { title, description, dueDate, maxPoints, courseId, submissionType, allowedFormats, instructions } = req.body;

      const assignment = await prisma.assignment.create({
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : null,
          maxPoints: maxPoints || 100,
          courseId: courseId || null,
          submissionType: submissionType || 'TEXT',
          allowedFormats: allowedFormats || null,
          instructions: instructions || null,
        },
      });

      res.status(201).json({ assignment });
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(500).json({ error: 'Failed to create assignment' });
    }
  }
);

// PUT /api/assignments/:id - Update assignment
router.put(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, dueDate, maxPoints, submissionType, allowedFormats, instructions } = req.body;

      const assignment = await prisma.assignment.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(maxPoints && { maxPoints }),
          ...(submissionType && { submissionType }),
          ...(allowedFormats !== undefined && { allowedFormats }),
          ...(instructions !== undefined && { instructions }),
        },
      });

      res.json({ assignment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  }
);

// GET /api/assignments/course/:courseId
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

// GET /api/assignments/:id
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
        },
      });

      if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
      res.json({ assignment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  }
);

// POST /api/assignments/:id/submit - Submit assignment
router.post('/:id/submit', authenticate(), async (req: AuthRequest, res: Response) => {
  try {
    const { content, fileUrl, submissionUrl } = req.body;

    const existing = await prisma.submission.findFirst({
      where: {
        assignmentId: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (existing) {
      const updated = await prisma.submission.update({
        where: { id: existing.id },
        data: {
          content: content || existing.content,
          fileUrl: fileUrl || existing.fileUrl,
          submissionUrl: submissionUrl || existing.submissionUrl,
        },
      });
      return res.json({ submission: updated, message: 'Submission updated' });
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId: req.params.id,
        userId: req.user!.userId,
        content: content || '',
        fileUrl: fileUrl || null,
        submissionUrl: submissionUrl || null,
      },
    });

    res.status(201).json({ submission });
  } catch (error) {
    console.error('Error submitting:', error);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// GET /api/assignments/:id/my-submission
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

// PUT /api/assignments/submissions/:id/grade
router.put(
  '/submissions/:id/grade',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { grade, feedback } = req.body;
      const submission = await prisma.submission.update({
        where: { id: req.params.id },
        data: { grade, feedback },
      });
      res.json({ submission });
    } catch (error) {
      res.status(500).json({ error: 'Failed to grade' });
    }
  }
);

// GET /api/assignments/course/:courseId/gradebook
router.get(
  '/course/:courseId/gradebook',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const assignments = await prisma.assignment.findMany({
        where: { courseId: req.params.courseId },
        include: {
          submissions: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: req.params.courseId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      const gradebook = enrollments.map(enrollment => {
        const studentGrades = assignments.map(assignment => {
          const submission = assignment.submissions.find(s => s.userId === enrollment.userId);
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

        return { student: enrollment.user, grades: studentGrades, overallGrade, totalEarned, totalPossible };
      });

      res.json({ gradebook, assignments: assignments.map(a => ({ id: a.id, title: a.title, maxPoints: a.maxPoints })) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch gradebook' });
    }
  }
);

export default router;