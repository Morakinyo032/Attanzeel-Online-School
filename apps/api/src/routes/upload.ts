import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Use absolute path from project root
const uploadDir = path.join(process.cwd(), 'uploads');

// Create uploads directory
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// POST /api/upload
router.post('/upload', (req: Request, res: Response) => {
  try {
    const { file, filename } = req.body;

    if (!file || !filename) {
      return res.status(400).json({ error: 'file and filename are required' });
    }

    const base64Data = file.replace(/^data:.*?;base64,/, '');
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(filename);
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, base64Data, 'base64');

    console.log('File saved to:', filePath);

    res.json({
      url: `/api/uploads/${uniqueName}`,
      filename: filename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/uploads/:filename
router.get('/uploads/:filename', (req: Request, res: Response) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    
    console.log('Serving file:', filePath);

    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file extension for content type
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.txt': 'text/plain',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;