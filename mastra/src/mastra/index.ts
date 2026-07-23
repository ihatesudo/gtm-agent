import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { directorAgent } from './agents/director.js';
import { ALL_SPECIALIST_AGENTS } from './agents/specialists.js';
import { campaignWorkflow } from './workflows/campaign-workflow.js';
import { ALL_GTM_TOOLS } from './tools/gtm-tools.js';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:mastra.db',
});

export const mastra = new Mastra({
  storage,
  agents: {
    directorAgent,
    ...ALL_SPECIALIST_AGENTS,
  },
  tools: ALL_GTM_TOOLS,
  workflows: {
    campaignWorkflow,
  },
});
