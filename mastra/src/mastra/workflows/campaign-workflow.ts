import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const planStep = createStep({
  id: 'plan-campaign',
  inputSchema: z.object({
    goal: z.string(),
    product: z.string(),
    icp: z.string(),
    market: z.string(),
    budget: z.string(),
    timeline: z.string(),
  }),
  outputSchema: z.object({
    phases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      duration: z.string(),
      tasks: z.array(z.string()),
    })),
    campaignSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const phases = [
      {
        name: 'research',
        description: 'Market research, competitor analysis, and audience insights',
        duration: 'Week 1-2',
        tasks: [
          'Conduct competitor keyword and content analysis',
          'Analyze target audience behavior and channels',
          'Identify market gaps and positioning opportunities',
          'Research market trends and seasonality',
        ],
      },
      {
        name: 'strategy',
        description: 'Campaign strategy, channel mix, and creative direction',
        duration: 'Week 3-4',
        tasks: [
          'Define channel mix and budget allocation',
          'Create campaign messaging and creative brief',
          'Set up tracking and attribution framework',
          'Build campaign calendar and milestone plan',
        ],
      },
      {
        name: 'execute',
        description: 'Campaign launch and active management',
        duration: 'Week 5-12',
        tasks: [
          'Launch campaigns across selected channels',
          'Monitor performance and adjust bids/budgets',
          'A/B test creative and landing pages',
          'Scale winning placements and audiences',
        ],
      },
      {
        name: 'measure',
        description: 'Performance analysis and reporting',
        duration: 'Week 13-14',
        tasks: [
          'Compile campaign performance data',
          'Analyze channel-level ROAS and CAC',
          'Calculate overall campaign ROI',
          'Document learnings and insights',
        ],
      },
      {
        name: 'optimize',
        description: 'Optimization recommendations and next-steps plan',
        duration: 'Week 15-16',
        tasks: [
          'Identify optimization opportunities',
          'Create phase 2 campaign plan',
          'Document playbook for future campaigns',
          'Present final results and recommendations',
        ],
      },
    ];

    const campaignSummary = [
      `## Campaign Plan: ${inputData.goal}`,
      `Product: ${inputData.product}`,
      `ICP: ${inputData.icp}`,
      `Market: ${inputData.market}`,
      `Budget: ${inputData.budget}`,
      `Timeline: ${inputData.timeline}`,
      '',
      '### Phases',
      ...phases.map(p => `**${p.name}** (${p.duration}): ${p.description}`),
    ].join('\n');

    return { phases, campaignSummary };
  },
});

const executePhaseStep = createStep({
  id: 'execute-phase',
  inputSchema: z.object({
    phases: z.array(z.object({
      name: z.string(),
      description: z.string(),
      duration: z.string(),
      tasks: z.array(z.string()),
    })),
    campaignSummary: z.string(),
  }),
  outputSchema: z.object({
    phaseResults: z.array(z.object({
      name: z.string(),
      status: z.string(),
      completedTasks: z.array(z.string()),
    })),
    executionNotes: z.string(),
    allComplete: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const phaseResults = inputData.phases.map(p => ({
      name: p.name,
      status: 'ready',
      completedTasks: [] as string[],
    }));

    return {
      phaseResults,
      executionNotes: `Campaign has ${inputData.phases.length} phases planned. Starting execution.`,
      allComplete: false,
    };
  },
});

const reviewStep = createStep({
  id: 'review-campaign',
  inputSchema: z.object({
    phaseResults: z.array(z.object({
      name: z.string(),
      status: z.string(),
      completedTasks: z.array(z.string()),
    })),
    executionNotes: z.string(),
    allComplete: z.boolean(),
  }),
  outputSchema: z.object({
    review: z.string(),
    recommendations: z.array(z.string()),
    isComplete: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const completedPhases = inputData.phaseResults
      .filter(p => p.status === 'complete')
      .map(p => p.name);

    const review = [
      '## Campaign Review',
      `Phases planned: ${inputData.phaseResults.length}`,
      `Phases completed: ${completedPhases.length}`,
      `All phases complete: ${inputData.allComplete}`,
      '',
      '### Execution Notes',
      inputData.executionNotes,
    ].join('\n');

    return {
      review,
      recommendations: [
        'Review channel performance data against KPIs',
        'Prepare phase 2 optimization recommendations',
        'Document learnings for future campaigns',
        'Schedule stakeholder presentation',
      ],
      isComplete: inputData.allComplete,
    };
  },
});

export const campaignWorkflow = createWorkflow({
  id: 'campaign-workflow',
  inputSchema: z.object({
    goal: z.string(),
    product: z.string(),
    icp: z.string(),
    market: z.string(),
    budget: z.string(),
    timeline: z.string(),
  }),
  outputSchema: z.object({
    plan: z.object({
      phases: z.array(z.object({
        name: z.string(),
        description: z.string(),
        duration: z.string(),
        tasks: z.array(z.string()),
      })),
      campaignSummary: z.string(),
    }),
    execution: z.object({
      phaseResults: z.array(z.object({
        name: z.string(),
        status: z.string(),
        completedTasks: z.array(z.string()),
      })),
      executionNotes: z.string(),
      allComplete: z.boolean(),
    }),
    review: z.object({
      review: z.string(),
      recommendations: z.array(z.string()),
      isComplete: z.boolean(),
    }),
    status: z.string(),
  }),
})
  .then(planStep)
  .then(executePhaseStep)
  .then(reviewStep)
  .commit();
