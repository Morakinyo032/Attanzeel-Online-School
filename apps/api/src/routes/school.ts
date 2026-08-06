import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ====================
// STATIC ROUTES FIRST
// ====================

// GET /api/school/my-subjects - Get student's enrolled subjects
router.get(
  '/my-subjects',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const enrollments = await prisma.schoolEnrollment.findMany({
        where: { userId: req.user!.userId },
        include: {
          subject: {
            include: {
              class: {
                include: { school: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ enrollments });
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
  }
);

// POST /api/school/enroll - Enroll in a subject
router.post(
  '/enroll',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { subjectId } = req.body;
      const userId = req.user!.userId;

      if (!subjectId) {
        return res.status(400).json({ error: 'subjectId is required' });
      }

      const existing = await prisma.schoolEnrollment.findUnique({
        where: { userId_subjectId: { userId, subjectId } },
      });

      if (existing) {
        return res.status(400).json({ error: 'Already enrolled' });
      }

      const enrollment = await prisma.schoolEnrollment.create({
        data: { userId, subjectId, progress: 0 },
      });

      res.status(201).json({ enrollment });
    } catch (error) {
      console.error('Error enrolling:', error);
      res.status(500).json({ error: 'Failed to enroll' });
    }
  }
);

// GET /api/school/classes/:classId/subjects - Get subjects for a class
router.get('/classes/:classId/subjects', async (req, res: Response) => {
  try {
    const subjects = await prisma.schoolSubject.findMany({
      where: { classId: req.params.classId },
      include: {
        _count: { select: { topics: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// GET /api/school/subjects/:subjectId/topics - Get topics for a subject
router.get('/subjects/:subjectId/topics', async (req, res: Response) => {
  try {
    const topics = await prisma.schoolTopic.findMany({
      where: { subjectId: req.params.subjectId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, content: true, videoUrl: true, order: true },
        },
      },
      orderBy: { order: 'asc' },
    });
    res.json({ topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// POST /api/school/classes - Create class
router.post(
  '/classes',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, schoolId } = req.body;

      if (!name || !schoolId) {
        return res.status(400).json({ error: 'Name and schoolId are required' });
      }

      const classItem = await prisma.schoolClass.create({
        data: { name, schoolId },
      });

      res.status(201).json({ class: classItem });
    } catch (error) {
      console.error('Error creating class:', error);
      res.status(500).json({ error: 'Failed to create class' });
    }
  }
);

// PUT /api/school/classes/:classId - Update class
router.put(
  '/classes/:classId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const classItem = await prisma.schoolClass.update({
        where: { id: req.params.classId },
        data: { name: req.body.name },
      });
      res.json({ class: classItem });
    } catch (error) {
      console.error('Error updating class:', error);
      res.status(500).json({ error: 'Failed to update class' });
    }
  }
);

// DELETE /api/school/classes/:classId - Delete class
router.delete(
  '/classes/:classId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.schoolClass.delete({ where: { id: req.params.classId } });
      res.json({ message: 'Class deleted' });
    } catch (error) {
      console.error('Error deleting class:', error);
      res.status(500).json({ error: 'Failed to delete class' });
    }
  }
);

// POST /api/school/subjects - Create subject
router.post(
  '/subjects',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, code, classId } = req.body;

      if (!name || !classId) {
        return res.status(400).json({ error: 'Name and classId are required' });
      }

      const subject = await prisma.schoolSubject.create({
        data: { name, code: code || '', classId },
      });

      res.status(201).json({ subject });
    } catch (error) {
      console.error('Error creating subject:', error);
      res.status(500).json({ error: 'Failed to create subject' });
    }
  }
);

// DELETE /api/school/subjects/:subjectId - Delete subject
router.delete(
  '/subjects/:subjectId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.schoolSubject.delete({ where: { id: req.params.subjectId } });
      res.json({ message: 'Subject deleted' });
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  }
);

// POST /api/school/topics - Create topic
router.post(
  '/topics',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, subjectId } = req.body;

      if (!title || !subjectId) {
        return res.status(400).json({ error: 'Title and subjectId are required' });
      }

      const lastTopic = await prisma.schoolTopic.findFirst({
        where: { subjectId },
        orderBy: { order: 'desc' },
      });

      const topic = await prisma.schoolTopic.create({
        data: {
          title,
          subjectId,
          order: (lastTopic?.order || 0) + 1,
        },
      });

      res.status(201).json({ topic });
    } catch (error) {
      console.error('Error creating topic:', error);
      res.status(500).json({ error: 'Failed to create topic' });
    }
  }
);

// DELETE /api/school/topics/:topicId - Delete topic
router.delete(
  '/topics/:topicId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.schoolTopic.delete({ where: { id: req.params.topicId } });
      res.json({ message: 'Topic deleted' });
    } catch (error) {
      console.error('Error deleting topic:', error);
      res.status(500).json({ error: 'Failed to delete topic' });
    }
  }
);

// POST /api/school/lessons - Create lesson
router.post(
  '/lessons',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, videoUrl, topicId } = req.body;

      if (!title || !topicId) {
        return res.status(400).json({ error: 'Title and topicId are required' });
      }

      const lastLesson = await prisma.schoolLesson.findFirst({
        where: { topicId },
        orderBy: { order: 'desc' },
      });

      const lesson = await prisma.schoolLesson.create({
        data: {
          title,
          content: content || '',
          videoUrl: videoUrl || '',
          topicId,
          order: (lastLesson?.order || 0) + 1,
        },
      });

      res.status(201).json({ lesson });
    } catch (error) {
      console.error('Error creating lesson:', error);
      res.status(500).json({ error: 'Failed to create lesson' });
    }
  }
);

// PUT /api/school/lessons/:id - Update lesson
router.put(
  '/lessons/:id',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, content, videoUrl } = req.body;

      const lesson = await prisma.schoolLesson.update({
        where: { id: req.params.id },
        data: {
          ...(title && { title }),
          ...(content !== undefined && { content }),
          ...(videoUrl !== undefined && { videoUrl }),
        },
      });

      res.json({ lesson });
    } catch (error) {
      console.error('Error updating lesson:', error);
      res.status(500).json({ error: 'Failed to update lesson' });
    }
  }
);

// DELETE /api/school/lessons/:id - Delete lesson
router.delete(
  '/lessons/:id',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.schoolLesson.delete({ where: { id: req.params.id } });
      res.json({ message: 'Lesson deleted' });
    } catch (error) {
      console.error('Error deleting lesson:', error);
      res.status(500).json({ error: 'Failed to delete lesson' });
    }
  }
);

// ====================
// DYNAMIC ROUTES LAST
// ====================

// GET /api/school - List all schools
router.get('/', async (_req, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      include: {
        _count: { select: { classes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ schools });
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// POST /api/school - Create school
router.post(
  '/',
  authenticate(['ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, description, logo } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'School name is required' });
      }

      const school = await prisma.school.create({
        data: {
          name,
          description: description || '',
          logo: logo || '',
          createdBy: req.user!.userId,
        },
      });

      res.status(201).json({ school });
    } catch (error) {
      console.error('Error creating school:', error);
      res.status(500).json({ error: 'Failed to create school' });
    }
  }
);

// GET /api/school/:schoolId - Get single school with classes
router.get('/:schoolId', async (req, res: Response) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      include: {
        classes: {
          include: {
            _count: { select: { subjects: true } },
            subjects: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json({ school });
  } catch (error) {
    console.error('Error fetching school:', error);
    res.status(500).json({ error: 'Failed to fetch school' });
  }
});

// PUT /api/school/:schoolId - Update school
router.put(
  '/:schoolId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const school = await prisma.school.update({
        where: { id: req.params.schoolId },
        data: {
          name: req.body.name,
          description: req.body.description,
          logo: req.body.logo,
          published: req.body.published,
        },
      });
      res.json({ school });
    } catch (error) {
      console.error('Error updating school:', error);
      res.status(500).json({ error: 'Failed to update school' });
    }
  }
);

// DELETE /api/school/:schoolId - Delete school
router.delete(
  '/:schoolId',
  authenticate(['ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.school.delete({ where: { id: req.params.schoolId } });
      res.json({ message: 'School deleted' });
    } catch (error) {
      console.error('Error deleting school:', error);
      res.status(500).json({ error: 'Failed to delete school' });
    }
  }
);

export default router;