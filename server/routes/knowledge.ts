import { Router, Request, Response } from 'express';
import {
  saveKnowledgeEntry,
  getKnowledgeEntry,
  deleteKnowledgeEntry,
  queryKnowledgeEntries,
  listKnowledgeCategories
} from '../knowledgeBase';

const router = Router();

// GET /api/knowledge/categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await listKnowledgeCategories();
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list categories' });
  }
});

// GET /api/knowledge/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const entry = await getKnowledgeEntry(id);
    if (!entry) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch knowledge entry' });
  }
});

// GET /api/knowledge
router.get('/', async (req: Request, res: Response) => {
  try {
    const { query, category, tag, startDate, endDate } = req.query;
    const entries = await queryKnowledgeEntries({
      query: typeof query === 'string' ? query : undefined,
      category: typeof category === 'string' ? category : undefined,
      tag: typeof tag === 'string' ? tag : undefined,
      startDate: typeof startDate === 'string' ? Number(startDate) : undefined,
      endDate: typeof endDate === 'string' ? Number(endDate) : undefined,
    });
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to query knowledge entries' });
  }
});

// POST /api/knowledge
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, category, content, summary, tags, source, id } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const entry = await saveKnowledgeEntry({
      title,
      category,
      content,
      summary,
      tags: Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : [],
      source,
      id
    });
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save knowledge entry' });
  }
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const success = await deleteKnowledgeEntry(id);
    if (!success) {
      return res.status(404).json({ error: 'Knowledge entry not found or already deleted' });
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete knowledge entry' });
  }
});

export default router;
