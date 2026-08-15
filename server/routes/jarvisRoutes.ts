import { Router, Request, Response } from 'express';
import { proactiveCompanion } from '../agent/proactiveCompanion';
import { jarvisSupervisor } from '../agent/jarvisSupervisor';
import { ttsService } from '../ttsService';
import { voiceDaemonManager } from '../agent/voiceDaemonManager';
import { loadConfig, saveConfig } from '../config';
import { voiceMacroService } from '../agent/voiceMacroService';

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
      formData.append('model', 'whisper-large-v3');
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

      if (!groqRes.ok) {
        const fallbackData = new FormData();
        fallbackData.append('file', new File([audioBuffer], 'voice_recording.wav', { type: 'audio/wav' }));
        fallbackData.append('model', 'whisper-large-v3-turbo');
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
      // 1. Clean leading greetings ("Слушаю вас, сэр...") and trailing stop words
      const { cleanText, isOnlyGreeting } = ttsService.cleanLeadingJarvisPhrase(transcribedText);

      if (isOnlyGreeting || !cleanText) {
        jarvisSupervisor.logActivity('System', `Filtered self-echo Jarvis greeting: "${transcribedText}"`, 'info');
        voiceDaemonManager.broadcastState('idle');
        res.json({ success: true, text: '', filtered: true });
        return;
      }

      // 2. Check for Windows Voice Macros (Media Play/Pause, Volume, Window controls, App Launchers)
      const macro = voiceMacroService.processCommand(cleanText);
      if (macro.handled) {
        jarvisSupervisor.logActivity('System', `⚡ Voice Macro: "${cleanText}" -> ${macro.description}`, 'success');
        if (config.tts_config?.enabled) {
          ttsService.playCategory('macro', config.tts_config).catch(() => {});
        }
        if ((jarvisSupervisor as any).wsBroadcaster) {
          (jarvisSupervisor as any).wsBroadcaster('jarvis_voice_transcribed', {
            text: `[CMD] ${cleanText} (⚡ ${macro.description})`,
          });
        }
        voiceDaemonManager.broadcastState('idle', { lastText: cleanText, macro: macro.description });
        res.json({ success: true, text: cleanText, macro: macro.description });
        return;
      }

      // 3. User Command / Question for AI Agent
      jarvisSupervisor.logActivity('System', `Voice Command: "${cleanText}"`, 'info');
      if ((jarvisSupervisor as any).wsBroadcaster) {
        (jarvisSupervisor as any).wsBroadcaster('jarvis_voice_transcribed', { text: cleanText });
      }
      voiceDaemonManager.broadcastState('idle', { lastText: cleanText });
      res.json({ success: true, text: cleanText });
    } else {
      voiceDaemonManager.broadcastState('idle');
      res.json({ success: false, text: '' });
    }
  } catch (err: any) {
    voiceDaemonManager.broadcastState('idle');
    res.status(500).json({ error: err?.message || 'Voice transcription failed' });
  }
});

// Voice daemon status & manual record controls
jarvisRouter.get('/jarvis/voice-daemon/status', (_req: Request, res: Response) => {
  res.json({ running: voiceDaemonManager.isRunning() });
});

jarvisRouter.post('/jarvis/voice-record/start', async (_req: Request, res: Response) => {
  const config = loadConfig();
  if (config.tts_config?.enabled) {
    ttsService.playCategory('listening', config.tts_config).catch(() => {});
  }
  const ok = await voiceDaemonManager.startRecording();
  res.json({ success: ok, state: 'recording' });
});

jarvisRouter.post('/jarvis/voice-record/stop', async (_req: Request, res: Response) => {
  const ok = await voiceDaemonManager.stopRecording();
  res.json({ success: ok, state: 'processing' });
});

jarvisRouter.post('/jarvis/voice-record/toggle', async (_req: Request, res: Response) => {
  const ok = await voiceDaemonManager.toggleRecording();
  res.json({ success: ok });
});

// Update voice daemon state from python process
jarvisRouter.post('/jarvis/voice-state', (req: Request, res: Response) => {
  const { state, extra } = req.body;
  if (state) {
    voiceDaemonManager.broadcastState(state, extra);
  }
  res.json({ success: true });
});

jarvisRouter.post('/jarvis/voice-daemon/toggle', (req: Request, res: Response) => {
  const { enable } = req.body;
  const config = loadConfig();
  if (!config.tts_config) {
    config.tts_config = {
      enabled: true,
      voice: 'ru-RU-DmitryNeural',
      rate: '+15%',
      pitch: '-5Hz',
      play_on_speaker: true,
      play_in_browser: true,
      wake_word_enabled: Boolean(enable),
    };
  } else {
    config.tts_config.wake_word_enabled = Boolean(enable);
  }
  saveConfig(config);

  if (enable) {
    const ok = voiceDaemonManager.start();
    res.json({ success: ok, running: voiceDaemonManager.isRunning() });
  } else {
    voiceDaemonManager.stop();
    res.json({ success: true, running: false });
  }
});
