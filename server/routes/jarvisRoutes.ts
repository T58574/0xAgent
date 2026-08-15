import { Router, Request, Response } from 'express';
import { proactiveCompanion } from '../agent/proactiveCompanion';
import { jarvisSupervisor } from '../agent/jarvisSupervisor';
import { ttsService } from '../ttsService';
import { loadConfig } from '../config';

export const jarvisRouter = Router();

// Speak text using Edge-TTS
jarvisRouter.post('/jarvis/speak', async (req: Request, res: Response) => {
  try {
    const { text, voice, rate, pitch, category, playOnSpeaker } = req.body;
    const config = loadConfig();
    const result = await ttsService.speakText(text, {
      voice,
      rate,
      pitch,
      category,
      playOnSpeaker,
      config: config.tts_config,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'TTS playback failed' });
  }
});

// Play predefined category phrase (e.g. 'greeting', 'spark_ready', 'companion_calm')
jarvisRouter.post('/jarvis/speak-category', async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    const config = loadConfig();
    const phrase = await ttsService.playCategory(category || 'greeting', config.tts_config);
    res.json({ success: true, phrase });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'TTS category playback failed' });
  }
});

// Stop active voice playback
jarvisRouter.post('/jarvis/stop-voice', (_req: Request, res: Response) => {
  ttsService.stopLocalPlayback();
  res.json({ success: true });
});

// Get current Jarvis & Companion status
jarvisRouter.get('/jarvis/status', (_req: Request, res: Response) => {
  const state = jarvisSupervisor.getState();
  res.json(state);
});

// Trigger autonomous spark generation on-demand
jarvisRouter.post('/jarvis/spark/generate', async (_req: Request, res: Response) => {
  try {
    const spark = await proactiveCompanion.triggerAutonomousSpark();
    res.json({ success: true, spark });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Spark generation failed' });
  }
});

// Accept a spark proposal
jarvisRouter.post('/jarvis/spark/:id/accept', (req: Request, res: Response) => {
  const sparkId = String(req.params.id);
  const spark = proactiveCompanion.acceptSpark(sparkId);
  if (!spark) {
    res.status(404).json({ error: 'Spark proposal not found' });
    return;
  }
  res.json({ success: true, spark });
});

// Dismiss a spark proposal
jarvisRouter.post('/jarvis/spark/:id/dismiss', (req: Request, res: Response) => {
  const sparkId = String(req.params.id);
  proactiveCompanion.dismissSpark(sparkId);
  res.json({ success: true });
});
