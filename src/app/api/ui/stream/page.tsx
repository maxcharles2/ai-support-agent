"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useState, useRef, useMemo } from "react";
import { MODELS } from "@/lib/models";

interface EvaluationResult {
  score: number;
  strengths: string;
  weaknesses: string;
  summary: string;
}

type EvalState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: EvaluationResult }
  | { status: "error"; message: string };

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export default function ChatStreamPage() {
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [inputValue, setInputValue] = useState("");
  const [evaluations, setEvaluations] = useState<Record<string, EvalState>>({});

  // Keep a ref so the transport body callback always sees the current modelId
  const modelIdRef = useRef(modelId);
  modelIdRef.current = modelId;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/stream",
        body: () => ({ modelId: modelIdRef.current }),
      }),
    [],
  );

  const { messages, sendMessage, stop, status, error } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  }

  async function evaluate(messageId: string, prompt: string, response: string) {
    setEvaluations((prev) => ({ ...prev, [messageId]: { status: "loading" } }));
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, response, modelId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: EvaluationResult = await res.json();
      setEvaluations((prev) => ({
        ...prev,
        [messageId]: { status: "done", result },
      }));
    } catch (err) {
      setEvaluations((prev) => ({
        ...prev,
        [messageId]: {
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        },
      }));
    }
  }

  return (
    <div className="flex flex-col w-full max-w-2xl py-8 pb-32 mx-auto stretch">
      {/* Model selector */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
          Model
        </label>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="flex-1 p-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
          {error.message}
        </div>
      )}

      {/* Message list */}
      <div className="flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-400 dark:text-zinc-500 mt-16 text-sm">
            Start a conversation below.
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const evalState: EvalState =
            evaluations[message.id] ?? { status: "idle" };
          const responseText = getMessageText(message);

          // Find the user prompt that preceded this assistant message
          const precedingUserMessage = !isUser
            ? messages.slice(0, index).findLast((m) => m.role === "user")
            : null;
          const promptText = precedingUserMessage
            ? getMessageText(precedingUserMessage)
            : "";

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    isUser
                      ? "bg-blue-500 text-white rounded-br-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  {responseText}
                </div>

                {/* Evaluate button and result for assistant messages */}
                {!isUser && responseText && (
                  <div className="mt-2 ml-1">
                    {evalState.status === "idle" && (
                      <button
                        onClick={() =>
                          evaluate(message.id, promptText, responseText)
                        }
                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 transition-colors"
                      >
                        Evaluate
                      </button>
                    )}

                    {evalState.status === "loading" && (
                      <span className="text-xs text-zinc-400 italic">
                        Evaluating…
                      </span>
                    )}

                    {evalState.status === "error" && (
                      <span className="text-xs text-red-400">
                        Error: {evalState.message}
                      </span>
                    )}

                    {evalState.status === "done" && (
                      <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                            Score
                          </span>
                          <span
                            className={`font-bold text-base ${
                              evalState.result.score >= 8
                                ? "text-green-500"
                                : evalState.result.score >= 5
                                  ? "text-yellow-500"
                                  : "text-red-500"
                            }`}
                          >
                            {evalState.result.score}/10
                          </span>
                          <span className="text-zinc-500 dark:text-zinc-400">
                            {evalState.result.summary}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            Strengths:{" "}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {evalState.result.strengths}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-orange-500 dark:text-orange-400">
                            Weaknesses:{" "}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">
                            {evalState.result.weaknesses}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator while waiting for first assistant token */}
        {isLoading &&
          (messages.length === 0 ||
            messages[messages.length - 1]?.role !== "assistant") && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-400">
                <span className="animate-pulse">Thinking…</span>
              </div>
            </div>
          )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 w-full max-w-2xl mx-auto left-0 right-0 p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-lg"
      >
        <div className="flex gap-2">
          <input
            className="flex-1 dark:bg-zinc-800 p-2 border border-zinc-300 dark:border-zinc-700 rounded shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Message…"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              disabled={!inputValue.trim()}
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
