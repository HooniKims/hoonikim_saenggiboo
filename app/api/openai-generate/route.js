import { getMaxTokensForTargetChars } from "../../../utils/textProcessor.js";
import { DEFAULT_OPENAI_MODEL } from "../../../utils/openAIFetch.js";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function getLetterSystemMessage() {
    return `학기말 가정통신문 작성 전문가. 반드시 지킬 규칙:
1. 최종 출력은 학부모에게 전달할 가정통신문 본문 한 문단만 작성
2. 편지 인사말, 제목, 번호, 분석, 설명, 검증 결과를 출력하지 않음
3. 경어체 문장으로 작성하고 마침표로 끝냄
4. 학교생활을 성실하게 수행한 내용은 과거 경어체(~했습니다, ~였습니다, ~돋보였습니다)로 작성
5. 방학 조언은 권유형 경어체(~바랍니다, ~주시기 바랍니다)로 작성
6. 입력된 키워드는 방학 조언 영역으로 사용하고 관찰 사실처럼 꾸며 쓰지 않음
7. 입력되지 않은 구체적인 활동, 실험, 탐구 주제, 수행 장면은 지어내지 않음
8. 학업 계획, 건강한 생활 리듬, 친구와의 배려 있는 관계, 가족과의 대화나 지지 중 최소 세 가지 이상을 반드시 반영
9. 키워드를 쉼표 목록처럼 나열하지 말고 하나의 흐름으로 연결
10. 추가 정보를 요청하지 말고 입력된 키워드만으로 완성
11. '마지막으로', '끝으로', '마무리하며', '덧붙여', '추가로' 같은 마무리 접속어를 사용하지 않음
12. 오직 가정통신문 본문 텍스트만 출력`;
}

function buildSystemMessage(additionalInstructions, outputType = "record") {
    let systemMessage = outputType === "letter"
        ? getLetterSystemMessage()
        : "선생님을 돕는 전문가로서 학생들의 학교생활기록부와 가정통신문 작성을 도와줍니다.";
    if (additionalInstructions) {
        systemMessage += `\n\n【최우선 지침】\n아래 사용자 추가 지침은 기본 작성 규칙보다 우선합니다. 충돌 시 사용자 추가 지침을 우선 적용하세요.\n${additionalInstructions}`;
    }
    return systemMessage;
}

function buildUserMessage(prompt, additionalInstructions) {
    if (!additionalInstructions?.trim()) return prompt;
    const instruction = additionalInstructions.trim();
    return `[최우선 규칙] 다음 사용자 추가 지침을 반드시 지켜서 작성하라: ${instruction}

${prompt}

[다시 한번 강조] 위 본문 작성 시 반드시 적용할 사용자 추가 지침: ${instruction}`;
}

function extractContent(data) {
    if (typeof data?.output_text === "string") {
        return data.output_text.trim();
    }
    if (Array.isArray(data?.output)) {
        return data.output
            .flatMap((item) => item.content || [])
            .map((part) => part.text || "")
            .join("")
            .trim();
    }
    const content = data?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) {
        return content.map((part) => part.text || "").join("").trim();
    }
    return (content || "").trim();
}

function getOpenAIMaxCompletionTokens(targetChars) {
    const baseTokens = getMaxTokensForTargetChars(targetChars);
    return Math.max(4096, Math.min(8192, baseTokens * 4));
}

async function callOpenAI({ apiKey, prompt, additionalInstructions, targetChars, model, outputType }) {
    const maxTokens = getOpenAIMaxCompletionTokens(targetChars);
    const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: buildSystemMessage(additionalInstructions, outputType) },
                { role: "user", content: buildUserMessage(prompt, additionalInstructions) },
            ],
            max_completion_tokens: maxTokens,
            reasoning_effort: "minimal",
        }),
    });

    const rawText = await response.text();
    let data = {};
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {
        data = { error: { message: rawText } };
    }

    return { response, data };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { prompt, additionalInstructions, apiKey, targetChars, outputType = "record" } = body;

        if (!apiKey?.trim()) {
            return Response.json({ error: "OpenAI API key가 필요합니다." }, { status: 400 });
        }
        if (!prompt?.trim()) {
            return Response.json({ error: "생성할 프롬프트가 비어 있습니다." }, { status: 400 });
        }

        let { response, data } = await callOpenAI({
            apiKey: apiKey.trim(),
            prompt,
            additionalInstructions,
            targetChars,
            model: DEFAULT_OPENAI_MODEL,
            outputType,
        });

        if (response.ok && !extractContent(data)) {
            const retry = await callOpenAI({
                apiKey: apiKey.trim(),
                prompt: `${prompt}\n\n[분량 보정] 이전 응답에서 표시 가능한 본문이 생성되지 않았습니다. 추론을 짧게 하고, 본문 텍스트만 바로 출력하세요.`,
                additionalInstructions,
                targetChars: Math.ceil((Number(targetChars) || 490) * 1.2),
                model: DEFAULT_OPENAI_MODEL,
                outputType,
            });
            response = retry.response;
            data = retry.data;
        }

        if (!response.ok) {
            const message = data?.error?.message || "OpenAI API 요청에 실패했습니다.";
            return Response.json({ error: `OpenAI API 오류 (${response.status}): ${message}` }, { status: response.status });
        }

        const content = extractContent(data);
        if (!content) {
            const finishReason = data?.choices?.[0]?.finish_reason;
            return Response.json({
                error: `OpenAI API 응답에서 생성 텍스트를 찾지 못했습니다.${finishReason ? ` finish_reason=${finishReason}` : ""}`,
            }, { status: 502 });
        }

        return Response.json({ result: content, model: DEFAULT_OPENAI_MODEL });
    } catch (error) {
        return Response.json({ error: `서버 오류: ${error.message}` }, { status: 500 });
    }
}
