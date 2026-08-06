import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/resources - Upload a resource
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, fileUrl, courseId } = req.body;

      if (!title || !fileUrl || !courseId) {
        return res.status(400).json({ error: 'title, fileUrl, and courseId are required' });
      }

      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const resource = await prisma.resource.create({
        data: { title, fileUrl, courseId },
      });

      res.status(201).json({ resource });
    } catch (error) {
      console.error('Error creating resource:', error);
      res.status(500).json({ error: 'Failed to create resource' });
    }
  }
);

// GET /api/resources/course/:courseId
router.get('/course/:courseId', async (req, res: Response) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ resources });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// DELETE /api/resources/:id
router.delete(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const resource = await prisma.resource.findUnique({
        where: { id: req.params.id },
        include: { course: true },
      });

      if (!resource) return res.status(404).json({ error: 'Resource not found' });
      if (resource.course.instructorId !== req.user!.userId &&
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      await prisma.resource.delete({ where: { id: req.params.id } });
      res.json({ message: 'Deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete' });
    }
  }
);

export default router;