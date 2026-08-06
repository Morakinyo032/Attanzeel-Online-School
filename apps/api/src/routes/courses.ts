import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  price: z.number().min(0).default(0),
  imageUrl: z.string().url().optional().nullable(),
});

const updateCourseSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  price: z.number().min(0).optional(),
  published: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
});

// GET /api/courses - List all published courses (public)
// GET /api/courses - List published courses with search & filters
router.get('/', async (req, res: Response) => {
  try {
    const { search, price, sort, page = '1', limit = '9' } = req.query;
    
    // Build where clause
    const where: any = { published: true };
    
    // Search by title
    if (search && typeof search === 'string') {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    // Filter by price
    if (price === 'free') {
      where.price = 0;
    } else if (price === 'paid') {
      where.price = { gt: 0 };
    }
    
    // Build orderBy
    let orderBy: any = { createdAt: 'desc' }; // default: newest
    
    if (sort === 'popular') {
      orderBy = { enrollments: { _count: 'desc' } };
    } else if (sort === 'price-low') {
      orderBy = { price: 'asc' };
    } else if (sort === 'price-high') {
      orderBy = { price: 'desc' };
    } else if (sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    }
    
    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    const [courses, totalCount] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          instructor: {
            select: { id: true, name: true },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.course.count({ where }),
    ]);
    
    res.json({
      courses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:id
router.get('/:id', async (req, res: Response) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        instructor: {
          select: { id: true, name: true },
        },
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              select: { 
                id: true, 
                title: true, 
                content: true,    // ← MUST HAVE THIS
                videoUrl: true,   // ← MUST HAVE THIS
                order: true 
              },
            },
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    res.json({ course });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /api/courses - Create new course (instructor/admin only)
router.post(
  '/',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createCourseSchema.parse(req.body);
      
      const course = await prisma.course.create({
        data: {
          ...data,
          instructorId: req.user!.userId,
        },
      });
      
      res.status(201).json({ course });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating course:', error);
      res.status(500).json({ error: 'Failed to create course' });
    }
  }
);

// PUT /api/courses/:id - Update course (owner or admin only)
router.put(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const course = await prisma.course.findUnique({
        where: { id: req.params.id },
      });
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      // Check ownership
      if (course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const data = updateCourseSchema.parse(req.body);
      
      const updated = await prisma.course.update({
        where: { id: req.params.id },
        data,
      });
      
      res.json({ course: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error updating course:', error);
      res.status(500).json({ error: 'Failed to update course' });
    }
  }
);

// DELETE /api/courses/:id - Delete course
router.delete(
  '/:id',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const course = await prisma.course.findUnique({
        where: { id: req.params.id },
      });
      
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      
      if (course.instructorId !== req.user!.userId && 
          !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      await prisma.course.delete({
        where: { id: req.params.id },
      });
      
      res.json({ message: 'Course deleted successfully' });
    } catch (error) {
      console.error('Error deleting course:', error);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  }
);

// GET /api/courses/instructor/mine - Get instructor's own courses
router.get(
  '/instructor/mine',
  authenticate(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const courses = await prisma.course.findMany({
        where: { instructorId: req.user!.userId },
        include: {
          _count: {
            select: { enrollments: true, modules: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      res.json({ courses });
    } catch (error) {
      console.error('Error fetching instructor courses:', error);
      res.status(500).json({ error: 'Failed to fetch your courses' });
    }
  }
);

export default router;