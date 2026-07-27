import { Router } from 'express';
import { listSkills, readSkill, writeSkill, deleteSkill } from '../skills';

export const skillsRouter = Router();

skillsRouter.get('/skills', (_req, res) => {
  try {
    const skills = listSkills();
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillsRouter.get('/skills/:name', (req, res) => {
  try {
    const content = readSkill(req.params.name);
    res.json({ name: req.params.name, content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

skillsRouter.post('/skills/:name', (req, res) => {
  try {
    const { content } = req.body;
    writeSkill(req.params.name, content || '');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillsRouter.delete('/skills/:name', (req, res) => {
  try {
    deleteSkill(req.params.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
