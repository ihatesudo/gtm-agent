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
  execute: async ({ inputData, mastra, runId }) => {
    const director = mastra?.getAgentById('director');
    if (!director) {
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
    }

    const prompt = `Create a customized go-to-market campaign plan based on the following parameters:
Goal: ${inputData.goal}
Product Name: ${inputData.product}
Ideal Customer Profile (ICP): ${inputData.icp}
Target Market: ${inputData.market}
Budget: ${inputData.budget}
Timeline: ${inputData.timeline}

Please generate at least 3 tactical campaign phases. Each phase must contain a name, description, duration, and list of specific tasks.`;

    try {
      const response = await director.generate(prompt, {
        structuredOutput: {
          schema: z.object({
            phases: z.array(z.object({
              name: z.string(),
              description: z.string(),
              duration: z.string(),
              tasks: z.array(z.string()),
            })),
            campaignSummary: z.string(),
          }),
        },
        memory: {
          resource: 'gtm-campaign',
          thread: runId || `campaign-run-${Date.now()}`,
        },
      });
      if (response.object) {
        return response.object;
      }
      throw new Error("No structured output returned from director agent.");
    } catch (err) {
      console.warn("Failed dynamic campaign planning, using fallback:", err);
      const phases = [
        {
          name: 'research',
          description: 'Market research, competitor analysis, and audience insights',
          duration: 'Week 1-2',
          tasks: [
            'Conduct competitor keyword and content analysis',
            'Analyze target audience behavior and channels',
          ],
        },
      ];
      return {
        phases,
        campaignSummary: `Campaign Plan: ${inputData.goal}\nProduct: ${inputData.product}`,
      };
    }
  },
});

const approvalStep = createStep({
  id: 'approval-step',
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
    approved: z.boolean(),
    feedback: z.string(),
  }),
  resumeSchema: z.object({
    approved: z.boolean().describe('Set to true to approve the campaign plan, false to reject.'),
    feedback: z.string().optional().describe('Strategic feedback or reason for rejection.'),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend();
    }
    return {
      approved: resumeData.approved,
      feedback: resumeData.feedback || '',
    };
  },
});

const executePhaseStep = createStep({
  id: 'execute-phase',
  inputSchema: z.object({
    approved: z.boolean(),
    feedback: z.string(),
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
  execute: async ({ inputData, mastra, runId, getStepResult }) => {
    if (!inputData.approved) {
      return {
        phaseResults: [],
        executionNotes: `Campaign execution skipped. Reason: Plan rejected by user. Feedback: "${inputData.feedback}"`,
        allComplete: false,
      };
    }

    const plan = getStepResult('plan-campaign') as {
      phases: Array<{ name: string; description: string; duration: string; tasks: string[] }>;
      campaignSummary: string;
    };

    const director = mastra?.getAgentById('director');
    if (!director) {
      const phaseResults = plan.phases.map(p => ({
        name: p.name,
        status: 'ready',
        completedTasks: [] as string[],
      }));

      return {
        phaseResults,
        executionNotes: `Campaign has ${plan.phases.length} phases planned. Starting execution.`,
        allComplete: false,
      };
    }

    const prompt = `Simulate/run the execution of the following campaign phases:
${JSON.stringify(plan.phases, null, 2)}

For each phase, determine if it can be marked as complete, in_progress, or ready based on normal GTM timelines. Provide lists of completed tasks, a summary of actions taken, and note if the entire campaign execution is finished.

Campaign Summary context:
${plan.campaignSummary}`;

    try {
      const response = await director.generate(prompt, {
        structuredOutput: {
          schema: z.object({
            phaseResults: z.array(z.object({
              name: z.string(),
              status: z.enum(['complete', 'in_progress', 'ready']),
              completedTasks: z.array(z.string()),
            })),
            executionNotes: z.string(),
            allComplete: z.boolean(),
          }),
        },
        memory: {
          resource: 'gtm-campaign',
          thread: runId || `campaign-run-${Date.now()}`,
        },
      });
      if (response.object) {
        return response.object;
      }
      throw new Error("No structured output returned from execution step.");
    } catch (err) {
      console.warn("Failed dynamic execution simulation, using fallback:", err);
      return {
        phaseResults: plan.phases.map(p => ({
          name: p.name,
          status: 'in_progress',
          completedTasks: p.tasks.slice(0, 1),
        })),
        executionNotes: 'Execution simulation started. Some tasks in progress.',
        allComplete: false,
      };
    }
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
  execute: async ({ inputData, mastra, runId }) => {
    if (inputData.phaseResults.length === 0) {
      return {
        review: `## Campaign Review\nExecution was skipped because the campaign GTM plan was rejected by the user.`,
        recommendations: ['Revise campaign goal, target audience, or budget parameters and restart workflow.'],
        isComplete: false,
      };
    }

    const director = mastra?.getAgentById('director');
    if (!director) {
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
    }

    const prompt = `Perform a comprehensive campaign post-launch review based on the following execution results:
Execution Notes: ${inputData.executionNotes}
Phase Results: ${JSON.stringify(inputData.phaseResults, null, 2)}
All Completed: ${inputData.allComplete}

Please output a detailed evaluation review (in markdown), a list of next-step optimization recommendations, and a boolean status indicating if the review is finished.`;

    try {
      const response = await director.generate(prompt, {
        structuredOutput: {
          schema: z.object({
            review: z.string(),
            recommendations: z.array(z.string()),
            isComplete: z.boolean(),
          }),
        },
        memory: {
          resource: 'gtm-campaign',
          thread: runId || `campaign-run-${Date.now()}`,
        },
      });
      if (response.object) {
        return response.object;
      }
      throw new Error("No structured output returned from review step.");
    } catch (err) {
      console.warn("Failed dynamic review, using fallback:", err);
      return {
        review: `## Campaign Review\nSimulation notes: ${inputData.executionNotes}`,
        recommendations: ['Perform manual campaign audit'],
        isComplete: inputData.allComplete,
      };
    }
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
  .then(approvalStep)
  .then(executePhaseStep)
  .then(reviewStep)
  .commit();
