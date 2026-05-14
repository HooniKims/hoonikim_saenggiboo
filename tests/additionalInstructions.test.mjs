import test from "node:test";
import assert from "node:assert/strict";

import { fetchOpenAICompletion } from "../utils/openAIFetch.js";
import { POST } from "../app/api/openai-generate/route.js";

test("fetchOpenAICompletion sends additional instructions to the OpenAI route", async () => {
    let requestBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return Response.json({ result: "자료 조사 과정에서 핵심 정보를 정리하고 발표함." });
    };

    try {
        await fetchOpenAICompletion({
            prompt: "활동 내용을 작성하세요.",
            additionalInstructions: "개인별 수행 내용을 기준으로 작성",
            apiKey: "sk-test",
            targetChars: 100,
        });
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(requestBody.additionalInstructions, "개인별 수행 내용을 기준으로 작성");
});

test("OpenAI route reinforces additional instructions in both system and user messages", async () => {
    let openAIRequestBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        openAIRequestBody = JSON.parse(options.body);
        return Response.json({
            choices: [
                {
                    message: { content: "자료 조사 과정에서 핵심 정보를 정리하고 발표함." },
                },
            ],
        });
    };

    try {
        const response = await POST(new Request("http://localhost/api/openai-generate", {
            method: "POST",
            body: JSON.stringify({
                prompt: "활동 내용을 작성하세요.",
                additionalInstructions: "개인별 수행 내용을 기준으로 작성",
                apiKey: "sk-test",
                targetChars: 100,
            }),
        }));
        assert.equal(response.ok, true);
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.match(openAIRequestBody.messages[0].content, /【최우선 지침】[\s\S]*개인별 수행 내용을 기준으로 작성/);
    assert.match(openAIRequestBody.messages[1].content, /^\[최우선 규칙\].*개인별 수행 내용을 기준으로 작성/s);
    assert.match(openAIRequestBody.messages[1].content, /\[다시 한번 강조\].*개인별 수행 내용을 기준으로 작성$/s);
    assert.equal(openAIRequestBody.reasoning_effort, "minimal");
    assert.equal(openAIRequestBody.max_completion_tokens, 4096);
});

test("OpenAI route retries once when the API returns no visible text", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        if (calls === 1) {
            return Response.json({
                choices: [
                    {
                        message: { content: "" },
                        finish_reason: "length",
                    },
                ],
            });
        }
        return Response.json({
            choices: [
                {
                    message: { content: "자료 조사 과정에서 핵심 정보를 정리하고 발표함." },
                    finish_reason: "stop",
                },
            ],
        });
    };

    try {
        const response = await POST(new Request("http://localhost/api/openai-generate", {
            method: "POST",
            body: JSON.stringify({
                prompt: "활동 내용을 작성하세요.",
                apiKey: "sk-test",
                targetChars: 100,
            }),
        }));
        const data = await response.json();
        assert.equal(response.ok, true);
        assert.equal(data.result, "자료 조사 과정에서 핵심 정보를 정리하고 발표함.");
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(calls, 2);
});
