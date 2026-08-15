import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  generateWorkspaceSlug,
  createAutoWorkspaceDir,
  createNewSession,
  updateSessionWorkspace,
  loadSession,
  deleteSession,
  rollbackSession,
  saveSession,
} from '../server/session';
import { initPersonas, setActivePersona, listPersonas } from '../server/personas';
import { isAutoWorkspace, getWorkspaceBaseName } from '../src/utils/helpers';
import { ttsService } from '../server/ttsService';

describe('Workspace & Persona Synchronization Test Suite', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
    ttsService.setMuted(true);
    initPersonas();
  });

  describe('1. Auto-Workspace Engine (Slug & Sandbox Creation)', () => {
    it('should generate unique, readable slugs matching adjective-noun-id pattern', () => {
      const s1 = generateWorkspaceSlug();
      const s2 = generateWorkspaceSlug();
      assert.ok(s1 && s1.length > 5);
      assert.ok(s2 && s2.length > 5);
      assert.notEqual(s1, s2);
      assert.ok(s1.split('-').length >= 3);
    });

    it('should create an isolated workspace directory in ~/.0xagent/workspaces/', async () => {
      const auto = await createAutoWorkspaceDir();
      assert.ok(auto.slug);
      assert.ok(auto.path);
      assert.ok(fs.existsSync(auto.path));
      assert.equal(isAutoWorkspace(auto.path), true);
      assert.equal(getWorkspaceBaseName(auto.path), auto.slug);

      // Cleanup
      try {
        await fs.promises.rm(auto.path, { recursive: true, force: true });
      } catch {}
    });
  });

  describe('2. Session Workspace Isolation & Management', () => {
    let createdSessionId: string | null = null;

    it('should create a session with an auto-generated workspace sandbox', async () => {
      const session = await createNewSession('Auto Test', 'auto');
      assert.ok(session.id);
      assert.ok(session.workspace_dir);
      assert.equal(isAutoWorkspace(session.workspace_dir), true);
      createdSessionId = session.id;
    });

    it('should create a standalone session without workspace (null)', async () => {
      const session = await createNewSession('No WS Test', null);
      assert.ok(session.id);
      assert.equal(session.workspace_dir, null);
      await deleteSession(session.id);
    });

    it('should update and switch workspace on an existing session dynamically', async () => {
      assert.ok(createdSessionId);
      const newAuto = await createAutoWorkspaceDir();
      const updated = await updateSessionWorkspace(createdSessionId, newAuto.path);
      assert.ok(updated);
      assert.equal(updated.workspace_dir, newAuto.path);

      // Verify reloaded from disk
      const reloaded = await loadSession(createdSessionId);
      assert.ok(reloaded);
      assert.equal(reloaded.workspace_dir, newAuto.path);

      // Detach to standalone
      const detached = await updateSessionWorkspace(createdSessionId, null);
      assert.ok(detached);
      assert.equal(detached.workspace_dir, null);

      await deleteSession(createdSessionId);
    });

    it('should rollback session context to user message for editing', async () => {
      const sess = await createNewSession('Rollback Test');
      sess.messages = [
        { id: 'm1', role: 'user', content: 'Prompt 1', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Answer 1', timestamp: 2000 },
        { id: 'm3', role: 'user', content: 'Prompt 2 to edit', timestamp: 3000 },
        { id: 'm4', role: 'assistant', content: 'Answer 2', timestamp: 4000 },
      ];
      await saveSession(sess);

      const rollback = await rollbackSession(sess.id, 'm3', 'to_user_edit');
      assert.equal(rollback.restoredContent, 'Prompt 2 to edit');
      assert.equal(rollback.session.messages.length, 2);
      assert.equal(rollback.session.messages[0].id, 'm1');
      assert.equal(rollback.session.messages[1].id, 'm2');

      await deleteSession(sess.id);
    });

    it('should rollback session context to assistant message checkpoint', async () => {
      const sess = await createNewSession('Rollback Assistant Test');
      sess.messages = [
        { id: 'm1', role: 'user', content: 'Prompt 1', timestamp: 1000 },
        { id: 'm2', role: 'assistant', content: 'Answer 1', timestamp: 2000 },
        { id: 'm3', role: 'user', content: 'Prompt 2', timestamp: 3000 },
        { id: 'm4', role: 'assistant', content: 'Answer 2', timestamp: 4000 },
      ];
      await saveSession(sess);

      const rollback = await rollbackSession(sess.id, 'm2', 'to_assistant');
      assert.equal(rollback.session.messages.length, 2);
      assert.equal(rollback.session.messages[0].id, 'm1');
      assert.equal(rollback.session.messages[1].id, 'm2');

      await deleteSession(sess.id);
    });
  });

  describe('3. Persona Persistence & Real-time Synchronization', () => {
    it('should activate persona and mark is_active in metadata list', () => {
      const personas = listPersonas();
      assert.ok(personas.length > 0);

      const targetPersona = personas.find((p) => p.id !== 'default') || personas[0];
      const updatedList = setActivePersona(targetPersona.id);
      const activeItem = updatedList.find((p) => p.id === targetPersona.id);
      assert.ok(activeItem);
      assert.equal(activeItem.is_active, true);

      // Verify other personas are marked inactive
      const others = updatedList.filter((p) => p.id !== targetPersona.id);
      others.forEach((p) => {
        assert.equal(p.is_active, false);
      });
    });
  });
});
