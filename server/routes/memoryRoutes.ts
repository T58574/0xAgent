import { Router } from 'express';
import { loadMemories, addOrUpdateMemory, deleteMemory, queryMemories } from '../memory';

export const memoryRouter = Router();

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
    const { key, value, category } = req.body;
    const item = addOrUpdateMemory(key, value, category);
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
