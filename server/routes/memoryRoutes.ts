import { Router } from 'express';
import {
  loadMemories,
  addOrUpdateMemory,
  deleteMemory,
  queryMemories,
  getCandidateMemories,
  resolveConflict,
  saveEpisode,
  searchEpisodesFts,
  getPersonaRelationship,
  upsertPersonaRelationship,
} from '../memory';

export const memoryRouter = Router();

// Canonical active memories (compatible with existing frontend)
memoryRouter.get('/memories', (req, res) => {
  try {
    const query = req.query.query as string;
    const list = query ? queryMemories(query) : loadMemories();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRouter.post('/memories', (req, res) => {
  try {
    const { key, value, category, domain, importance, is_explicit } = req.body;
    const item = addOrUpdateMemory(key, value, category, {
      domain,
      importance,
      isExplicit: is_explicit !== undefined ? is_explicit : true,
    });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRouter.delete('/memories/:id', (req, res) => {
  try {
    const success = deleteMemory(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Candidate memories review
memoryRouter.get('/memories/candidates', (_req, res) => {
  try {
    const candidates = getCandidateMemories();
    res.json(candidates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRouter.post('/memories/resolve', (req, res) => {
  try {
    const { memoryId, resolution, reason } = req.body;
    const success = resolveConflict(memoryId, resolution, reason);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Episodes
memoryRouter.get('/memories/episodes', (req, res) => {
  try {
    const query = (req.query.query as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const results = searchEpisodesFts(query, limit);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRouter.post('/memories/episodes', (req, res) => {
  try {
    const { sessionId, title, summary, importance, eventTimestamp } = req.body;
    const ep = saveEpisode({
      sessionId: sessionId || 'manual',
      title,
      summary,
      importance,
      eventTimestamp,
    });
    res.json(ep);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Persona Relationships
memoryRouter.get('/memories/relationships/:personaId', (req, res) => {
  try {
    const rel = getPersonaRelationship(req.params.personaId);
    res.json(rel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRouter.post('/memories/relationships/:personaId', (req, res) => {
  try {
    const rel = upsertPersonaRelationship({
      persona_id: req.params.personaId,
      ...req.body,
    });
    res.json(rel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
