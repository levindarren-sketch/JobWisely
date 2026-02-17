import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { text, mode } = await req.json();
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return Response.json({ result: "API Key missing from .env.local" }, { status: 500 });
    }

    // Force v1 to avoid the 404 Beta error
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: { apiVersion: 'v1' } 
    });

    let prompt = "";
    if (mode === 'hype') {
      prompt = `Rewrite this as 3 professional resume bullet points. Use plain text only. DO NOT use bolding, DO NOT use asterisks (**), and DO NOT use markdown. Start each line with a dash (-). Info: ${text}`;
    } else if (mode === 'resume') {
      prompt = `Write a professional 'Summary' and 'Skills' section for a resume based on this: ${text}. Use plain text only. No asterisks, no bolding, no markdown. Use clear spacing between sections.`;
    } else {
      prompt = `List the top 10 keywords from this job description as a plain list. No bolding or asterisks allowed: ${text}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    return Response.json({ result: response.text });

  } catch (error: unknown) {
    // TypeScript-safe error handling (No 'any'!)
    const message = error instanceof Error ? error.message : "An unknown AI error occurred";
    return Response.json({ result: "AI Crash: " + message }, { status: 500 });
  }
}