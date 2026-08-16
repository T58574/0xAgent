import { v4 as uuidv4 } from 'uuid';
import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { JarvisSparkProposal } from '../../src/types';
import { ttsService } from '../ttsService';
import { loadConfig } from '../config';
import { logger } from '../logger';

export function formatSparkDirectivePrompt(spark: Partial<JarvisSparkProposal>): string {
  const parts: string[] = [
    `# [JARVIS AUTONOMOUS INITIATIVE: ${spark.title || 'Инициатива Джарвиса'}]`,
    `**Категория:** ${spark.category || 'feature_spark'}`,
    `**Суть задачи:** ${spark.description || spark.suggestedAction || ''}`,
  ];

  if (spark.targetFiles && spark.targetFiles.length > 0) {
    parts.push(`**Целевые файлы:** ${spark.targetFiles.map((f) => `\`${f}\``).join(', ')}`);
  }

  if (spark.errorTrace && spark.errorTrace.trim()) {
    parts.push(`**Диагностика / Лог ошибки:**\n\`\`\`\n${spark.errorTrace.trim()}\n\`\`\``);
  }

  if (spark.contextSnippet && spark.contextSnippet.trim()) {
    parts.push(`**Контекст кода:**\n\`\`\`\n${spark.contextSnippet.trim()}\n\`\`\``);
  }

  parts.push(
    `\n## ДИРЕКТИВА АГЕНТУ:`,
    `1. Изучите задачу и контекст выше.`,
    spark.targetFiles && spark.targetFiles.length > 0
      ? `2. Используйте инструмент <read_file path="${spark.targetFiles[0]}" /> для инспекции точных строк.`
      : `2. Используйте <grep_search> или <read_file> для поиска релевантных файлов в рабочей области.`,
    `3. Сформируйте план и выполните необходимые изменения через <patch_file>, <write_file> или <execute_command>.`,
    `4. Проверьте результат сборки/тестов и кратко доложите о завершении.`
  );

  return parts.join('\n');
}

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
      if (component === 'TtsService' || component === 'ProactiveCompanion' || message.includes('WebSocket')) return;

      const config = loadConfig();
      if (config.proactive_companion_enabled === false) return;

      const now = Date.now();
      if (now - this.lastErrorIncidentTime < 15000) return;
      this.lastErrorIncidentTime = now;

      const cleanMsg = (message || '').replace(/\r?\n.*/s, '').slice(0, 150);
      const targetComponent = component.toLowerCase();

      const candidateFiles = [
        `server/${targetComponent}.ts`,
        `server/agent/${targetComponent}.ts`,
        `server/routes/${targetComponent}.ts`,
        `src/components/${component}.tsx`,
      ].filter((f) => fs.existsSync(path.join(process.cwd(), f)));

      const sparkData: Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'> = {
        title: `Сбой в модуле [${component}]`,
        category: 'error_incident',
        description: `В системных логах обнаружена ошибка: "${cleanMsg}". Джарвис перехватил инцидент для немедленной локализации.`,
        suggestedAction: `Исправить ошибку в модуле ${component}: ${cleanMsg}`,
        targetFiles: candidateFiles.length > 0 ? candidateFiles : undefined,
        errorTrace: message,
        voicePhrase: `Сэр, в логах зафиксирован сбой в модуле ${component}. Я перехватил инцидент.`,
      };
      sparkData.directivePrompt = formatSparkDirectivePrompt(sparkData);

      this.createSparkProposal(sparkData).catch(() => {});
    });
  }

  public setWsBroadcaster(broadcaster: (event: string, data: any) => void) {
    this.wsBroadcaster = broadcaster;
  }

  public recordUserActivity() {
    this.lastActivityTimestamp = Date.now();
  }

  public resetErrorIncidentThrottle(): void {
    this.lastErrorIncidentTime = 0;
  }

  public getActiveSparks(): JarvisSparkProposal[] {
    return this.activeSparks;
  }

  public async createSparkProposal(spark: Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'>): Promise<JarvisSparkProposal> {
    const directivePrompt = spark.directivePrompt || formatSparkDirectivePrompt(spark);
    const newSpark: JarvisSparkProposal = {
      id: `spark-${Date.now()}-${uuidv4().slice(0, 6)}`,
      ...spark,
      directivePrompt,
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

  private async scanWorkspaceForDynamicSparks(): Promise<Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'> | null> {
    const config = loadConfig();
    const cwd = config.workspace_dir && fs.existsSync(config.workspace_dir) ? config.workspace_dir : process.cwd();

    // 1. Check for uncommitted modified files in git
    const gitChanges = await new Promise<string[]>((resolve) => {
      exec('git status --short', { cwd, timeout: 3000 }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const files = lines.map((l) => l.replace(/^[MADRCU?!]+\s+/, '').trim()).filter(Boolean);
        resolve(files);
      });
    });

    if (gitChanges.length > 0) {
      const targetFiles = gitChanges.slice(0, 3);
      return {
        title: `Проверка и полировка измененных файлов (${gitChanges.length})`,
        category: 'code_polish',
        description: `В рабочей области обнаружены незакоммиченные файлы: ${targetFiles.join(', ')}. Джарвис готов проверить целостность сборки и тестов.`,
        suggestedAction: `Проверить сборку, типы и тесты для измененных файлов: ${targetFiles.join(', ')}`,
        targetFiles,
        contextSnippet: `Измененные файлы в git: \n${gitChanges.join('\n')}`,
        voicePhrase: `Сэр, в проекте есть измененные файлы. Могу запустить валидацию и тесты.`,
      };
    }

    return null;
  }

  public async triggerAutonomousSpark(): Promise<JarvisSparkProposal | null> {
    if (this.isGeneratingSpark) return null;
    this.isGeneratingSpark = true;

    try {
      // 1. Try real dynamic scan first
      const dynamicSpark = await this.scanWorkspaceForDynamicSparks();
      if (dynamicSpark && !this.activeSparks.some((s) => s.title === dynamicSpark.title && s.status === 'pending')) {
        return await this.createSparkProposal(dynamicSpark);
      }

      // 2. High-value contextual sparks with explicit targets
      const candidateSparks: Array<Omit<JarvisSparkProposal, 'id' | 'timestamp' | 'status'>> = [
        {
          title: 'Инспекция архитектуры и проверка типов',
          category: 'code_polish',
          description: 'Запустить проверку TypeScript компилятора (`npx tsc --noEmit`) и аудит зависимостей для подтверждения чистоты проекта.',
          suggestedAction: 'Запустить tsc --noEmit и проанализировать типы в проекте',
          targetFiles: ['src/types.ts', 'server/agent.ts'],
          contextSnippet: 'Проверка соответствия single source of truth src/types.ts',
          voicePhrase: 'Сэр, ветка стабильна. Если хотите, я запущу полную верификацию типов.',
        },
        {
          title: 'Автономный аудит безопасности и экспортов',
          category: 'feature_spark',
          description: 'Проверить безопасность путей, защиту от System32 и корректность экспорта инструментов в `server/tools.ts`.',
          suggestedAction: 'Провести аудит безопасности инструментов в server/tools.ts',
          targetFiles: ['server/tools.ts', 'server/agent/toolDispatcher.ts'],
          voicePhrase: 'Сэр, готов провести быстрый аудит безопасности системных инструментов.',
        },
        {
          title: 'Оптимизация производительности LLM слотов',
          category: 'code_polish',
          description: 'Проверить параметры Flash Attention, квантование KV-кэша и время отклика локального сервера llama.cpp.',
          suggestedAction: 'Проверить метрики и параметры локального сервера LLM',
          targetFiles: ['server/routes/llamaRoutes.ts', 'server/hardware.ts'],
          voicePhrase: 'Сэр, параметры локального сервера в норме. Могу запустить стресс-тест слота.',
        },
        {
          title: 'Режим спокойного спутника',
          category: 'friendly_checkin',
          description: 'Никакой спешки и дедлайнов. Если вы восстанавливаете силы — проект под контролем, всё в полном порядке.',
          suggestedAction: 'Активировать тихий фоновый режим',
          voicePhrase: 'Отдыхайте, сэр, я на страже. Всё под контролем.',
        },
      ];

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
    this.intervalTimer = setInterval(() => {
      const config = loadConfig();
      if (!config.proactive_companion_enabled) return;

      const idleMinutes = (Date.now() - this.lastActivityTimestamp) / (1000 * 60);

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
