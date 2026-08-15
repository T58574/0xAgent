import { Router } from 'express';
import {
  listPersonas,
  getPersonaDetail,
  setActivePersona,
  createPersona,
  updatePersonaFile,
  updatePersonaMetadata,
  deletePersona,
} from '../personas';
import { loadSummarizerPrompt, saveSummarizerPrompt } from '../summarizer';
import { getToolsState, saveToolsToggles, saveCustomToolsMd } from '../toolsConfig';

export function createPersonasRouter(broadcast?: (event: string, payload: any) => void) {
  const router = Router();

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

