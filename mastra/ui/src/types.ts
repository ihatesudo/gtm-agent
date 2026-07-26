export interface Agent {
  id: string;
  name: string;
  description: string;
}

export interface Thread {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  input: string;
  output?: string;
  status: 'pending' | 'success' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  createdAt: string;
  /** Set to true when this message represents a failed response */
  isError?: boolean;
  /** Any text that streamed before the error occurred */
  partialContent?: string;
  /** Error details for a failed assistant response */
  error?: string;
}
