import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export async function POST(req: Request) {
  try {
    const { text, format } = await req.json();

    if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    // --- PDF GENERATION ---
    if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 11;
      const margin = 50;
      const lineHeight = 15;
      
      const words = text.split(' ');
      let line = '';
      let y = height - margin;

      for (const word of words) {
        const testLine = line + word + ' ';
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (textWidth > width - 2 * margin) {
          page.drawText(line, { x: margin, y, size: fontSize, font });
          y -= lineHeight;
          line = word + ' ';
          if (y < margin) {
            page = pdfDoc.addPage();
            y = height - margin;
          }
        } else {
          line = testLine;
        }
      }
      page.drawText(line, { x: margin, y, size: fontSize, font });

      const pdfBytes = await pdfDoc.save();
      
      // FIX: Cast strictly to BodyInit (Web Standard) to resolve the Buffer/BlobPart mismatch
      return new NextResponse(pdfBytes as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="career-document.pdf"',
        },
      });
    } 
    
    // --- WORD GENERATION ---
    if (format === 'docx') {
      const paragraphs = text.split('\n').map((line: string) => 
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 200 }, 
        })
      );

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const buffer = await Packer.toBuffer(doc);

      // FIX: Cast strictly to BodyInit here as well
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="career-document.docx"',
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  } catch (error) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}