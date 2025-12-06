import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, apiKey } = body;

        // Use provided API key or fallback to server env
        const finalApiKey = apiKey || process.env.OPENAI_API_KEY;

        if (!finalApiKey) {
            return NextResponse.json(
                { error: "OpenAI API Key is missing. Please provide it in settings or environment variables." },
                { status: 400 }
            );
        }

        const openai = new OpenAI({
            apiKey: finalApiKey,
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant for Korean teachers." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;

        return NextResponse.json({ result: content });
    } catch (error) {
        console.error("OpenAI API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate response." },
            { status: 500 }
        );
    }
}
