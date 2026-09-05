import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  PersonaFile,
  PersonaChangeProposalRecord,
  ProposePersonaChangeInput,
  ProposePersonaChangeResult,
  ApplyProposalResult,
  RollbackResult,
  RiskLevel,
} from '../src/types';
import { getMemoryDb } from './memoryDb';
import { evaluateProposalRisk } from './personaRiskRules';
import { evaluateProposalRegression } from './agent/regressionGuard';
import {
  getPersonasDir,
  updatePersonaFile,
  createFileVersionSnapshot,
} from './personaFiles';

export function proposePersonaChange(input: ProposePersonaChangeInput): ProposePersonaChangeResult {
  const pDir = path.join(getPersonasDir(), input.persona_id);
  if (!fs.existsSync(pDir)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_target_file', message: `Persona not found: ${input.persona_id}` }],
    };
  }

  const allowedFiles: PersonaFile[] = ['SOUL.md', 'TOOLS.md', 'USER.md', 'USER_PINNED.md', 'CORE.md'];
  if (!allowedFiles.includes(input.target_file)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_target_file', message: `Invalid target file: ${input.target_file}` }],
    };
  }

  // Core policy is immutable by autonomous agents
  if (input.target_file === 'CORE.md' && input.source_type === 'agent') {
    return {
      ok: false,
      issues: [{ code: 'forbidden_operation', message: 'CORE.md is protected and cannot be modified by autonomous agent proposals.' }],
    };
  }

  // Read current file content
  const filePath = path.join(pDir, input.target_file);
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const currentSha = crypto.createHash('sha256').update(currentContent).digest('hex');

  // Verify base hash if provided
  if (input.base_content_sha256 && input.base_content_sha256 !== currentSha) {
    return {
      ok: false,
      issues: [{ code: 'base_version_mismatch', message: 'File has been modified since base version. Please fetch latest proposal context.' }],
    };
  }

  // Protected section validation
  const targetSection = (input.target_section || input.patch_payload?.section || '').toLowerCase();
  const protectedSections = ['safety', 'privacy', 'identity_core', 'tool_permissions'];
  const isProtectedSection = protectedSections.includes(targetSection);

  if (isProtectedSection && (input.operation === 'delete_section' || input.operation === 'replace_section')) {
    return {
      ok: false,
      issues: [{ code: 'protected_section_conflict', message: `Section '${targetSection}' is protected. Cannot delete or completely replace protected sections.` }],
    };
  }

  // Determine Risk Level via Declarative Risk Rules
  const riskEval = evaluateProposalRisk(input.target_file, input.target_section || input.patch_payload?.section, input.operation);
  const riskLevel: RiskLevel = riskEval.riskLevel;
  const requiresApproval = riskEval.requiresApproval;

  const db = getMemoryDb();
  const proposalId = `pch_${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  // Find latest version ID
  const latestVer = db.prepare(`
    SELECT id FROM persona_file_versions WHERE persona_id = ? AND file = ? ORDER BY created_at DESC LIMIT 1
  `).get(input.persona_id, input.target_file) as any;

  const baseVersionId = latestVer?.id || null;
  const patchPayloadJson = JSON.stringify(input.patch_payload || {});

  try {
    db.prepare(`
      INSERT INTO persona_change_proposals (
        id, persona_id, target_file, target_section, operation, patch_payload, rationale, source_type, source_event_id, source_session_id, base_version_id, risk_level, requires_approval, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      proposalId,
      input.persona_id,
      input.target_file,
      input.target_section || null,
      input.operation,
      patchPayloadJson,
      input.rationale || null,
      input.source_type || 'agent',
      input.source_event_id || null,
      input.source_session_id || null,
      baseVersionId,
      riskLevel,
      requiresApproval ? 1 : 0,
      now
    );
  } catch (err: any) {
    return {
      ok: false,
      issues: [{ code: 'duplicate_proposal', message: err.message || 'Failed to save proposal' }],
    };
  }

  const createdProposal: PersonaChangeProposalRecord = {
    id: proposalId,
    persona_id: input.persona_id,
    target_file: input.target_file,
    target_section: input.target_section || null,
    operation: input.operation,
    patch_payload: input.patch_payload,
    rationale: input.rationale || null,
    source_type: input.source_type || 'agent',
    source_event_id: input.source_event_id || null,
    source_session_id: input.source_session_id || null,
    base_version_id: baseVersionId,
    risk_level: riskLevel,
    requires_approval: true,
    status: 'pending',
    created_at: now,
    reviewed_at: null,
    applied_at: null,
    rejected_reason: null,
  };

  return {
    ok: true,
    proposal: createdProposal,
    risk_level: riskLevel,
    requires_approval: true,
  };
}

export function listPersonaProposals(personaId: string, status?: string): PersonaChangeProposalRecord[] {
  const db = getMemoryDb();
  let rows: any[] = [];
  if (status) {
    rows = db.prepare(`
      SELECT * FROM persona_change_proposals
      WHERE persona_id = ? AND status = ?
      ORDER BY created_at DESC
    `).all(personaId, status);
  } else {
    rows = db.prepare(`
      SELECT * FROM persona_change_proposals
      WHERE persona_id = ?
      ORDER BY created_at DESC
    `).all(personaId);
  }

  return rows.map((r) => ({
    ...r,
    patch_payload: typeof r.patch_payload === 'string' ? JSON.parse(r.patch_payload) : r.patch_payload,
    requires_approval: Boolean(r.requires_approval),
  }));
}

export function getPersonaProposal(proposalId: string): PersonaChangeProposalRecord | null {
  const db = getMemoryDb();
  const row = db.prepare(`SELECT * FROM persona_change_proposals WHERE id = ?`).get(proposalId) as any;
  if (!row) return null;
  return {
    ...row,
    patch_payload: typeof row.patch_payload === 'string' ? JSON.parse(row.patch_payload) : row.patch_payload,
    requires_approval: Boolean(row.requires_approval),
  };
}

export function approvePersonaProposal(proposalId: string): PersonaChangeProposalRecord {
  const db = getMemoryDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE persona_change_proposals SET status = 'approved', reviewed_at = ? WHERE id = ?`).run(now, proposalId);
  return getPersonaProposal(proposalId)!;
}

export function rejectPersonaProposal(proposalId: string, reason?: string): PersonaChangeProposalRecord {
  const db = getMemoryDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE persona_change_proposals SET status = 'rejected', reviewed_at = ?, rejected_reason = ? WHERE id = ?`).run(now, reason || 'Rejected by user', proposalId);
  return getPersonaProposal(proposalId)!;
}

export function applyPersonaProposal(proposalId: string, options: { forceOverride?: boolean } = {}): ApplyProposalResult {
  const proposal = getPersonaProposal(proposalId);
  if (!proposal) {
    return { ok: false, proposal_id: proposalId, error: 'Proposal not found' };
  }

  // 1. Pre-Apply Regression Guard Check
  const guardResult = evaluateProposalRegression(proposal, { forceOverride: options.forceOverride });
  if (guardResult.blocked) {
    return {
      ok: false,
      blocked: true,
      proposal_id: proposalId,
      error: `Pre-Apply Regression Guard blocked this proposal: ${guardResult.details}`,
      regression_check: guardResult.checkRecord,
    };
  }

  const pDir = path.join(getPersonasDir(), proposal.persona_id);
  const targetPath = path.join(pDir, proposal.target_file);
  const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf-8') : '';

  let newContent = currentContent;
  const patchContent = proposal.patch_payload?.content || '';

  switch (proposal.operation) {
    case 'append':
      newContent = currentContent.trim() + `\n\n${patchContent.trim()}\n`;
      break;
    case 'prepend':
      newContent = `${patchContent.trim()}\n\n` + currentContent.trim() + `\n`;
      break;
    case 'replace_section': {
      const section = proposal.target_section || proposal.patch_payload?.section;
      if (section) {
        const regex = new RegExp(`(##\\s+${section}[\\s\\S]*?)(?=\\n##|$)`, 'i');
        if (regex.test(currentContent)) {
          newContent = currentContent.replace(regex, `## ${section}\n${patchContent.trim()}`);
        } else {
          newContent = currentContent.trim() + `\n\n## ${section}\n${patchContent.trim()}\n`;
        }
      } else {
        newContent = patchContent;
      }
      break;
    }
    case 'delete_section': {
      const section = proposal.target_section || proposal.patch_payload?.section;
      if (section) {
        const regex = new RegExp(`##\\s+${section}[\\s\\S]*?(?=\\n##|$)`, 'gi');
        newContent = currentContent.replace(regex, '').trim() + '\n';
      }
      break;
    }
    default:
      newContent = patchContent;
  }

  // Update file and record version
  updatePersonaFile(proposal.persona_id, proposal.target_file, newContent, proposal.id);

  const db = getMemoryDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE persona_change_proposals SET status = 'applied', applied_at = ? WHERE id = ?`).run(now, proposalId);

  // Record Telemetry: proposal_applied
  try {
    db.prepare(`
      INSERT INTO evolution_telemetry (
        id, event_type, persona_id, proposal_id, proposal_risk_level, proposal_operation, regression_blocked, baseline_score, proposed_score, score_delta, created_at
      ) VALUES (?, 'proposal_applied', ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(
      `tel_${uuidv4().substring(0, 8)}`,
      proposal.persona_id,
      proposal.id,
      proposal.risk_level,
      proposal.operation,
      guardResult.baseline_score,
      guardResult.proposed_score,
      guardResult.delta,
      now
    );
  } catch {}

  const latestVer = db.prepare(`SELECT id FROM persona_file_versions WHERE source_proposal_id = ? LIMIT 1`).get(proposalId) as any;

  return {
    ok: true,
    proposal_id: proposalId,
    new_version_id: latestVer?.id,
    applied_at: now,
    regression_check: guardResult.checkRecord,
  };
}

export function rollbackPersonaFile(personaId: string, file: PersonaFile, targetVersionId: string): RollbackResult {
  const db = getMemoryDb();
  const targetVer = db.prepare(`
    SELECT * FROM persona_file_versions WHERE id = ? AND persona_id = ? AND file = ?
  `).get(targetVersionId, personaId, file) as any;

  if (!targetVer) {
    throw new Error(`Target version ${targetVersionId} not found for persona ${personaId}`);
  }

  // Write content to disk and create new rollback version snapshot
  const pDir = path.join(getPersonasDir(), personaId);
  const targetPath = path.join(pDir, file);
  fs.writeFileSync(targetPath, targetVer.content, 'utf-8');

  const newSnapshot = createFileVersionSnapshot(personaId, file, targetVer.content, 'rollback');

  return {
    ok: true,
    persona_id: personaId,
    file,
    restored_version_id: targetVersionId,
    new_version_id: newSnapshot.id,
  };
}
