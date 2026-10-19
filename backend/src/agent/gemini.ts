import { GoogleGenAI, type Content, type Part } from '@google/genai';
import { ProviderError, type Conversation, type ModelProvider, type ModelTurn, type ToolResultMessage, type ToolSpec, type ChatTurn } from './provider';

/** Gemini function-calling adapter. The SDK returns proposed calls; our code executes them. */
export class GeminiProvider implements ModelProvider {
  readonly name = 'gemini';
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly modelId: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  start(input: { system: string; history: ChatTurn[]; message: string; tools: ToolSpec[] }): Conversation {
    const contents: Content[] = [
      ...input.history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: input.message }] },
    ];
    const functionDeclarations = input.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters }));
    return {
      next: async (toolResults: ToolResultMessage[] | null, signal: AbortSignal): Promise<ModelTurn> => {
        if (toolResults?.length) {
          contents.push({
            role: 'user',
            parts: toolResults.map((r) => ({
              functionResponse: { id: r.id, name: r.name, response: { output: r.output } },
            })) as Part[],
          });
        }
        let res;
        try {
          res = await this.ai.models.generateContent({
            model: this.modelId,
            contents,
            config: {
              systemInstruction: input.system,
              tools: [{ functionDeclarations }],
              temperature: 0.2,
              maxOutputTokens: 1024,
              automaticFunctionCalling: { disable: true },
              abortSignal: signal,
            },
          });
        } catch (e) {
          throw new ProviderError(e instanceof Error ? e.message.slice(0, 300) : 'Provider request failed');
        }
        const content = res.candidates?.[0]?.content;
        if (!content) throw new ProviderError(`Model returned no content (finish reason: ${res.candidates?.[0]?.finishReason ?? 'unknown'}).`);
        // Keep the model's own parts (including any thought signatures) so the next turn is valid.
        contents.push({ role: 'model', parts: content.parts ?? [] });
        const parts = content.parts ?? [];
        const text = parts
          .filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('')
          .trim();
        const calls = parts.filter((p) => p.functionCall?.name).map((p) => ({ id: p.functionCall!.id, name: p.functionCall!.name!, args: p.functionCall!.args ?? {} }));
        return { text, calls };
      },
    };
  }
}
