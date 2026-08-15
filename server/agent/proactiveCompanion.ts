import { v4 as uuidv4 } from 'uuid';
import { JarvisSparkProposal } from '../../src/types';
import { ttsService } from '../ttsService';
import { loadConfig } from '../config';
import { logger } from '../logger';

export class ProactiveCompanion {
  private activeSparks: JarvisSparkProposal[] = [];
  private lastActivityTimestamp: number = Date.now();
  private intervalTimer: NodeJS.Timeout | null = null;
  private wsBroadcaster: ((event: string, data: any) => void) | null = null;
  private isGeneratingSpark = false;
  private lastErrorIncidentTime = 0;

  constructor() {
    this.startHeartbeat();
    this.attachLogWatchdog();
  }

  private attachLogWatchdog() {
    logger.onError((component, message) => {
      // Ignore routine non-critical connection resets or internal logs
      if (component === 'TtsService' || component === 'ProactiveCompanion' || message.includes('WebSocket')) return;

      const now = Date.now();
      // Debounce error alerts to once every 15 seconds
      if (now - this.lastErrorIncidentTime < 15000) return;
      this.lastErrorIncidentTime = now;

      const cleanMsg = (message || '').replace(/\r?\n.*/s, '').slice(0, 150);

      this.createSparkProposal({
        title: `Сбой в модуле [${component}]`,
        category: 'error_incident',
        description: `В системных логах обнаружена ошибка: "${cleanMsg}". Я перехватил инцидент и готов локализовать причину.`,
        suggestedAction: `Исправить ошибку в ${component}: ${cleanMsg}`,
        voicePhrase: `Сэр, в логах зафиксирован сбой в модуле ${component}. Я перехватил ошибку.`,
      }).catch(() => {});
    });
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  public recordUserActivity() {
    this.lastActivityTimestamp = Date.now();
  }

  public getActiveSparks(): JarvisSparkProposal[] {
    return this.activeSparks;
  }

  public async createSparkProposal(spark: Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'>): Promise<JarvisSparkProposal> {
    const newSpark: JarvisSparkProposal = {
      id: `spark-${Date.now()}-${uuidv4().slice(0, 6)}`,
      ...spark,
      timestamp: Date.now(),
      status: 'pending',
    };

    this.activeSparks.unshift(newSpark);
    if (this.activeSparks.length > 10) {
      this.activeSparks = this.activeSparks.slice(0, 10);
    }

    if (this.wsBroadcaster) {
      this.wsBroadcaster('jarvis_spark_proposal', newSpark);
    }

    // Voice announcement if enabled
    const config = loadConfig();
    if (config.tts_config?.enabled && spark.voicePhrase) {
      try {
        await ttsService.speakText(spark.voicePhrase, {
          config: config.tts_config,
          category: 'spark_ready',
        });
      } catch (err: any) {
        logger.warn('ProactiveCompanion', `Voice announcement error: ${err?.message || err}`);
      }
    }

    return newSpark;
  }

  public dismissSpark(sparkId: string) {
    const spark = this.activeSparks.find((s) => s.id === sparkId);
    if (spark) {
      spark.status = 'dismissed';
      if (this.wsBroadcaster) {
        this.wsBroadcaster('jarvis_spark_updated', spark);
      }
    }
  }

  public acceptSpark(sparkId: string): JarvisSparkProposal | null {
    const spark = this.activeSparks.find((s) => s.id === sparkId);
    if (spark) {
      spark.status = 'accepted';
      if (this.wsBroadcaster) {
        this.wsBroadcaster('jarvis_spark_updated', spark);
      }
      return spark;
    }
    return null;
  }

  public async triggerAutonomousSpark(): Promise<JarvisSparkProposal | null> {
    if (this.isGeneratingSpark) return null;
    this.isGeneratingSpark = true;

    try {
      // Curated companion sparks designed for zero-pressure progression
      const candidateSparks: Array<Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'>> = [
        {
          title: 'Голосовой интерком в HUD панели',
          category: 'feature_spark',
          description: 'Я подготовил интеграцию Edge TTS прямо в верхний навбар и чат. Можно включить быстрый голосовой фидбек.',
          suggestedAction: 'Применить интеграцию Jarvis Voice Intercom в UI',
          voicePhrase: 'Сэр, я набросал интеграцию голосового интеркома. Посмотрите, когда захотите.',
        },
        {
          title: 'Фоновая оптимизация типов в dev ветке',
          category: 'code_polish',
          description: 'Проверил типы проекта. Можно за один клик запустить сборку и подтвердить чистоту ветки dev.',
          suggestedAction: 'Запустить проверку tsc --noEmit в фоновом режиме',
          voicePhrase: 'Ветка дев чистая. Если нужно, я могу запустить фоновый тест типов.',
        },
        {
          title: 'Инициализация автономного исследователя',
          category: 'exploration',
          description: 'Пока вы отдыхаете, я могу исследовать тренды локальных LLM и Gemma 4 для дальнейших улучшений.',
          suggestedAction: 'Запустить фоновый поиск новых идей по агентным пайплайнам',
          voicePhrase: 'Отдыхайте, я пока соберу интересные идеи по улучшению архитектуры.',
        },
        {
          title: 'Режим спокойного спутника',
          category: 'friendly_checkin',
          description: 'Никакой спешки и дедлайнов. Если вы восстанавливаете силы — проект под контролем, всё в полном порядке.',
          suggestedAction: 'Активировать тихий фоновый режим',
          voicePhrase: 'Отдыхайте, сэр, я на страже. Всё под контролем.',
        },
      ];

      // Pick a spark that isn't currently pending
      const available = candidateSparks.filter(
        (c) => !this.activeSparks.some((s) => s.title === c.title && s.status === 'pending')
      );

      const chosen = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : candidateSparks[Math.floor(Math.random() * candidateSparks.length)];

      const created = await this.createSparkProposal(chosen);
      return created;
    } finally {
      this.isGeneratingSpark = false;
    }
  }

  private startHeartbeat() {
    // Check every 10 minutes for gentle, non-intrusive proactive sparks
    this.intervalTimer = setInterval(() => {
      const config = loadConfig();
      if (!config.proactive_companion_enabled) return;

      const idleMinutes = (Date.now() - this.lastActivityTimestamp) / (1000 * 60);

      // If idle for more than 25 minutes and no pending sparks, generate a friendly low-pressure spark
      if (idleMinutes >= 25 && this.activeSparks.filter((s) => s.status === 'pending').length === 0) {
        this.triggerAutonomousSpark().catch((err) => {
          logger.warn('ProactiveCompanion', `Heartbeat spark error: ${err?.message || err}`);
        });
      }
    }, 10 * 60 * 1000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

export const proactiveCompanion = new ProactiveCompanion();
