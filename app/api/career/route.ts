import OpenAI from "openai";
import { NextResponse } from "next/server";
import PDFParser from "pdf2json"; 
import * as mammoth from "mammoth";

// JobWisely production runtime
export const runtime = 'nodejs';

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
    
    // --- RESTORED: LOCATION & HOURS DATA ---
    const location = formData.get('location') as string || 'Not specified';
    const hours = formData.get('hours') as string || 'Full-Time';
    
    const fileStrings = formData.getAll('image') as string[]; 

    let extractedTextContext = "";
    const imagesToSend: ChatContentPart[] = [];

    // --- FILE PARSING (PDF & WORD) ---
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
        } catch (e: unknown) { console.error("Word Doc Error", e); } 
      } 
      else if (fileStr.startsWith("data:image")) {
        imagesToSend.push({ type: "image_url", image_url: { url: fileStr } });
      }
    }

    // --- UPDATED BRANDING: JOBWISELY PERSONALITIES ---
    let systemInstruction = "";
    switch (mode) {
      case 'spy': 
        systemInstruction = `You are the JobWisely Elite Scout (${language}). 
        TARGET LOCATION: ${location}. 
        WORK TYPE: ${hours}. 
        Analyze the request and find relevant jobs or career paths matching these criteria.`; 
        break;
      case 'resume': 
        systemInstruction = `You are the JobWisely Resume Architect (${language}). Rewrite this content to be ATS-optimized.`; 
        break;
      case 'review': 
        systemInstruction = `You are the JobWisely Senior Recruiter (${language}). Constructively roast this CV.`; 
        break;
      case 'cover': 
        systemInstruction = `You are the JobWisely Writing Expert (${language}). Draft a punchy cover letter.`; 
        break;
      default: 
        systemInstruction = `You are JobWisely, a helpful career assistant (${language}).`;
    }

    // --- PAYLOAD & STREAMING ---
    const finalPrompt = `User Query: ${text}\n\n${extractedTextContext}`;
    const userContent: ChatContentPart[] = [{ type: "text", text: finalPrompt }, ...imagesToSend];

    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userContent },
      ],
    });

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
    return NextResponse.json({ error: "JobWisely encountered an error processing your request." }, { status: 500 });
  }
}