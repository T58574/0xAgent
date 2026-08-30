import { Router } from 'express';
import {
  listPersonas,
  getPersonaDetail,
  setActivePersona,
  createPersona,
  updatePersonaFile,
  updatePersonaMetadata,
  deletePersona,
  proposePersonaChange,
  listPersonaProposals,
  getPersonaProposal,
  approvePersonaProposal,
  rejectPersonaProposal,
  applyPersonaProposal,
  listPersonaFileVersions,
  rollbackPersonaFile,
  getProjectSystemPrompts,
} from '../personas';
import { loadSummarizerPrompt, saveSummarizerPrompt } from '../summarizer';
import { getToolsState, saveToolsToggles, saveCustomToolsMd } from '../toolsConfig';
import { runEvaluationHarness } from '../evalHarness';
import { runMemoryDecayCycle } from '../agent/memoryDecayWorker';
import { getEvolutionDashboardSummary, getRecentEvolutionTelemetry } from '../analyticsService';

export function createPersonasRouter(broadcast?: (event: string, payload: any) => void) {
  const router = Router();

  router.get('/eval/benchmark', (_req, res) => {
    try {
      const summary = runEvaluationHarness();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/personas', (_req, res) => {
    try {
      const personas = listPersonas();
      res.json(personas);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/personas/:id', (req, res) => {
    try {
      const detail = getPersonaDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: 'Persona not found' });
        return;
      }
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas', (req, res) => {
    try {
      const { name, description, icon } = req.body || {};
      const created = createPersona(name, description, icon);
      if (broadcast) {
        broadcast('persona-changed', { activePersonaId: req.body?.is_active ? created.metadata.id : undefined, personas: listPersonas() });
      }
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/activate', (req, res) => {
    try {
      const personas = setActivePersona(req.params.id);
      if (broadcast) {
        broadcast('persona-changed', { activePersonaId: req.params.id, personas });
      }
      res.json(personas);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/file', (req, res) => {
    try {
      const { filename, content } = req.body;
      if (!['SOUL.md', 'TOOLS.md', 'USER.md'].includes(filename)) {
        res.status(400).json({ error: 'Filename must be SOUL.md, TOOLS.md, or USER.md' });
        return;
      }
      const updated = updatePersonaFile(req.params.id, filename, content || '');
      if (broadcast) {
        broadcast('persona-changed', { activePersonaId: req.params.id, personas: listPersonas() });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/meta', (req, res) => {
    try {
      const updated = updatePersonaMetadata(req.params.id, req.body);
      if (broadcast) {
        broadcast('persona-changed', { activePersonaId: req.params.id, personas: listPersonas() });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/personas/:id', (req, res) => {
    try {
      deletePersona(req.params.id);
      if (broadcast) {
        broadcast('persona-changed', { personas: listPersonas() });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proposal Pipeline Routes
  router.get('/personas/:id/proposals', (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const proposals = listPersonaProposals(req.params.id, status);
      res.json(proposals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/personas/:id/proposals/:proposalId', (req, res) => {
    try {
      const proposal = getPersonaProposal(req.params.proposalId);
      if (!proposal) {
        res.status(404).json({ error: 'Proposal not found' });
        return;
      }
      res.json(proposal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/proposals', (req, res) => {
    try {
      const { target_file, target_section, operation, patch_payload, rationale, base_content_sha256, source_type } = req.body;
      const result = proposePersonaChange({
        persona_id: req.params.id,
        target_file: target_file || 'SOUL.md',
        target_section,
        operation: operation || 'append',
        patch_payload: patch_payload || {},
        rationale,
        source_type: source_type || 'user',
        base_content_sha256,
      });

      if (!result.ok) {
        res.status(400).json(result);
        return;
      }

      if (broadcast) {
        broadcast('persona-proposal-created', { proposal: result.proposal });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/proposals/:proposalId/approve', (req, res) => {
    try {
      const approved = approvePersonaProposal(req.params.proposalId);
      if (broadcast) {
        broadcast('persona-proposal-updated', { proposal: approved });
      }
      res.json(approved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/proposals/:proposalId/reject', (req, res) => {
    try {
      const { reason } = req.body || {};
      const rejected = rejectPersonaProposal(req.params.proposalId, reason);
      if (broadcast) {
        broadcast('persona-proposal-updated', { proposal: rejected });
      }
      res.json(rejected);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/proposals/:proposalId/apply', (req, res) => {
    try {
      const forceOverride = Boolean(req.body?.forceOverride);
      const applied = applyPersonaProposal(req.params.proposalId, { forceOverride });
      if (applied.ok && broadcast) {
        broadcast('persona-changed', { activePersonaId: req.params.id, personas: listPersonas() });
      }
      res.json(applied);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Memory Decay & Hygiene Cycle Trigger
  router.post('/personas/decay/cycle', async (_req, res) => {
    try {
      const stats = await runMemoryDecayCycle();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Evolution Telemetry & Analytics
  router.get('/analytics/evolution', (req, res) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const summary = getEvolutionDashboardSummary(days);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/analytics/evolution/telemetry', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const telemetry = getRecentEvolutionTelemetry(limit);
      res.json(telemetry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // History & Rollback Routes
  router.get('/personas/:id/history', (req, res) => {
    try {
      const file = req.query.file as any;
      const history = listPersonaFileVersions(req.params.id, file);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/personas/:id/rollback', (req, res) => {
    try {
      const { file, version_id } = req.body;
      if (!file || !version_id) {
        res.status(400).json({ error: 'file and version_id are required' });
        return;
      }
      const rollback = rollbackPersonaFile(req.params.id, file, version_id);
      if (broadcast) {
        broadcast('persona-changed', { activePersonaId: req.params.id, personas: listPersonas() });
      }
      res.json(rollback);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system-prompts', (_req, res) => {
    try {
      const prompts = getProjectSystemPrompts();
      res.json(prompts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/summarizer-prompt', (_req, res) => {
    try {
      const content = loadSummarizerPrompt();
      res.json({ content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/summarizer-prompt', (req, res) => {
    try {
      const { content } = req.body;
      saveSummarizerPrompt(content || '');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tools System API Endpoints
  router.get('/tools', (_req, res) => {
    try {
      const state = getToolsState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tools/toggles', (req, res) => {
    try {
      const { toggles } = req.body || {};
      const state = saveToolsToggles(toggles || {});
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tools/md', (req, res) => {
    try {
      const { content } = req.body || {};
      const state = saveCustomToolsMd(content || '');
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export const personasRouter = createPersonasRouter();

