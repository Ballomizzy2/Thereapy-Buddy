import OpenAI from "openai";

export type ProviderModel =
  | { provider: "openai"; model: string }
  | { provider: "openai"; model: "gpt-4o-mini" | "gpt-4o" | "gpt-4.1-mini" };

export type WrapperOptions = {
  apiKey?: string;
  model?: ProviderModel["model"];
  temperature?: number;
};

export class GptWrapper {
  private client: OpenAI;
  private model: string;
  private temperature: number;

  constructor(opts: WrapperOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
    this.client = new OpenAI({ apiKey });
    this.model = opts.model ?? "gpt-4o-mini";
    this.temperature = opts.temperature ?? 0.8;
  }

  async streamChat(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
    return this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      messages,
      stream: true,
    });
  }
}


