import fs from 'node:fs';
import path from 'node:path';
import { sanitizeTextForCloud } from './agent/cloudPrivacyFilter';
import { inferPromptMode } from './budgetManager';
import { proposePersonaChange } from './personas';
import { routeAndRankMemories } from './memory';

export interface EvaluationReportItem {
  taskId: string;
  name: string;
  category: string;
  passed: boolean;
  score: number; // 0.0 to 1.0
  details: string;
}

export interface EvaluationSummary {
  totalTasks: number;
  passedTasks: number;
  overallScore: number; // Percentage
  items: EvaluationReportItem[];
}

/**
 * Runs automated evaluation harness against golden tasks.
 */
export function runEvaluationHarness(customTasksPath?: string): EvaluationSummary {
  const goldenPath = customTasksPath || path.join(process.cwd(), 'tests', 'golden_tasks.json');
  if (!fs.existsSync(goldenPath)) {
    throw new Error(`Golden tasks file not found: ${goldenPath}`);
  }

  const tasks: any[] = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
  const reportItems: EvaluationReportItem[] = [];

  for (const task of tasks) {
    let passed = true;
    let score = 1.0;
    let details = 'All criteria met.';

    switch (task.category) {
      case 'memory_budget': {
        const mode = inferPromptMode(task.user_query);
        const route = routeAndRankMemories({ userQuery: task.user_query });
        if (mode !== task.expected_mode) {
          passed = false;
          score = 0.5;
          details = `Expected mode ${task.expected_mode}, got ${mode}`;
        } else if (route.injectedFacts.length > task.max_injected_memories) {
          passed = false;
          score = 0.0;
          details = `Expected 0 memories for casual query, got ${route.injectedFacts.length}`;
        }
        break;
      }

      case 'security': {
        const res = proposePersonaChange({
          persona_id: 'default',
          target_file: task.proposal_input.target_file,
          target_section: task.proposal_input.target_section,
          operation: task.proposal_input.operation,
          patch_payload: task.proposal_input.patch_payload || {},
          rationale: 'Benchmark attack test',
        });

        if (res.ok) {
          passed = false;
          score = 0.0;
          details = `Expected proposal to be rejected, but it succeeded`;
        } else if (!res.issues?.some((i) => i.code === task.expected_issue_code)) {
          passed = false;
          score = 0.5;
          details = `Expected issue code ${task.expected_issue_code}, got ${res.issues?.map((i) => i.code).join(', ')}`;
        }
        break;
      }

      case 'privacy': {
        const redRes = sanitizeTextForCloud(task.sample_text);
        const hasAllTypes = task.expected_redacted_types.every((t: string) => redRes.redactedTypes.includes(t));
        if (!hasAllTypes) {
          passed = false;
          score = 0.5;
          details = `Missing redacted types. Expected ${task.expected_redacted_types.join(', ')}, got ${redRes.redactedTypes.join(', ')}`;
        }
        break;
      }

      case 'retrieval': {
        const mode = inferPromptMode(task.user_query);
        if (mode !== 'coding_task' && mode !== 'architecture_review') {
          passed = false;
          score = 0.5;
          details = `Inferred mode was ${mode}`;
        }
        break;
      }

      default:
        passed = true;
        score = 1.0;
    }

    reportItems.push({
      taskId: task.id,
      name: task.name,
      category: task.category,
      passed,
      score,
      details,
    });
  }

  const passedTasks = reportItems.filter((i) => i.passed).length;
  const overallScore = Math.round((reportItems.reduce((acc, i) => acc + i.score, 0) / reportItems.length) * 100);

  return {
    totalTasks: reportItems.length,
    passedTasks,
    overallScore,
    items: reportItems,
  };
}
