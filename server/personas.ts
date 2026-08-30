import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import {
  PersonaMetadata,
  PersonaDetail,
  PersonaFile,
  PersonaFileVersionRecord,
  PersonaChangeProposalRecord,
  ProposePersonaChangeInput,
  ProposePersonaChangeResult,
  ApplyProposalResult,
  RollbackResult,
  RiskLevel,
} from '../src/types';
import { loadUnifiedToolsMdContent } from './toolsConfig';
import { loadConfig, saveConfig } from './config';
import { getMemoryDb } from './memoryDb';
import { getUserMemories, addOrUpdateMemory } from './memory';
import { evaluateProposalRisk } from './personaRiskRules';
import { evaluateProposalRegression } from './agent/regressionGuard';

export type { PersonaMetadata, PersonaDetail };

const PERSONAS_DIR = path.join(os.homedir(), '.0xagent', 'personas');

function getPersonasDir(): string {
  if (!fs.existsSync(PERSONAS_DIR)) {
    fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  }
  return PERSONAS_DIR;
}

export function getUnifiedToolsContext(): string {
  return `\n\n${loadUnifiedToolsMdContent()}`;
}

export function initPersonas(): void {
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir);
  
  const ensurePersona = (id: string, data: any) => {
    const personaDir = path.join(dir, id);
    const metaPath = path.join(personaDir, 'metadata.json');
    if (!fs.existsSync(personaDir) || !fs.existsSync(metaPath)) {
      createPersonaDirectory(id, data);
    } else {
      // Ensure baseline versions exist in DB
      ensureBaselineFileVersions(id);
    }
  };

  ensurePersona('default', {
    name: '0xAgent Core',
    description: 'Универсальный высокоскоростной ИИ-разработчик для быстрого написания и отладки кода.',
    icon: 'Zap',
    user_id: 'usr_core_01',
    is_active: items.length === 0,
    soul: `# SOUL.md — 0xAgent Core

<!-- 0xagent:protected id="safety" version="1" -->
## Safety & Directives
- ВСЕГДА размышляй в <think> и отвечай СТРОГО НА РУССКОМ ЯЗЫКЕ.
- Пиши чистый, типобезопасный и поддерживаемый код на английском языке.
- Выполняй задачи пользователя с максимальной инженерной точностью.
<!-- /0xagent:protected -->

## Характер и Личность
- Ты — 0xAgent Core, высококлассный автономный ИИ-инженер и разработчик программного обеспечения.
- Профессиональный, прямой, лаконичный. Приоритет — работающие решения и качественный код.
- Тон: Энергичный, сфокусированный, конструктивный.`,
    tools: loadUnifiedToolsMdContent(),
    user: `# USER.md — Профиль пользователя и предпочтения
<!-- 0xagent:user:pinned -->
## Pinned Preferences
- ОС: Windows (PowerShell)
- Предпочитает структурированные технические объяснения и готовые рабочие артефакты кода.
<!-- /0xagent:user:pinned -->

<!-- 0xagent:user:generated -->
## Active User Memories
<!-- /0xagent:user:generated -->`,
  });
}

function createPersonaDirectory(
  id: string,
  data: {
    name: string;
    description: string;
    icon: string;
    user_id: string;
    is_active: boolean;
    soul: string;
    tools: string;
    user: string;
  }
): void {
  const dir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const now = Date.now();
  const metadata: PersonaMetadata = {
    id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    user_id: data.user_id,
    is_active: data.is_active,
    created_at: now,
    updated_at: now,
  };

  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dir, 'SOUL.md'), data.soul, 'utf-8');
  fs.writeFileSync(path.join(dir, 'TOOLS.md'), data.tools, 'utf-8');
  fs.writeFileSync(path.join(dir, 'USER.md'), data.user, 'utf-8');

  // Create baseline snapshots in DB
  try {
    createFileVersionSnapshot(id, 'SOUL.md', data.soul, 'system');
    createFileVersionSnapshot(id, 'TOOLS.md', data.tools, 'system');
    createFileVersionSnapshot(id, 'USER.md', data.user, 'system');
  } catch {}
}

function ensureBaselineFileVersions(personaId: string): void {
  const pDir = path.join(getPersonasDir(), personaId);
  const files: PersonaFile[] = ['SOUL.md', 'TOOLS.md', 'USER.md'];
  for (const f of files) {
    const fullPath = path.join(pDir, f);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        createFileVersionSnapshot(personaId, f, content, 'system');
      } catch {}
    }
  }
}

export function createFileVersionSnapshot(
  personaId: string,
  file: PersonaFile,
  content: string,
  createdBy: string = 'system',
  proposalId?: string | null
): PersonaFileVersionRecord {
  const db = getMemoryDb();
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const versionId = `pfv_${hash.substring(0, 10)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT OR IGNORE INTO persona_file_versions (id, persona_id, file, content, content_sha256, created_by, source_proposal_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(versionId, personaId, file, content, hash, createdBy, proposalId || null, now);
  } catch (err) {
    console.warn(`[personas] Failed to insert file version snapshot:`, err);
  }

  // Update metadata.json with latest version id
  const pDir = path.join(getPersonasDir(), personaId);
  const metaPath = path.join(pDir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const parsed: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      parsed.active_version_id = versionId;
      parsed.compiled_sha256 = hash;
      parsed.updated_at = Date.now();
      fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {}
  }

  return {
    id: versionId,
    persona_id: personaId,
    file,
    content,
    content_sha256: hash,
    created_by: createdBy,
    source_proposal_id: proposalId || null,
    created_at: now,
  };
}

export function listPersonaFileVersions(personaId: string, file?: PersonaFile): PersonaFileVersionRecord[] {
  const db = getMemoryDb();
  if (file) {
    const rows = db.prepare(`
      SELECT * FROM persona_file_versions
      WHERE persona_id = ? AND file = ?
      ORDER BY created_at DESC
    `).all(personaId, file) as any[];
    return rows;
  }
  const rows = db.prepare(`
    SELECT * FROM persona_file_versions
    WHERE persona_id = ?
    ORDER BY created_at DESC
  `).all(personaId) as any[];
  return rows;
}

export function listPersonas(): PersonaMetadata[] {
  initPersonas();
  const dir = getPersonasDir();
  const items = fs.readdirSync(dir, { withFileTypes: true });
  const result: PersonaMetadata[] = [];

  for (const item of items) {
    if (item.isDirectory()) {
      const metaPath = path.join(dir, item.name, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const raw = fs.readFileSync(metaPath, 'utf-8');
          const parsed: PersonaMetadata = JSON.parse(raw);
          result.push(parsed);
        } catch {}
      }
    }
  }

  result.sort((a, b) => (a.is_active ? -1 : b.is_active ? 1 : b.updated_at - a.updated_at));
  return result;
}

export function getPersonaDetail(id: string): PersonaDetail | null {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  const metaPath = path.join(pDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return null;

  try {
    const metadata: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const soul = fs.existsSync(path.join(pDir, 'SOUL.md')) ? fs.readFileSync(path.join(pDir, 'SOUL.md'), 'utf-8') : '';
    const tools = fs.existsSync(path.join(pDir, 'TOOLS.md')) ? fs.readFileSync(path.join(pDir, 'TOOLS.md'), 'utf-8') : '';
    let user = fs.existsSync(path.join(pDir, 'USER.md')) ? fs.readFileSync(path.join(pDir, 'USER.md'), 'utf-8') : '';

    // Recompile user projection to keep it synchronized with memory.db
    user = compileUserProjection(metadata.user_id || 'user_default', user);

    return { metadata, soul, tools, user };
  } catch {
    return null;
  }
}

export function getActivePersona(): PersonaDetail {
  const personas = listPersonas();
  const activeMeta = personas.find((p) => p.is_active) || personas[0];
  if (activeMeta) {
    const detail = getPersonaDetail(activeMeta.id);
    if (detail) return detail;
  }

  // Fallback
  return {
    metadata: {
      id: 'default',
      name: '0xAgent Core',
      description: 'Default agent persona',
      icon: 'Zap',
      user_id: 'usr_core_01',
      is_active: true,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    soul: '# SOUL.md\nStandard AI Assistant',
    tools: '# TOOLS.md\nStandard Tool Execution',
    user: '# USER.md\nStandard User Profile',
  };
}

export function setActivePersona(id: string): PersonaMetadata[] {
  initPersonas();
  const dir = getPersonasDir();
  const personas = listPersonas();

  for (const p of personas) {
    const metaPath = path.join(dir, p.id, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed: PersonaMetadata = JSON.parse(raw);
        parsed.is_active = p.id === id;
        parsed.updated_at = Date.now();
        fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch {}
    }
  }

  // Persist active_persona_id in config.json
  try {
    const cfg = loadConfig();
    cfg.active_persona_id = id;
    saveConfig(cfg);
  } catch (err) {
    console.error('Failed to save active_persona_id in config:', err);
  }

  return listPersonas();
}

export function createPersona(name: string, description?: string, icon?: string): PersonaDetail {
  initPersonas();
  const id = `persona_${uuidv4().substring(0, 8)}`;
  const userId = `usr_${uuidv4().substring(0, 8)}`;

  createPersonaDirectory(id, {
    name: name || 'Новая Личность',
    description: description || 'Пользовательская личность Агента',
    icon: icon || 'User',
    user_id: userId,
    is_active: false,
    soul: `# SOUL.md — ${name}

<!-- 0xagent:protected id="safety" version="1" -->
## Safety & Directives
- ВСЕГДА размышляй в <think> и отвечай СТРОГО НА РУССКОМ ЯЗЫКЕ.
<!-- /0xagent:protected -->

## Характер и Роль
- Опишите стиль поведения, тон и характер Агента.

## Цели
- Определите главные задачи Агента.`,
    tools: `# TOOLS.md — Правила инструментов для ${name}

- Задайте особые правила вызова инструментов для этой личности.`,
    user: `# USER.md — Профиль пользователя (${userId})
<!-- 0xagent:user:pinned -->
## Pinned Preferences
<!-- /0xagent:user:pinned -->

<!-- 0xagent:user:generated -->
## Active User Memories
<!-- /0xagent:user:generated -->`,
  });

  return getPersonaDetail(id)!;
}

export function updatePersonaFile(
  id: string,
  filename: PersonaFile,
  content: string,
  proposalId?: string | null
): PersonaDetail {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(pDir)) {
    throw new Error(`Persona not found: ${id}`);
  }

  fs.writeFileSync(path.join(pDir, filename), content, 'utf-8');

  // Record version snapshot
  const snapshot = createFileVersionSnapshot(id, filename, content, proposalId ? 'agent_proposal' : 'manual_edit', proposalId);

  const metaPath = path.join(pDir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const parsed: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      parsed.active_version_id = snapshot.id;
      parsed.compiled_sha256 = snapshot.content_sha256;
      parsed.updated_at = Date.now();
      fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {}
  }

  return getPersonaDetail(id)!;
}

export function updatePersonaMetadata(id: string, patch: Partial<PersonaMetadata>): PersonaMetadata {
  initPersonas();
  const pDir = path.join(getPersonasDir(), id);
  const metaPath = path.join(pDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Persona not found: ${id}`);
  }

  const existing: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const updated: PersonaMetadata = {
    ...existing,
    ...patch,
    updated_at: Date.now(),
  };

  fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export function deletePersona(id: string): void {
  initPersonas();
  if (id === 'default') {
    throw new Error('Базовая личность (0xAgent Core) не может быть удалена');
  }

  const pDir = path.join(getPersonasDir(), id);
  if (fs.existsSync(pDir)) {
    fs.rmSync(pDir, { recursive: true, force: true });
  }

  // Ensure an active persona exists
  const personas = listPersonas();
  if (personas.length > 0 && !personas.some((p) => p.is_active)) {
    setActivePersona(personas[0].id);
  }
}

export function appendSilentUserTrait(personaId: string, factText: string): void {
  try {
    addOrUpdateMemory('preference', factText.trim(), 'user_preference', {
      scope: 'user',
      subjectId: 'user_default',
      isExplicit: true,
      confidence: 1.0,
      actorScope: personaId,
    });
  } catch (err) {
    console.error('Failed to append silent user trait:', err);
  }
}

// ============================================================================
// 2. SAFE PERSONA PROPOSALS & MUTATION PIPELINE
// ============================================================================

export function proposePersonaChange(input: ProposePersonaChangeInput): ProposePersonaChangeResult {
  initPersonas();
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

// ============================================================================
// 3. USER.md PROJECTION COMPILER
// ============================================================================

const MAX_PROJECTED_USER_MEMORIES = 40;

export function compileUserProjection(subjectId: string = 'user_default', existingUserMd?: string): string {
  const activeMemories = getUserMemories(subjectId);

  // Extract pinned section if present in existing markdown
  let pinnedText = '';
  if (existingUserMd) {
    const pinnedMatch = existingUserMd.match(/<!-- 0xagent:user:pinned -->([\s\S]*?)<!-- \/0xagent:user:pinned -->/i);
    if (pinnedMatch && pinnedMatch[1]) {
      pinnedText = pinnedMatch[1].trim();
    }
  }

  const lines: string[] = [];
  lines.push(`# USER.md — Профиль пользователя`);
  lines.push(`<!-- 0xagent:user:pinned -->`);
  if (pinnedText) {
    lines.push(pinnedText);
  } else {
    lines.push(`## Pinned Preferences`);
    lines.push(`- Пользователь предпочитает структурированные технические объяснения.`);
  }
  lines.push(`<!-- /0xagent:user:pinned -->\n`);

  lines.push(`<!-- 0xagent:user:generated -->`);
  lines.push(`## Active User Memories`);
  if (activeMemories.length > 0) {
    // Sort by effective weight: importance * confidence descending
    const rankedMemories = [...activeMemories].sort(
      (a, b) => ((b.importance ?? 3) * (b.confidence ?? 1.0)) - ((a.importance ?? 3) * (a.confidence ?? 1.0))
    );
    const topMemories = rankedMemories.slice(0, MAX_PROJECTED_USER_MEMORIES);

    for (const mem of topMemories) {
      lines.push(`- [${mem.category.toUpperCase()}] ${mem.key}: ${mem.value}`);
    }

    if (rankedMemories.length > MAX_PROJECTED_USER_MEMORIES) {
      lines.push(`- ... (${rankedMemories.length - MAX_PROJECTED_USER_MEMORIES} дополнительных фактов сохранены в memory.db)`);
    }
  } else {
    lines.push(`- Нет динамических записей.`);
  }
  lines.push(`<!-- /0xagent:user:generated -->`);

  return lines.join('\n');
}

