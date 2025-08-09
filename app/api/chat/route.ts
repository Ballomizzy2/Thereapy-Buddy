import { GptWrapper } from "@/lib/gpt";

type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
};

const systemPrompt = `You are "Therapy Buddy", a supportive, compassionate, voice-based CBT-informed companion.
- You are not a licensed therapist. Provide general emotional support and coping strategies.
- Encourage reflection, name emotions, validate feelings, and offer gentle, practical suggestions (CBT/DBT/ACT-inspired).
- Keep responses concise, warm, and spoken-friendly (short sentences, natural cadence).
- Avoid diagnoses or medical advice. If there is risk of harm, advise contacting local emergency services or a trusted person.
`;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      "Server configuration error: missing OPENAI_API_KEY.",
      { status: 500 }
    );
  }

  const wrapper = new GptWrapper({ apiKey });

  const body = await req.json().catch(() => ({}));
  const userMessages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : [];

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...userMessages.filter((m) => m.role === "user" || m.role === "assistant"),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      (async () => {
        try {
          const completion = await wrapper.streamChat(
            messages.map((m) => ({ role: m.role, content: m.content }))
          );

          for await (const chunk of completion) {
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(encoder.encode(`\n[Error] ${message}`));
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}


