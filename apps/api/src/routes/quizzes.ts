import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/quizzes/:lessonId - Get quiz for a lesson
router.get('/:lessonId', async (req, res: Response) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { lessonId: req.params.lessonId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: true,
          },
        },
      },
    });
    res.json({ quiz });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// POST /api/quizzes - Create or update quiz for a lesson
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { lessonId, title, description, passingScore, questions } = req.body;

      // Verify lesson ownership
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: { module: { include: { course: true } } },
      });

      if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
      if (lesson.module.course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Delete existing quiz if any
      await prisma.quiz.deleteMany({ where: { lessonId } });

      // Create quiz with questions
      const quiz = await prisma.quiz.create({
        data: {
          title,
          description,
          passingScore: passingScore || 70,
          examType: req.body.examType || null,
          term: req.body.term || null,
          timeLimit: req.body.timeLimit || null,
          totalMarks: req.body.totalMarks || null,
          startDate: req.body.startDate ? new Date(req.body.startDate) : null,
          endDate: req.body.endDate ? new Date(req.body.endDate) : null,
          lessonId: req.body.lessonId || null,
          schoolLessonId: req.body.schoolLessonId || null,
          questions: {
            create: questions.map((q: any, qIndex: number) => ({
              text: q.text,
              type: q.type || 'MULTIPLE_CHOICE',
              points: q.points || 1,
              order: qIndex + 1,
              options: {
                create: q.options?.map((o: any) => ({
                  text: o.text,
                  isCorrect: o.isCorrect || false,
                })),
              },
            })),
          },
        },
        include: {
          questions: {
            include: { options: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      res.json({ quiz });
    } catch (error) {
      console.error('Error creating quiz:', error);
      res.status(500).json({ error: 'Failed to create quiz' });
    }
  }
);

// POST /api/quizzes/:quizId/submit - Submit quiz answers
router.post(
  '/:quizId/submit',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { quizId } = req.params;
      const { answers } = req.body; // [{ questionId, answer }]
      const userId = req.user!.userId;

      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          questions: {
            include: { options: true },
          },
        },
      });

      if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

      let totalPoints = 0;
      let earnedPoints = 0;
      const answerRecords: any[] = [];

      for (const question of quiz.questions) {
        const userAnswer = answers.find((a: any) => a.questionId === question.id);
        totalPoints += question.points;
        let isCorrect = false;

        if (!userAnswer) continue;

        if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
          const correctOption = question.options.find(o => o.isCorrect);
          isCorrect = correctOption?.id === userAnswer.answer;
        } else if (question.type === 'SHORT_ANSWER') {
          const correctOption = question.options.find(o => o.isCorrect);
          isCorrect = userAnswer.answer.toLowerCase().trim() === correctOption?.text.toLowerCase().trim();
        }

        if (isCorrect) earnedPoints += question.points;

        answerRecords.push({
          questionId: question.id,
          answer: userAnswer.answer,
          isCorrect,
        });
      }

      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = score >= quiz.passingScore;

      const attempt = await prisma.quizAttempt.create({
        data: {
          userId,
          quizId,
          score,
          passed,
          answers: {
            create: answerRecords,
          },
        },
        include: {
          answers: true,
        },
      });

      res.json({ attempt, score, passed, totalPoints, earnedPoints });
    } catch (error) {
      console.error('Error submitting quiz:', error);
      res.status(500).json({ error: 'Failed to submit quiz' });
    }
  }
);

// GET /api/quizzes/:quizId/attempts - Get user's quiz attempts
router.get(
  '/:quizId/attempts',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const attempts = await prisma.quizAttempt.findMany({
        where: {
          quizId: req.params.quizId,
          userId: req.user!.userId,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ attempts });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch attempts' });
    }
  }
);

// GET /api/quizzes/subject/:subjectId/exams
router.get('/subject/:subjectId/exams', async (req, res: Response) => {
  try {
    const exams = await prisma.quiz.findMany({
      where: {
        schoolLesson: { topic: { subjectId: req.params.subjectId } },
        examType: { not: null },
      },
      include: {
        schoolLesson: { select: { id: true, title: true } },
        _count: { select: { attempts: true, questions: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json({ exams });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

export default router;