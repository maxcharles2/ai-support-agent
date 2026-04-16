import { streamText, convertToModelMessages } from "ai";
import { resolveModel } from "@/lib/models";

export async function POST(req: Request) {
    try {
        const { messages, modelId } = await req.json();
        const result = streamText({
            model: resolveModel(modelId),
            system: "You are a helpful AI support assistant. Answer questions clearly and concisely.",
            messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse();
    } catch (error) {
        console.error("Error: error streaming text", error);
        return Response.json({ error: "Failed to stream text" }, { status: 500 });
    }
}