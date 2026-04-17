import * as ai from "ai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import { traceable } from "langsmith/traceable";
import { resolveModel } from "@/lib/models";

const { streamText, convertToModelMessages } = wrapAISDK(ai);

export async function POST(req: Request) {
    try {
        const { messages, modelId } = await req.json();

        let runId: string | undefined;

        const runChatStream = traceable(
            async () => {
                return streamText({
                    model: resolveModel(modelId),
                    system: "You are a helpful AI support assistant. Answer questions clearly and concisely.",
                    messages: await convertToModelMessages(messages),
                });
            },
            {
                name: "chat-stream",
                run_type: "chain",
                on_start: (runTree) => {
                    runId = runTree?.id;
                },
            }
        );

        const result = await runChatStream();
        const streamResponse = result.toUIMessageStreamResponse();

        const headers = new Headers(streamResponse.headers);
        if (runId) {
            headers.set("x-langsmith-run-id", runId);
        }

        return new Response(streamResponse.body, {
            status: streamResponse.status,
            headers,
        });
    } catch (error) {
        console.error("Error: error streaming text with LangSmith tracing", error);
        return Response.json({ error: "Failed to stream text" }, { status: 500 });
    }
}
