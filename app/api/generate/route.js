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

        // 시스템 메시지: 구체적이고 간결한 핵심 규칙 기반
        let systemMessage = `학교생활기록부 작성 전문가. 반드시 지킬 규칙:
1. 명사형 종결어미(~함, ~임, ~음)만 사용 (가정통신문 제외)
2. '학생은', '이 학생은' 등 주어 없이 활동부터 서술
3. 줄바꿈 없이 하나의 문단으로 작성
4. 마지막 문장도 반드시 구체적 활동 서술로 끝냄 (요약/정리/결론 금지)
5. 입력에 없는 활동 지어내기 금지
6. 오직 본문 텍스트만 출력 (메타정보 절대 출력하지 않음)`;

        // 동적 모델 선택: 추가 지침이 있으면 GPT-4o, 없으면 GPT-4o-mini (비용 절감)
        const hasAdditionalInstructions = additionalInstructions && additionalInstructions.trim();
        const model = hasAdditionalInstructions ? "gpt-4o" : "gpt-4o-mini";

        // Sandwich 기법: 추가 지침을 프롬프트 앞뒤에 감싸서 AI가 무시하지 않도록 강화
        let finalPrompt = prompt;
        if (hasAdditionalInstructions) {
            const prefix = `[최우선 규칙] 다음 규칙을 반드시 지켜서 작성하라: ${additionalInstructions}\n\n`;
            const suffix = `\n\n[다시 한번 강조] 위 본문 작성 시 반드시 적용할 규칙: ${additionalInstructions}`;
            finalPrompt = prefix + prompt + suffix;
        }

        console.log(`[API] 모델: ${model} | 추가 지침: ${hasAdditionalInstructions ? '있음' : '없음'}`);

        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: finalPrompt },
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
