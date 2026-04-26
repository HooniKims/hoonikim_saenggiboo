export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
export const OPENAI_MODEL_LABEL = "GPT-5 mini";

export function getOpenAIModelLabel(modelId) {
    return modelId === DEFAULT_OPENAI_MODEL ? OPENAI_MODEL_LABEL : modelId;
}

export async function fetchOpenAICompletion({ prompt, additionalInstructions, apiKey, targetChars }) {
    if (!apiKey?.trim()) {
        throw new Error("OpenAI API key가 적용되지 않았습니다.");
    }

    const response = await fetch("/api/openai-generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt,
            additionalInstructions,
            apiKey: apiKey.trim(),
            targetChars,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `OpenAI API 오류 (${response.status})`);
    }

    return data.result || "";
}
