export interface Role {
  name: string;
  title: string;
  persona: string;
  coreFocus: string;
  tags: string[];
  orchestrates: string[];
  ownedSkills: string[];
  sharedSkills: string[];
  preferredTools: string[];
  whenToUse: string;
}

export interface Skill {
  name: string;
  description: string;
  version: string;
  body: string;
}

export interface ProviderConfig {
  name: string;
  title: string;
  description: string;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  capabilities: Record<string, boolean>;
  currency: string;
  website: string;
}

export interface AgentEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer' | 'error' | 'done';
  content?: string;
  tool?: string;
  input?: string;
  result?: string;
}

export interface WSMessage {
  type: 'message' | 'set_role' | 'set_skill' | 'list_roles' | 'list_skills' | 'list_providers' | 'session';
  content?: string;
  role?: string;
  skill?: string;
  language?: string;
  provider?: string;
}

export interface Env {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ASSETS_BUCKET: R2Bucket;
}
