import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { text, format } = await req.json();

  // For a simple production-ready export, we return the text as a file blob
  // In a more complex setup, you would use 'pdfkit' or 'docx' libraries here.
  const filename = `KronaWork-Export.${format}`;
  
  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}