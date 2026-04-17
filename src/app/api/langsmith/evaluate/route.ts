import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { traceable } from "langsmith/traceable";
import { Client } from "langsmith";

const evaluationSchema = z.object({
    score: z.number().min(1).max(10).describe("Overall quality score from 1 (poor) to 10 (excellent)"),
    strengths: z.string().describe("What the response did well"),
    weaknesses: z.string().describe("What the response could have done better"),
    summary: z.string().describe("A concise one-sentence overall assessment"),
});

export async function POST(req: Request) {
    try {
        const { prompt, response, modelId, runId } = await req.json();

        const runEvaluation = traceable(
            async () => {
                const { output } = await generateText({
                    model: openai("gpt-4.1-mini"),
                    output: Output.object({ schema: evaluationSchema }),
                    system:
                        "You are an impartial AI response quality evaluator. " +
                        "Given a user prompt and an AI assistant's response, score the response from 1–10 " +
                        "on relevance, accuracy, completeness, and clarity. " +
                        "Be concise and constructive.",
                    prompt:
                        `User prompt: ${prompt}\n\n` +
                        `AI response (from model ${modelId ?? "unknown"}): ${response}`,
                });
                return output;
            },
            { name: "chat-evaluation", run_type: "chain" }
        );

        const evaluation = await runEvaluation();

        let langsmithUrl: string | undefined;

        if (runId) {
            const client = new Client();

            await client.createFeedback(runId, "quality", {
                score: evaluation.score / 10,
                comment: `${evaluation.summary}\n\nStrengths: ${evaluation.strengths}\nWeaknesses: ${evaluation.weaknesses}`,
            });

            try {
                langsmithUrl = await client.getRunUrl({ runId });
            } catch {
                // URL construction is best-effort; don't fail the request
            }
        }

        return Response.json({ ...evaluation, langsmithUrl });
    } catch (error) {
        console.error("Error: error evaluating response with LangSmith tracing", error);
        return Response.json({ error: "Failed to evaluate response" }, { status: 500 });
    }
}
