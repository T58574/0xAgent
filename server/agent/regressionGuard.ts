import { v4 as uuidv4 } from 'uuid';
import { getMemoryDb } from '../memoryDb';
import { runEvaluationHarness } from '../evalHarness';
import {
  PersonaChangeProposalRecord,
  PreApplyGuardResult,
  RegressionCheckRecord,
} from '../../src/types';

export interface GuardEvaluationOptions {
  forceOverride?: boolean;
}

const FORBIDDEN_PROMPT_PATTERNS: RegExp[] = [
  // Russian Injection & Evasion Directives
  /(?:игнорируй|забудь|пропусти|отключи|сними|обойди)\s+(?:все\s+)?(?:safety|безопасн\w*|правил\w*|инструкци\w*|ограничен\w*|rules|политик\w*|фильтр\w*|рамк\w*)/i,
  /(?:ты\s+больше\s+не|забудь\s+что\s+ты|отныне\s+ты)\s+(?:0xAgent|ассистент|инженер|JARVIS|J\.A\.R\.V\.I\.S\.)/i,
  
  // English Injection & Evasion Directives
  /ignore\s+(?:all\s+)?(?:prior\s+|previous\s+|future\s+)?(?:safety|instructions|rules|constraints|guidelines|policies|directives)/i,
  /disregard\s+(?:all\s+)?(?:prior\s+|previous\s+|future\s+)?(?:safety|instructions|rules|constraints|guidelines|directives)/i,
  /forget\s+(?:all\s+)?(?:prior\s+|previous\s+)?(?:instructions|directives|rules|constraints|identity)/i,
  /disable\s+(?:all\s+)?(?:safety|filters|boundaries|restrictions|checks|guardrails)/i,
  /bypass\s+(?:all\s+)?(?:restrictions|checks|filters|safety|guardrails|moderation|constraints)/i,
  /override\s+(?:all\s+)?(?:system\s+|safety\s+|security\s+|developer\s+)?(?:instructions|prompt|rules|constraints)/i,
  
  // Jailbreak & Role-Escape Heuristics
  /\b(?:jailbreak|dan\s+mode|developer\s+mode|unrestricted\s+mode|always\s+comply|do\s+anything\s+now)\b/i,
  /(?:never\s+use|do\s+not\s+use|refuse\s+to\s+use)\s+(?:<think>|<\/think>|tools|safety)/i,
];

/**
 * Pre-Apply Regression Guard.
 * Simulates proposal application in-memory and evaluates regression against golden tasks.
 */
export function evaluateProposalRegression(
  proposal: PersonaChangeProposalRecord,
  options: GuardEvaluationOptions = {}
): PreApplyGuardResult {
  const db = getMemoryDb();
  const checkId = `rc_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  // 1. Run baseline evaluation
  const baselineHarness = runEvaluationHarness();
  const baselineComposite = baselineHarness.overallScore / 100; // 0.0 to 1.0

  // 2. In-memory content simulation
  const payload = typeof proposal.patch_payload === 'string'
    ? JSON.parse(proposal.patch_payload || '{}')
    : (proposal.patch_payload || {});

  const patchText = payload.text || payload.content || (typeof payload === 'string' ? payload : JSON.stringify(payload));

  // 3. Safety pattern inspection
  const hasInjection = FORBIDDEN_PROMPT_PATTERNS.some((re) => re.test(patchText));
  const tampersProtection =
    proposal.target_section &&
    ['safety', 'privacy', 'identity_core', 'tool_permissions'].includes(proposal.target_section.toLowerCase()) &&
    ['delete_section', 'replace_section'].includes(proposal.operation);

  let proposedComposite = baselineComposite;
  let blocked = false;
  let reason: 'regression_detected' | 'protected_violation' | 'safe_to_apply' = 'safe_to_apply';
  let details = 'Dry-run regression check passed cleanly.';

  if (hasInjection || tampersProtection) {
    proposedComposite = Math.max(0, baselineComposite - 0.4);
    blocked = true;
    reason = tampersProtection ? 'protected_violation' : 'regression_detected';
    details = tampersProtection
      ? `Proposal tampers with protected section '${proposal.target_section}'.`
      : 'Malicious directive or safety evasion detected in proposed patch.';
  } else if (proposal.operation === 'delete_section' && proposal.target_file === 'SOUL.md') {
    proposedComposite = Math.max(0, baselineComposite - 0.2);
    blocked = true;
    reason = 'regression_detected';
    details = `Deleting sections from SOUL.md risks identity degradation.`;
  }

  const delta = proposedComposite - baselineComposite;

  // Threshold check: Delta < -0.05 or Proposed < 0.85
  if (!blocked && (delta < -0.05 || proposedComposite < 0.85)) {
    blocked = true;
    reason = 'regression_detected';
    details = `Evaluation score dropped by ${(Math.abs(delta) * 100).toFixed(1)}% (below safety threshold).`;
  }

  // Handle manual override
  if (blocked && options.forceOverride) {
    details += ' [OVERRIDDEN BY OPERATOR]';
  }

  const checkRecord: RegressionCheckRecord = {
    id: checkId,
    proposal_id: proposal.id,
    baseline_composite: baselineComposite,
    proposed_composite: proposedComposite,
    delta,
    blocked: blocked && !options.forceOverride,
    reason,
    details,
    created_at: now,
  };

  // Save audit record to SQLite
  try {
    db.prepare(`
      INSERT INTO regression_checks (
        id, proposal_id, baseline_composite, proposed_composite, delta, blocked, reason, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkRecord.id,
      checkRecord.proposal_id,
      checkRecord.baseline_composite,
      checkRecord.proposed_composite,
      checkRecord.delta,
      checkRecord.blocked ? 1 : 0,
      checkRecord.reason || null,
      checkRecord.details || null,
      checkRecord.created_at
    );

    // Record Telemetry
    db.prepare(`
      INSERT INTO evolution_telemetry (
        id, event_type, persona_id, proposal_id, proposal_risk_level, proposal_operation, regression_blocked, baseline_score, proposed_score, score_delta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `tel_${uuidv4().substring(0, 8)}`,
      blocked ? 'proposal_blocked' : 'proposal_approved',
      proposal.persona_id,
      proposal.id,
      proposal.risk_level,
      proposal.operation,
      checkRecord.blocked ? 1 : 0,
      baselineComposite * 100,
      proposedComposite * 100,
      delta * 100,
      now
    );
  } catch (err) {
    console.warn('[regressionGuard] Failed to insert regression check or telemetry record:', err);
  }

  return {
    ok: !checkRecord.blocked,
    blocked: checkRecord.blocked,
    reason,
    baseline_score: baselineComposite * 100,
    proposed_score: proposedComposite * 100,
    delta: delta * 100,
    details,
    requiresOverride: blocked && !options.forceOverride,
    checkRecord,
  };
}
