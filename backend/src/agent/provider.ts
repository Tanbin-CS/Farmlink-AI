export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** Plain JSON Schema object for the arguments. */
  parameters: Record<string, unknown>;
}

export interface ProposedCall {
  id?: string;
  name: string;
  args: unknown;
}

export interface ModelTurn {
  text: string;
  calls: ProposedCall[];
}

export interface ToolResultMessage {
  id?: string;
  name: string;
  output: unknown;
}

export interface Conversation {
  /** One provider round trip. Pass the results of the previous turn's calls, if any. */
  next(toolResults: ToolResultMessage[] | null, signal: AbortSignal): Promise<ModelTurn>;
}

/** Provider adapter: the model ID and vendor can change without touching the financial tools. */
export interface ModelProvider {
  readonly name: string;
  readonly modelId: string;
  start(input: { system: string; history: ChatTurn[]; message: string; tools: ToolSpec[] }): Conversation;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
