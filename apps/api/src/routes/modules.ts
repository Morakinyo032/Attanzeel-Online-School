import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createModuleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  courseId: z.string().min(1, 'Course ID is required'),
});

const updateModuleSchema = z.object({
  title: z.string().min(1).optional(),
  order: z.number().int().positive().optional(),
});

const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().nullable(),
  moduleId: z.string().min(1, 'Module ID is required'),
});

const updateLessonSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().nullable(),
  order: z.number().int().positive().optional(),
});

// GET /api/modules?courseId=xxx
router.get('/', async (req, res: Response) => {
  try {
    console.log('Modules GET called with query:', req.query); // Debug log
    
    const courseId = req.query.courseId as string;
    
    if (!courseId) {
      console.log('No courseId provided'); // Debug log
      return res.status(400).json({ error: 'courseId query parameter is required' });
    }

    console.log('Fetching modules for courseId:', courseId); // Debug log

    const modules = await prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, content: true, order: true },
        },
      },
    });

    console.log('Found modules:', modules.length); // Debug log

    res.json({ modules });
  } catch (error) {
    console.error('Error fetching modules:', error); // This will show the full error
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// POST /api/modules - Create a module (instructor only, must own the course)
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createModuleSchema.parse(req.body);

      // Verify course ownership
      const course = await prisma.course.findUnique({
        where: { id: data.courseId },
      });

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      if (course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Get the next order number
      const lastModule = await prisma.module.findFirst({
        where: { courseId: data.courseId },
        orderBy: { order: 'desc' },
      });

      const module = await prisma.module.create({
        data: {
          title: data.title,
          courseId: data.courseId,
          order: (lastModule?.order || 0) + 1,
        },
        include: {
          lessons: true,
        },
      });

      res.status(201).json({ module });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating module:', error);
      res.status(500).json({ error: 'Failed to create module' });
    }
  }
);

// PUT /api/modules/:id - Update a module
router.put(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const module = await prisma.module.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      });

      if (!module) {
        return res.status(404).json({ error: 'Module not found' });
      }

      if (module.course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const data = updateModuleSchema.parse(req.body);
      const updated = await prisma.module.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ module: updated });
    } catch (error) {
      console.error('Error updating module:', error);
      res.status(500).json({ error: 'Failed to update module' });
    }
  }
);

// DELETE /api/modules/:id - Delete a module
router.delete(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const module = await prisma.module.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      });

      if (!module) {
        return res.status(404).json({ error: 'Module not found' });
      }

      if (module.course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await prisma.module.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Module deleted' });
    } catch (error) {
      console.error('Error deleting module:', error);
      res.status(500).json({ error: 'Failed to delete module' });
    }
  }
);

// POST /api/modules/lessons - Create a lesson in a module
router.post(
  '/lessons',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createLessonSchema.parse(req.body);

      const module = await prisma.module.findUnique({
        where: { id: data.moduleId },
        include: { course: true },
      });

      if (!module) {
        return res.status(404).json({ error: 'Module not found' });
      }

      if (module.course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const lastLesson = await prisma.lesson.findFirst({
        where: { moduleId: data.moduleId },
        orderBy: { order: 'desc' },
      });

      const lesson = await prisma.lesson.create({
        data: {
            title: data.title,
            content: data.content || '',
            videoUrl: data.videoUrl || null,
            moduleId: data.moduleId,
            order: (lastLesson?.order || 0) + 1,
        },
        });

      res.status(201).json({ lesson });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating lesson:', error);
      res.status(500).json({ error: 'Failed to create lesson' });
    }
  }
);

// PUT /api/modules/lessons/:id - Update a lesson
// PUT /api/modules/lessons/:id - Update a lesson
router.put(
  '/lessons/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      console.log('Update lesson body:', req.body);

      const lesson = await prisma.lesson.findUnique({
        where: { id: req.params.id },
        include: { module: { include: { course: true } } },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      if (lesson.module.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const { title, content, videoUrl, order } = req.body;

      const updated = await prisma.lesson.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(order !== undefined && { order }),
          videoUrl: videoUrl || null,
        },
      });

      console.log('Updated lesson:', updated.title, 'videoUrl:', updated.videoUrl);
      res.json({ lesson: updated });
    } catch (error) {
      console.error('Error updating lesson:', error);
      res.status(500).json({ error: 'Failed to update lesson' });
    }
  }
);

// DELETE /api/modules/lessons/:id - Delete a lesson
router.delete(
  '/lessons/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: req.params.id },
        include: { module: { include: { course: true } } },
      });

      if (!lesson) {
        return res.status(404).json({ error: 'Lesson not found' });
      }

      if (lesson.module.course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await prisma.lesson.delete({
        where: { id: req.params.id },
      });

      res.json({ message: 'Lesson deleted' });
    } catch (error) {
      console.error('Error deleting lesson:', error);
      res.status(500).json({ error: 'Failed to delete lesson' });
    }
  }
);

export default router;