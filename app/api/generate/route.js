import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, apiKey, additionalInstructions } = body;

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

        // 시스템 메시지에 추가 지침 포함 (AI가 더 엄격하게 따름)
        let systemMessage = "You are a helpful assistant for Korean teachers. You help write student evaluations for school records.";

        // 동적 모델 선택: 추가 지침이 있으면 GPT-4o, 없으면 GPT-4o-mini (비용 절감)
        const hasAdditionalInstructions = additionalInstructions && additionalInstructions.trim();
        const model = hasAdditionalInstructions ? "gpt-4o" : "gpt-4o-mini";

        if (hasAdditionalInstructions) {
            systemMessage += `\n\n【CRITICAL INSTRUCTION - MUST FOLLOW】\nThe user has specified the following special instruction that you MUST follow strictly. This instruction overrides all other rules:\n→ "${additionalInstructions}"\n\nYou MUST follow this instruction exactly. Failure to do so will invalidate the response.`;
        }

        console.log(`[API] 모델: ${model} | 추가 지침: ${hasAdditionalInstructions ? '있음' : '없음'}`);

        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemMessage },
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
