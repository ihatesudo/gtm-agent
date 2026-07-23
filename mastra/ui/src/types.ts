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
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}
