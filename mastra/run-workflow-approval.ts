import { mastra } from './src/mastra/index.js';

async function main() {
  const workflow = mastra.getWorkflow('campaignWorkflow');
  if (!workflow) {
    console.error('Workflow campaignWorkflow not found');
    process.exit(1);
  }

  console.log('Creating execution run for campaign-workflow...');
  const run = await workflow.createRun();

  console.log('Starting campaign workflow (will suspend for user approval)...');
  
  // Start the workflow execution in the background
  const runPromise = run.startAsync({
    inputData: {
      goal: 'Launch B2B SaaS in Europe with 10k budget in 90 days',
      product: 'MemoMind - AI note-taking app',
      icp: 'Product managers, developers, and consultants',
      market: 'Europe (UK, Germany, France)',
      budget: '€10,000 EUR',
      timeline: '90 days',
    },
  });

  // Give the workflow 3 seconds to execute the planning step and suspend
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Retrieve current state to show plan before approval
  const midState = await workflow.getWorkflowRunById(run.runId);
  console.log('\n--- [WORKFLOW SUSPENDED] ---');
  console.log(`Run ID: ${run.runId}`);
  console.log(`Status: ${midState?.status?.toUpperCase()}`);
  
  const plan = midState?.steps['plan-campaign']?.output;
  if (plan) {
    console.log('\nGenerated Campaign Plan:');
    console.log(plan.campaignSummary);
  } else {
    console.log('No plan generated yet.');
  }

  console.log('\nSimulating user approval from webhook/UI...');
  console.log('Resuming workflow with approved = true...');
  
  await run.resume({
    step: 'approval-step',
    resumeData: {
      approved: true,
      feedback: 'The target markets in Germany/UK look perfect. Proceed with execution.',
    },
  });

  console.log('Workflow resumed! Awaiting final output...');
  
  // Wait for the workflow to completely finish
  await runPromise;

  // Retrieve the final run state
  const finalState = await workflow.getWorkflowRunById(run.runId);
  if (!finalState) {
    throw new Error('Could not retrieve final state');
  }

  console.log('\n==================================================');
  console.log('      CAMPAIGN APPROVAL & EXECUTION REPORT        ');
  console.log('==================================================');
  console.log(`Workflow:  ${finalState.workflowName}`);
  console.log(`Run ID:    ${finalState.runId}`);
  console.log(`Status:    ${finalState.status.toUpperCase()}`);
  console.log('--------------------------------------------------');

  const approval = finalState.steps['approval-step']?.output;
  const execution = finalState.steps['execute-phase']?.output;
  const review = finalState.steps['review-campaign']?.output;

  if (approval) {
    console.log('\n--- USER APPROVAL DECISION ---');
    console.log(`Approved:  ${approval.approved}`);
    console.log(`Feedback:  "${approval.feedback}"`);
  }

  if (execution) {
    console.log('\n--- SIMULATED EXECUTION NOTES ---');
    console.log(execution.executionNotes);
    console.log('\nPhase Execution status:');
    execution.phaseResults.forEach((pr: any) => {
      console.log(`• ${pr.name}: ${pr.status.toUpperCase()}`);
    });
  }

  if (review) {
    console.log('\n--- POST-CAMPAIGN REVIEW & ADVISORY ---');
    console.log(review.review);
    console.log('\nOptimization Recommendations:');
    review.recommendations.forEach((r: string, idx: number) => {
      console.log(`${idx + 1}. ${r}`);
    });
  }
  console.log('==================================================\n');
}

main().catch(console.error);
