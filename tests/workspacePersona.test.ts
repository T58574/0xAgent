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
} from '../server/session';
import { initPersonas, setActivePersona, listPersonas } from '../server/personas';
import { isAutoWorkspace, getWorkspaceBaseName } from '../src/utils/helpers';
import { ttsService } from '../server/ttsService';

describe('Workspace & Persona Synchronization Test Suite', () => {
  before(() => {
    ttsService.setMuted(true);
    initPersonas();
  });

  describe('1. Auto-Workspace Engine (Slug & Sandbox Creation)', () => {
    it('should generate unique, readable slugs matching adjective-noun-id pattern', () => {
      const s1 = generateWorkspaceSlug();
      const s2 = generateWorkspaceSlug();
      assert.ok(typeof s1 === 'string' && s1.length > 5);
      assert.notEqual(s1, s2);
      assert.match(s1, /^[a-z]+-[a-z]+-[a-z0-9]{2,6}$/);
    });

    it('should create an isolated workspace directory in ~/.0xagent/workspaces/', async () => {
      const autoWs = await createAutoWorkspaceDir();
      assert.ok(autoWs.slug);
      assert.ok(fs.existsSync(autoWs.path), 'Workspace directory must exist on disk');
      assert.ok(isAutoWorkspace(autoWs.path), 'isAutoWorkspace helper must recognize auto-workspace path');
      assert.equal(getWorkspaceBaseName(autoWs.path), autoWs.slug);
    });
  });

  describe('2. Session Workspace Isolation & Management', () => {
    let createdSessionId: string | null = null;

    it('should create a session with an auto-generated workspace sandbox', async () => {
      const session = await createNewSession('Auto WS Session', 'auto');
      createdSessionId = session.id;
      assert.ok(session.id);
      assert.ok(session.workspace_dir, 'Auto session must have workspace_dir set');
      assert.ok(fs.existsSync(session.workspace_dir), 'Session workspace must exist on filesystem');
      assert.ok(isAutoWorkspace(session.workspace_dir));
    });

    it('should create a standalone session without workspace (null)', async () => {
      const standalone = await createNewSession('Standalone Session', null);
      assert.ok(standalone.id);
      assert.equal(standalone.workspace_dir, null, 'Standalone session workspace_dir must be null');
      assert.equal(isAutoWorkspace(standalone.workspace_dir), false);
      assert.equal(getWorkspaceBaseName(standalone.workspace_dir), 'Без папки');
      await deleteSession(standalone.id);
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
