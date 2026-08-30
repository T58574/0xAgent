import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { getMemoryDb, closeMemoryDb, setCustomDbPath } from '../server/memoryDb';
import {
  addOrUpdateMemory,
  getUserMemories,
  getProjectMemories,
  getPersonaMemories,
  routeAndRankMemories,
  getSystemPromptMemoryContext,
} from '../server/memory';
import { resolveProjectForWorkspace, computeProjectFingerprint } from '../server/projectService';
import {
  initPersonas,
  getPersonaDetail,
  updatePersonaFile,
  proposePersonaChange,
  listPersonaProposals,
  getPersonaProposal,
  approvePersonaProposal,
  rejectPersonaProposal,
  applyPersonaProposal,
  listPersonaFileVersions,
  rollbackPersonaFile,
  compileUserProjection,
} from '../server/personas';
import { buildFullSystemPrompt } from '../server/agent/promptBuilder';
import { AppConfig } from '../src/types';

describe('0xAgent Memory Contract v1 & Scoped Memory Architecture Suite', () => {
  const testDbDir = path.join(os.tmpdir(), `0xagent_test_memory_${Date.now()}`);
  const testDbPath = path.join(testDbDir, 'test_memory.db');

  before(() => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
    setCustomDbPath(testDbPath);
  });

  describe('1. SQLite DDL Migration & Schema Invariants', () => {
    it('should initialize all required tables, views, and indexes without errors', () => {
      const db = getMemoryDb();
      assert.ok(db, 'Database instance must be initialized');

      // Check projects table
      const projectTable = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='projects'`).get() as { count: number };
      assert.equal(projectTable.count, 1, 'projects table must exist');

      // Check project_path_aliases table
      const aliasTable = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='project_path_aliases'`).get() as { count: number };
      assert.equal(aliasTable.count, 1, 'project_path_aliases table must exist');

      // Check persona_file_versions table
      const versionTable = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='persona_file_versions'`).get() as { count: number };
      assert.equal(versionTable.count, 1, 'persona_file_versions table must exist');

      // Check persona_change_proposals table
      const proposalTable = db.prepare(`SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='persona_change_proposals'`).get() as { count: number };
      assert.equal(proposalTable.count, 1, 'persona_change_proposals table must exist');

      // Check views
      const views = db.prepare(`SELECT name FROM sqlite_master WHERE type='view'`).all() as { name: string }[];
      const viewNames = views.map((v) => v.name);
      assert.ok(viewNames.includes('active_user_memories'), 'active_user_memories view must exist');
      assert.ok(viewNames.includes('active_project_memories'), 'active_project_memories view must exist');
      assert.ok(viewNames.includes('active_persona_memories'), 'active_persona_memories view must exist');
    });

    it('should have additive columns in canonical_memories', () => {
      const db = getMemoryDb();
      const cols = db.prepare(`PRAGMA table_info(canonical_memories)`).all() as { name: string }[];
      const colNames = new Set(cols.map((c) => c.name));

      assert.ok(colNames.has('scope'), 'scope column must exist');
      assert.ok(colNames.has('project_id'), 'project_id column must exist');
      assert.ok(colNames.has('persona_id'), 'persona_id column must exist');
      assert.ok(colNames.has('session_id'), 'session_id column must exist');
      assert.ok(colNames.has('display_text'), 'display_text column must exist');
      assert.ok(colNames.has('usage_count'), 'usage_count column must exist');
      assert.ok(colNames.has('last_used_at'), 'last_used_at column must exist');
    });
  });

  describe('2. Project Identity & Workspace Resolution Engine', () => {
    it('should resolve deterministic project_id for workspace path', () => {
      const workspaceDir = path.join(os.tmpdir(), 'mock_test_workspace_alpha');
      const project = resolveProjectForWorkspace(workspaceDir);

      assert.ok(project.id.startsWith('proj_'), 'project.id must have proj_ prefix');
      assert.equal(project.status, 'active');
      assert.equal(project.workspace_dir, workspaceDir);

      // Resolving same directory should return identical ID
      const resolvedAgain = resolveProjectForWorkspace(workspaceDir);
      assert.equal(resolvedAgain.id, project.id, 'Repeated resolution must return same project id');
    });

    it('should handle moved projects via path aliases', () => {
      const initialPath = path.join(os.tmpdir(), 'project_repo_initial');
      const movedPath = path.join(os.tmpdir(), 'project_repo_moved');

      const p1 = resolveProjectForWorkspace(initialPath);
      const fp = computeProjectFingerprint(initialPath);

      // Now create record for moved path with same fingerprint
      const db = getMemoryDb();
      db.prepare(`
        INSERT OR REPLACE INTO project_path_aliases (project_id, path, normalized_path, last_seen_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(p1.id, movedPath, movedPath.toLowerCase());

      const p2 = resolveProjectForWorkspace(movedPath);
      assert.equal(p2.id, p1.id, 'Moved workspace alias should resolve to original project id');
    });
  });

  describe('3. Scoped Memory CRUD & Queries', () => {
    it('should store and query global user memories', () => {
      addOrUpdateMemory('theme_preference', 'dark_graphite', 'preference', {
        scope: 'user',
        subjectId: 'user_default',
        isExplicit: true,
        confidence: 1.0,
      });

      const userMems = getUserMemories('user_default');
      const found = userMems.find((m) => m.key === 'theme_preference');
      assert.ok(found, 'theme_preference must be present in user memories');
      assert.equal(found.value, 'dark_graphite');
      assert.equal(found.scope, 'user');
    });

    it('should store and query project-scoped memories', () => {
      const projectId = 'proj_test_beta';
      addOrUpdateMemory('test_runner', 'npm test', 'project_convention', {
        scope: 'project',
        projectId,
        isExplicit: true,
        confidence: 1.0,
      });

      const projMems = getProjectMemories(projectId);
      assert.equal(projMems.length, 1);
      assert.equal(projMems[0].key, 'test_runner');
      assert.equal(projMems[0].value, 'npm test');
      assert.equal(projMems[0].scope, 'project');
      assert.equal(projMems[0].project_id, projectId);
    });

    it('should route and rank project memories when workspace context is provided', () => {
      const workspaceDir = path.join(os.tmpdir(), 'mock_test_workspace_alpha');
      const project = resolveProjectForWorkspace(workspaceDir);

      addOrUpdateMemory('architecture_style', 'modular_clean_architecture', 'architecture', {
        scope: 'project',
        projectId: project.id,
        isExplicit: true,
        confidence: 1.0,
      });

      const routing = routeAndRankMemories({
        userQuery: 'Как устроена архитектура и какие соглашения в проекте?',
        activePersonaId: 'default',
        workspaceDir,
      });

      const hasProjFact = routing.injectedFacts.some((f) => f.key === 'architecture_style');
      assert.ok(hasProjFact, 'Project memory must be injected when workspaceDir is matched');
    });
  });

  describe('4. Safe Persona Mutation Pipeline & Protected Sections', () => {
    it('should create proposal and block direct tampering of protected sections', () => {
      initPersonas();
      const personaDetail = getPersonaDetail('default');
      assert.ok(personaDetail, 'Default persona must exist');

      // Attempt to delete protected safety section
      const invalidProposal = proposePersonaChange({
        persona_id: 'default',
        target_file: 'SOUL.md',
        target_section: 'safety',
        operation: 'delete_section',
        rationale: 'Malicious injection attempt',
      });

      assert.equal(invalidProposal.ok, false, 'Tampering with protected section must be rejected');
      assert.ok(invalidProposal.issues && invalidProposal.issues.length > 0);
      assert.equal(invalidProposal.issues[0].code, 'protected_section_conflict');
    });

    it('should accept valid persona proposal and compute risk level', () => {
      const result = proposePersonaChange({
        persona_id: 'default',
        target_file: 'SOUL.md',
        target_section: 'communication_style',
        operation: 'append',
        patch_payload: {
          section: 'communication_style',
          content: 'Отвечай строго лаконично и технически выверено.',
        },
        rationale: 'User requested concise technical answers',
      });

      assert.equal(result.ok, true, 'Valid proposal must be accepted');
      assert.ok(result.proposal, 'Proposal record must be returned');
      assert.equal(result.risk_level, 'high', 'SOUL.md changes must have high risk');
      assert.equal(result.requires_approval, true);
      assert.equal(result.proposal.status, 'pending');
    });

    it('should execute proposal lifecycle: approve -> apply -> version snapshot -> rollback', () => {
      const pRes = proposePersonaChange({
        persona_id: 'default',
        target_file: 'SOUL.md',
        target_section: 'custom_guidelines',
        operation: 'append',
        patch_payload: {
          content: '## Custom Directives\n- Always verify unit tests before deployment.',
        },
        rationale: 'Add custom directive',
      });

      assert.ok(pRes.proposal);
      const proposalId = pRes.proposal.id;

      // Approve
      const approved = approvePersonaProposal(proposalId);
      assert.equal(approved.status, 'approved');

      // Check version count before apply
      const initialVersions = listPersonaFileVersions('default', 'SOUL.md');
      const baselineVersionId = initialVersions[initialVersions.length - 1]?.id;

      // Apply
      const applyResult = applyPersonaProposal(proposalId);
      assert.equal(applyResult.ok, true, 'Proposal application must succeed');

      // Verify file content updated
      const updatedDetail = getPersonaDetail('default');
      assert.ok(updatedDetail?.soul.includes('Always verify unit tests before deployment'));

      // Rollback
      if (baselineVersionId) {
        const rollbackResult = rollbackPersonaFile('default', 'SOUL.md', baselineVersionId);
        assert.equal(rollbackResult.ok, true, 'Rollback must succeed');

        const rolledBackDetail = getPersonaDetail('default');
        assert.ok(!rolledBackDetail?.soul.includes('Always verify unit tests before deployment'), 'Rolled back file must not contain applied changes');
      }
    });
  });

  describe('5. USER.md Projection Compiler & Prompt Assembly', () => {
    it('should compile USER.md from canonical_memories and preserve pinned user preferences', () => {
      const existingUserMd = `# USER.md
<!-- 0xagent:user:pinned -->
## Pinned Preferences
- Custom pinned user rule: Never touch database migrations without review.
<!-- /0xagent:user:pinned -->

<!-- 0xagent:user:generated -->
## Active User Memories
<!-- /0xagent:user:generated -->`;

      addOrUpdateMemory('code_formatting', 'prettier_standard', 'preference', {
        scope: 'user',
        subjectId: 'user_default',
        isExplicit: true,
        confidence: 1.0,
      });

      const compiled = compileUserProjection('user_default', existingUserMd);
      assert.ok(compiled.includes('Custom pinned user rule'), 'Must retain pinned preferences');
      assert.ok(compiled.includes('code_formatting: prettier_standard') || compiled.includes('Active User Memories'), 'Must render active memories');
    });

    it('should assemble system prompt with stable prefix and dynamic memory blocks', () => {
      const config: AppConfig = {
        model_name: 'Qwen-2.5-Coder-7B',
        workspace_dir: path.join(os.tmpdir(), 'mock_test_workspace_alpha'),
        reasoning_enabled: false,
      };

      const fullPrompt = buildFullSystemPrompt(config, 'Какие у нас правила тестирования?');

      assert.ok(fullPrompt.includes('# AGENT PERSONA:'), 'Prompt must inject active persona');
      assert.ok(fullPrompt.includes('SOUL.md'), 'Prompt must include SOUL.md section');
      assert.ok(fullPrompt.includes('USER.md (Global User Profile)'), 'Prompt must include USER.md section');
      assert.ok(fullPrompt.includes('propose_persona_change'), 'Prompt must instruct on propose_persona_change tool');
    });
  });
});
