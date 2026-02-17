import OpenAI from "openai";
import { NextResponse } from "next/server";
import PDFParser from "pdf2json"; 
import * as mammoth from "mammoth";

// 1. SET RUNTIME ONCE
// Must be 'nodejs' to support PDF and Word parsing libraries.
export const runtime = 'nodejs';

// 2. DEFINE TYPES
type ChatContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const text = formData.get('text') as string;
    const mode = formData.get('mode') as string;
    const language = formData.get('language') as string;
    
    const fileStrings = formData.getAll('image') as string[]; 

    let extractedTextContext = "";
    const imagesToSend: ChatContentPart[] = [];

    // 3. FILE PARSING LOGIC
    for (const fileStr of fileStrings) {
      if (fileStr.startsWith("data:application/pdf")) {
        const base64Data = fileStr.split(",")[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const pdfText = await new Promise<string>((resolve, reject) => {
          const parser = new (PDFParser as unknown as new (ctx: null, bit: number) => PDFParser)(null, 1);
          parser.on("pdfParser_dataError", (errData: { parserError: string | Error }) => reject(errData.parserError));
          parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
          parser.parseBuffer(buffer);
        });
        
        extractedTextContext += `\n[ATTACHED PDF CONTENT]:\n${pdfText}\n`;
      } 
      else if (fileStr.includes("wordprocessingml")) {
        const base64Data = fileStr.split(",")[1];
        const buffer = Buffer.from(base64Data, 'base64');
        try {
          const docData = await mammoth.extractRawText({ buffer: buffer });
          extractedTextContext += `\n[ATTACHED DOC CONTENT]:\n${docData.value}\n`;
        } catch (e: unknown) { 
          console.error("Word Doc Error", e); 
        } 
      } 
      else if (fileStr.startsWith("data:image")) {
        imagesToSend.push({ 
          type: "image_url", 
          image_url: { url: fileStr } 
        });
      }
    }

    // 4. DEFINE SYSTEM ROLE
    let systemInstruction = "";
    switch (mode) {
      case 'spy': systemInstruction = `You are KronaWork's Elite Job Scout (${language}). Extract salary, requirements, and next steps.`; break;
      case 'resume': systemInstruction = `You are KronaWork's Resume Architect (${language}). Rewrite this to be ATS-friendly.`; break;
      case 'review': systemInstruction = `You are KronaWork's Hiring Manager (${language}). Roast this CV constructively.`; break;
      case 'cover': systemInstruction = `You are KronaWork's Cover Letter Specialist (${language}). Write a compelling hook.`; break;
      default: systemInstruction = `You are KronaWork, a helpful career assistant (${language}).`;
    }

    // 5. PREPARE OPENAI PAYLOAD
    const finalPrompt = `User Query: ${text}\n\n${extractedTextContext}`;
    const userContent: ChatContentPart[] = [
      { type: "text", text: finalPrompt }, 
      ...imagesToSend
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userContent },
      ],
    });

    // 6. STREAMING ENGINE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) controller.enqueue(encoder.encode(content));
        }
        controller.close();
      },
    });

    return new NextResponse(stream);

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}