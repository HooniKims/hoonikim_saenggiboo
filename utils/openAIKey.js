"use client";

import { useEffect, useState } from "react";

const OPENAI_API_KEY_STORAGE_KEY = "hoonikim_openai_api_key";
const OPENAI_API_KEY_EVENT = "hoonikim-openai-api-key-updated";

function readStoredKey() {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
}

function notifyKeyUpdated() {
    window.dispatchEvent(new Event(OPENAI_API_KEY_EVENT));
}

export function maskOpenAIKey(apiKey) {
    if (!apiKey) return "";
    if (apiKey.length <= 12) return "적용됨";
    return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
}

export function useOpenAIKey() {
    const [openAIKeyInput, setOpenAIKeyInput] = useState("");
    const [appliedOpenAIKey, setAppliedOpenAIKey] = useState("");

    useEffect(() => {
        const syncSettings = () => {
            const storedKey = readStoredKey();
            setAppliedOpenAIKey(storedKey);
            setOpenAIKeyInput(storedKey);
        };

        syncSettings();
        window.addEventListener("storage", syncSettings);
        window.addEventListener(OPENAI_API_KEY_EVENT, syncSettings);

        return () => {
            window.removeEventListener("storage", syncSettings);
            window.removeEventListener(OPENAI_API_KEY_EVENT, syncSettings);
        };
    }, []);

    const applyOpenAIKey = () => {
        const trimmedKey = openAIKeyInput.trim();
        if (!trimmedKey) {
            window.localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
            setAppliedOpenAIKey("");
            setOpenAIKeyInput("");
            notifyKeyUpdated();
            return;
        }

        window.localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmedKey);
        setAppliedOpenAIKey(trimmedKey);
        setOpenAIKeyInput(trimmedKey);
        notifyKeyUpdated();
    };

    const clearOpenAIKey = () => {
        window.localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
        setAppliedOpenAIKey("");
        setOpenAIKeyInput("");
        notifyKeyUpdated();
    };

    return {
        openAIKeyInput,
        setOpenAIKeyInput,
        appliedOpenAIKey,
        applyOpenAIKey,
        clearOpenAIKey,
        isOpenAIKeyApplied: Boolean(appliedOpenAIKey),
        maskedOpenAIKey: maskOpenAIKey(appliedOpenAIKey),
    };
}
