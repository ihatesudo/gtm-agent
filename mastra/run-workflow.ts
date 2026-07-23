import { mastra } from './src/mastra/index.js';

async function main() {
  const workflow = mastra.getWorkflow('campaignWorkflow');
  if (!workflow) {
    console.error('Workflow campaignWorkflow not found');
    process.exit(1);
  }

  console.log('Creating execution run for campaign-workflow...');
  const run = await workflow.createRun();

  console.log('Starting campaign workflow...');
  let runError: any = null;
  try {
    await run.startAsync({
      inputData: {
        goal: 'North America SaaS launch with a $10k budget in 90 days',
        product: 'MemoMind - AI note-taking app',
        icp: 'Knowledge workers, researchers, busy professionals',
        market: 'North America (US & Canada)',
        budget: '$10,000 USD',
        timeline: '90 days',
      },
    });
  } catch (err: any) {
    runError = err;
  }

  // Print the formatted run results from the local run object
  try {
    console.log('\n==================================================');
    console.log('         CAMPAIGN ORCHESTRATION REPORT            ');
    console.log('==================================================');
    console.log(`Workflow:  ${workflow.id}`);
    console.log(`Run ID:    ${run.runId}`);
    console.log(`Status:    ${run.status.toUpperCase()}`);
    console.log('--------------------------------------------------');

    const plan = run.steps['plan-campaign']?.output;
    const execution = run.steps['execute-phase']?.output;
    const review = run.steps['review-campaign']?.output;

    if (plan) {
      console.log('\n--- 1. GENERATED GTM PLAN ---');
      console.log(plan.campaignSummary);
      console.log('\nPhases breakdown:');
      plan.phases.forEach((p: any) => {
        console.log(`• [${p.name.toUpperCase()}] (${p.duration}): ${p.description}`);
        p.tasks.forEach((t: string) => console.log(`   - ${t}`));
      });
    }

    if (execution) {
      console.log('\n--- 2. SIMULATED EXECUTION NOTES ---');
      console.log(execution.executionNotes);
      console.log(`All complete: ${execution.allComplete}`);
      console.log('\nPhase Execution status:');
      execution.phaseResults.forEach((pr: any) => {
        console.log(`• ${pr.name}: ${pr.status.toUpperCase()}`);
        if (pr.completedTasks?.length) {
          console.log(`  Completed: ${pr.completedTasks.join(', ')}`);
        }
      });
    }

    if (review) {
      console.log('\n--- 3. POST-CAMPAIGN REVIEW & ADVISORY ---');
      console.log(review.review);
      console.log('\nOptimization Recommendations:');
      review.recommendations.forEach((r: string, idx: number) => {
        console.log(`${idx + 1}. ${r}`);
      });
      console.log(`\nReview finalized: ${review.isComplete}`);
    }

    if (runError) {
      console.log('\n[!] Note: The workflow run encountered an error (e.g. sandbox offline mode):');
      console.log(runError.message || runError);
    }
    console.log('==================================================\n');

  } catch (err) {
    console.error('Failed to display run state:', err);
  }
}

main().catch(console.error);
