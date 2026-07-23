import { mastra } from './src/mastra/index.ts';

const agent = mastra.getAgentById('director');
const response = await agent.generate(
  'Create a 90-day go-to-market plan for an AI note-taking app called MemoMind targeting knowledge workers in North America.',
  {
    maxSteps: 10,
  },
);
console.log(response.text);
