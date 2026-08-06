import PDFDocument from 'pdfkit';

export function generateCertificatePDF(
  studentName: string,
  courseTitle: string,
  issuedDate: Date
): PDFDocument {
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4',
    margin: 0,
  });

  const width = doc.page.width;
  const height = doc.page.height;

  // Background
  doc.rect(0, 0, width, height).fill('#f8fafc');

  // Outer border
  doc.rect(30, 30, width - 60, height - 60)
    .stroke('#2563eb');
  
  // Inner border
  doc.rect(35, 35, width - 70, height - 70)
    .stroke('#f59e0b');

  // Top decorative line
  doc.moveTo(100, 80)
    .lineTo(width - 100, 80)
    .stroke('#2563eb');
  
  doc.moveTo(100, 85)
    .lineTo(width - 100, 85)
    .stroke('#f59e0b');

  // Header
  doc.fontSize(40)
    .font('Helvetica-Bold')
    .fillColor('#2563eb')
    .text('Certificate of Completion', 0, 120, { align: 'center' });

  // Subtitle
  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#64748b')
    .text('This is proudly presented to', 0, 190, { align: 'center' });

  // Student Name
  doc.fontSize(36)
    .font('Helvetica-Bold')
    .fillColor('#0f172a')
    .text(studentName, 0, 230, { align: 'center' });

  // Decorative line under name
  const nameWidth = doc.widthOfString(studentName);
  const lineStart = (width - Math.min(nameWidth + 40, 400)) / 2;
  doc.moveTo(lineStart, 280)
    .lineTo(lineStart + Math.min(nameWidth + 40, 400), 280)
    .stroke('#f59e0b');

  // Course completion text
  doc.fontSize(16)
    .font('Helvetica')
    .fillColor('#475569')
    .text('has successfully completed the course', 0, 310, { align: 'center' });

  // Course Title
  doc.fontSize(28)
    .font('Helvetica-Bold')
    .fillColor('#2563eb')
    .text(courseTitle, 0, 350, { align: 'center' });

  // Date
  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#64748b')
    .text(
      `Issued on ${issuedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      0,
      420,
      { align: 'center' }
    );

  // Bottom decorative line
  doc.moveTo(100, height - 80)
    .lineTo(width - 100, height - 80)
    .stroke('#f59e0b');
  
  doc.moveTo(100, height - 85)
    .lineTo(width - 100, height - 85)
    .stroke('#2563eb');

  // Footer
  doc.fontSize(10)
    .font('Helvetica')
    .fillColor('#94a3b8')
    .text('Attanzeel Online Schools- Empowering Education', 0, height - 60, { align: 'center' });

  return doc;
}