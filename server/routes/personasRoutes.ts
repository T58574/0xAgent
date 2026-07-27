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

export const personasRouter = Router();

personasRouter.get('/personas', (_req, res) => {
  try {
    const personas = listPersonas();
    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.get('/personas/:id', (req, res) => {
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

personasRouter.post('/personas', (req, res) => {
  try {
    const { name, description, icon } = req.body || {};
    const created = createPersona(name, description, icon);
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/personas/:id/activate', (req, res) => {
  try {
    const personas = setActivePersona(req.params.id);
    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/personas/:id/file', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!['SOUL.md', 'TOOLS.md', 'USER.md'].includes(filename)) {
      res.status(400).json({ error: 'Filename must be SOUL.md, TOOLS.md, or USER.md' });
      return;
    }
    const updated = updatePersonaFile(req.params.id, filename, content || '');
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/personas/:id/meta', (req, res) => {
  try {
    const updated = updatePersonaMetadata(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.delete('/personas/:id', (req, res) => {
  try {
    deletePersona(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.get('/summarizer-prompt', (_req, res) => {
  try {
    const content = loadSummarizerPrompt();
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/summarizer-prompt', (req, res) => {
  try {
    const { content } = req.body;
    saveSummarizerPrompt(content || '');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tools System API Endpoints
personasRouter.get('/tools', (_req, res) => {
  try {
    const state = getToolsState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/tools/toggles', (req, res) => {
  try {
    const { toggles } = req.body || {};
    const state = saveToolsToggles(toggles || {});
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

personasRouter.post('/tools/md', (req, res) => {
  try {
    const { content } = req.body || {};
    const state = saveCustomToolsMd(content || '');
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
