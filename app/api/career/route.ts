import OpenAI from "openai";
import { NextResponse } from "next/server";
import PDFParser from "pdf2json"; 
import * as mammoth from "mammoth";

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
    const imagesToSend: string[] = [];

    // 1. Process Files (Read Content)
    for (const fileStr of fileStrings) {
      if (fileStr.startsWith("data:application/pdf")) {
        const base64Data = fileStr.split(",")[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const pdfText = await new Promise<string>((resolve, reject) => {
          const parser = new PDFParser(null, 1);
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
        imagesToSend.push(fileStr);
      }
    }

    // 2. Define Personality
    let systemInstruction = "";
    switch (mode) {
      case 'spy': systemInstruction = `You are an elite Job Scout (${language}). Analyze the user's request and any attached job description files. Extract salary, requirements, and next steps.`; break;
      case 'resume': systemInstruction = `You are an expert Resume Builder (${language}). I have attached my current resume text/files. Rewrite it to be ATS-friendly, results-oriented, and punchy.`; break;
      case 'review': systemInstruction = `You are a strict Hiring Manager (${language}). I attached my CV. Roast it constructively. Point out formatting errors, weak verbs, or missing metrics.`; break;
      case 'cover': systemInstruction = `You are a Cover Letter Specialist (${language}). Write a compelling hook based on the attached job description and user details.`; break;
      default: systemInstruction = `You are a helpful Career Assistant (${language}).`;
    }

    // 3. Prepare Payload
    const finalPrompt = `User Query: ${text}\n\n${extractedTextContext}`;
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: finalPrompt }];

    imagesToSend.forEach((img) => {
      userContent.push({ type: "image_url", image_url: { url: img } });
    });

    // 4. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userContent },
      ],
    });

    // 5. Stream Response
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) controller.enqueue(new TextEncoder().encode(content));
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