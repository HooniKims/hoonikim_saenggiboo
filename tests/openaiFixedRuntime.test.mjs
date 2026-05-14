import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readProjectFile(path) {
    const fullPath = join(root, path);
    assert.equal(existsSync(fullPath), true, `${path} should exist`);
    return readFileSync(fullPath, "utf8");
}

test("OpenAI controls do not expose AI model selection", () => {
    const control = readProjectFile("components/OpenAIKeyControl.js");
    const keyHook = readProjectFile("utils/openAIKey.js");

    assert.doesNotMatch(control, /<select\b/);
    assert.doesNotMatch(control, /OPENAI_MODELS|selectedOpenAIModel|setSelectedOpenAIModel/);
    assert.doesNotMatch(keyHook, /OPENAI_MODEL_STORAGE_KEY|selectedOpenAIModel|setSelectedOpenAIModel/);
    assert.match(control, /OPENAI_MODEL_LABEL|GPT-5 mini/);
});

test("generation pages use only the fixed OpenAI generation path", () => {
    const pages = [
        "app/gwasetuk/page.js",
        "app/club/page.js",
        "app/behavior/page.js",
        "app/letter/page.js",
    ];

    for (const pagePath of pages) {
        const source = readProjectFile(pagePath);
        assert.match(source, /fetchOpenAICompletion/, `${pagePath} should call OpenAI`);
        assert.doesNotMatch(source, /fetchStream|fetchNvidiaCompletion|AVAILABLE_MODELS|selectedModel|setSelectedModel|isNvidiaSelected|getModelOptionLabel/);
        assert.doesNotMatch(source, /로컬 AI 모델|NVIDIA NIM|NVIDIA Cloud|로컬 LLM/);
        assert.match(source, /appliedOpenAIKey/, `${pagePath} should require an applied API key`);
    }
});

test("OpenAI API routes force gpt-5-mini without fallback model switching", () => {
    const openAIRoute = readProjectFile("app/api/openai-generate/route.js");
    const legacyRoute = readProjectFile("app/api/generate/route.js");
    const openAIFetch = readProjectFile("utils/openAIFetch.js");

    assert.match(openAIFetch, /DEFAULT_OPENAI_MODEL\s*=\s*"gpt-5-mini"/);
    assert.doesNotMatch(openAIFetch, /OPENAI_MODELS/);

    assert.match(openAIRoute, /DEFAULT_OPENAI_MODEL/);
    assert.doesNotMatch(openAIRoute, /OPENAI_MODELS|getFallbackModel|model_not_found/);
    assert.doesNotMatch(openAIRoute, /model\s*:\s*model|model\s*:\s*requestedModel/);

    assert.match(legacyRoute, /DEFAULT_OPENAI_MODEL/);
    assert.doesNotMatch(legacyRoute, /DEFAULT_LOCAL_MODEL|LOCAL_LLM|lm\.alluser\.site|api\.alluser\.site/);
});

test("obsolete local and NVIDIA generation artifacts are removed", () => {
    const removedPaths = [
        "ollama.md",
        "local-llm-api-guide.md",
        "utils/streamFetch.js",
        "utils/nvidiaFetch.js",
        "app/api/nvidia-generate/route.js",
        "tests/nvidiaFetch.test.mjs",
    ];

    for (const removedPath of removedPaths) {
        assert.equal(existsSync(join(root, removedPath)), false, `${removedPath} should be removed`);
    }
});
