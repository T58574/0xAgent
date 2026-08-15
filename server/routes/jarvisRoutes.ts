import { Router, Request, Response } from 'express';
import { proactiveCompanion } from '../agent/proactiveCompanion';
import { jarvisSupervisor } from '../agent/jarvisSupervisor';
import { ttsService } from '../ttsService';
import { voiceDaemonManager } from '../agent/voiceDaemonManager';
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

// Voice Wake triggered by native desktop daemon
jarvisRouter.post('/jarvis/voice-wake', async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    jarvisSupervisor.logActivity('System', 'Wake-word detected via desktop daemon: «Джарвис»', 'info');
    
    // 1. Immediately play acknowledgment in Dmitry voice
    const phrase = await ttsService.playCategory('listening', config.tts_config);
    
    // 2. Broadcast state to WebSocket clients
    voiceDaemonManager.broadcastState('recording', { phrase });
    
    res.json({ success: true, phrase });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Voice wake trigger failed' });
  }
});

// Voice Input (WAV base64) from desktop daemon for transcription
jarvisRouter.post('/jarvis/voice-input', async (req: Request, res: Response) => {
  try {
    const { audioBase64 } = req.body;
    const config = loadConfig();
    const effectiveKey = (config.groq_api_key || process.env.GROQ_API_KEY || '').trim();

    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 required' });
      return;
    }

    voiceDaemonManager.broadcastState('processing');

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    let transcribedText = '';

    if (effectiveKey) {
      const formData = new FormData();
      const file = new File([audioBuffer], 'voice_recording.wav', { type: 'audio/wav' });
      formData.append('file', file);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'ru');
      formData.append('response_format', 'json');
      formData.append('temperature', '0.0');

      const groqEndpoint = process.env.GROQ_STT_ENDPOINT || 'https://api.groq.com/openai/v1/audio/transcriptions';
      let groqRes = await fetch(groqEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveKey}`,
        },
        body: formData,
      });

      if (!groqRes.ok && groqRes.status === 404) {
        const fallbackData = new FormData();
        fallbackData.append('file', new File([audioBuffer], 'voice_recording.wav', { type: 'audio/wav' }));
        fallbackData.append('model', 'whisper-large-v3');
        fallbackData.append('language', 'ru');
        groqRes = await fetch(groqEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveKey}`,
          },
          body: fallbackData,
        });
      }

      if (groqRes.ok) {
        const data: any = await groqRes.json();
        transcribedText = (data.text || '').trim();
      }
    }

    if (transcribedText) {
      jarvisSupervisor.logActivity('System', `Voice Command: "${transcribedText}"`, 'info');
      // Broadcast transcribed event to frontend
      if ((jarvisSupervisor as any).wsBroadcaster) {
        (jarvisSupervisor as any).wsBroadcaster('jarvis_voice_transcribed', { text: transcribedText });
      }
      voiceDaemonManager.broadcastState('idle', { lastText: transcribedText });
      res.json({ success: true, text: transcribedText });
    } else {
      voiceDaemonManager.broadcastState('idle');
      res.json({ success: false, text: '' });
    }
  } catch (err: any) {
    voiceDaemonManager.broadcastState('idle');
    res.status(500).json({ error: err?.message || 'Voice transcription failed' });
  }
});

// Voice daemon status & toggle
jarvisRouter.get('/jarvis/voice-daemon/status', (_req: Request, res: Response) => {
  res.json({ running: voiceDaemonManager.isRunning() });
});

jarvisRouter.post('/jarvis/voice-daemon/toggle', (req: Request, res: Response) => {
  const { enable } = req.body;
  if (enable) {
    const ok = voiceDaemonManager.start();
    res.json({ success: ok, running: voiceDaemonManager.isRunning() });
  } else {
    voiceDaemonManager.stop();
    res.json({ success: true, running: false });
  }
});
