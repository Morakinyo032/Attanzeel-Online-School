import { Router, Response } from 'express';
import { prisma } from '@lms/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendCompletionEmail } from '../services/email';
import { generateCertificatePDF } from '../services/certificateGenerator';

const router = Router();

// POST /api/certificates/:courseId - Generate certificate
router.post(
  '/:courseId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { courseId } = req.params;

      // Check if already has certificate
      const existing = await prisma.certificate.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (existing) {
        return res.json({ certificate: existing, message: 'Certificate already issued' });
      }

      // Check enrollment progress is 100%
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId, courseId },
        },
      });

      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }

      if (enrollment.progress < 100) {
        return res.status(400).json({ error: 'Course not completed yet' });
      }

      // Create certificate
      const certificate = await prisma.certificate.create({
        data: {
          userId,
          courseId,
        },
        include: {
          course: {
            select: { id: true, title: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      });

      // Send completion email (console log for dev)
      const { sendCompletionEmail } = await import('../services/email');
      sendCompletionEmail(
        certificate.user.email || '',
        certificate.user.name,
        certificate.course.title
      ).catch(console.error);

      res.status(201).json({ certificate, message: 'Certificate generated!' });
    } catch (error) {
      console.error('Error generating certificate:', error);
      res.status(500).json({ 
        error: 'Failed to generate certificate',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// GET /api/certificates - Get all certificates for current user
router.get(
  '/',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const certificates = await prisma.certificate.findMany({
        where: { userId: req.user!.userId },
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
        orderBy: { issuedAt: 'desc' },
      });

      res.json({ certificates });
    } catch (error) {
      console.error('Error fetching certificates:', error);
      res.status(500).json({ error: 'Failed to fetch certificates' });
    }
  }
);

// GET /api/certificates/:courseId - Check if certificate exists for a course
router.get(
  '/:courseId',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const certificate = await prisma.certificate.findUnique({
        where: {
          userId_courseId: {
            userId: req.user!.userId,
            courseId: req.params.courseId,
          },
        },
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      });

      res.json({ certificate });
    } catch (error) {
      console.error('Error checking certificate:', error);
      res.status(500).json({ error: 'Failed to check certificate' });
    }
  }
);

// GET /api/certificates/:id/download - Download certificate as PDF
router.get(
  '/:id/download',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      console.log('Download requested for certificate:', req.params.id);

      const certificate = await prisma.certificate.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { name: true } },
          course: { select: { title: true } },
        },
      });

      if (!certificate) {
        return res.status(404).json({ error: 'Certificate not found' });
      }

      try {
        const doc = generateCertificatePDF(
          certificate.user.name,
          certificate.course.title,
          certificate.issuedAt
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="certificate.pdf"');

        doc.pipe(res);
        doc.end();
        
        console.log('PDF sent successfully');
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        res.status(500).json({ error: 'PDF generation failed' });
      }
    } catch (error) {
      console.error('Certificate download error:', error);
      res.status(500).json({ error: 'Failed' });
    }
  }
);
export default router;