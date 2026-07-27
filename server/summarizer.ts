import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from '../src/types';

const PROMPTS_DIR = path.join(os.homedir(), '.0xagent', 'prompts');
const SUMMARIZER_FILE = path.join(PROMPTS_DIR, 'summarizer.md');

const DEFAULT_SUMMARIZER_PROMPT = `# SUMMARIZER.md — Инструкция Фонового Сжатия Контекста

## Роль и Задача
Вы — Специализированный ИИ-Суммаризатор Диалогов.
Ваша цель — сжать историю сообщений и вызовов инструментов в краткую, структурированную и информативную сводку.

## Требования к Сжатию
1. Сохраняйте главную цель пользователя и текущий статус решения задачи.
2. Сохраняйте имена измененных файлов, ключевые функции, типы и архитектурные решения.
3. Сохраняйте зафиксированные предпочтения и привычки пользователя.
4. Удаляйте избыточный сырой вывод прочитанных файлов, дубликаты и промежуточные приветствия.

## Формат Вывода
- 🎯 Главная цель пользователя: ...
- 📂 Измененные / Проверенные файлы: ...
- 🛠️ Принятые решения и полученные результаты: ...
- 📌 Текущий прогресс и следующий шаг: ...`;

export function loadSummarizerPrompt(): string {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUMMARIZER_FILE)) {
    fs.writeFileSync(SUMMARIZER_FILE, DEFAULT_SUMMARIZER_PROMPT, 'utf-8');
    return DEFAULT_SUMMARIZER_PROMPT;
  }
  try {
    return fs.readFileSync(SUMMARIZER_FILE, 'utf-8');
  } catch {
    return DEFAULT_SUMMARIZER_PROMPT;
  }
}

export function saveSummarizerPrompt(content: string): void {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  fs.writeFileSync(SUMMARIZER_FILE, content, 'utf-8');
}

export async function summarizeContext(
  messages: { role: string; content: string }[],
  config: AppConfig,
  broadcast: (event: string, payload: any) => void
): Promise<string> {
  const promptTokens = Math.max(1, Math.round(JSON.stringify(messages).length / 3.8));
  broadcast('agent-summarizing-start', {
    promptTokens,
    estimatedNewTokens: Math.round(promptTokens * 0.25),
  });

  broadcast('agent-summarizing-progress', {
    phase: '🧠 Анализ истории диалога...',
    percent: 25,
  });

  const summarizerPrompt = loadSummarizerPrompt();
  const apiEndpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;

  const conversationExcerpt = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  broadcast('agent-summarizing-progress', {
    phase: '⚙️ Запуск локального LLM-суммаризатора...',
    percent: 55,
  });

  const maxCharLen = 16000;
  const trimmedExcerpt =
    conversationExcerpt.length > maxCharLen
      ? conversationExcerpt.substring(0, 4000) +
        '\n\n[... Промежуточная часть диалога сжата ...]\n\n' +
        conversationExcerpt.substring(conversationExcerpt.length - 12000)
      : conversationExcerpt;

  try {
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model_name,
        messages: [
          { role: 'system', content: summarizerPrompt },
          {
            role: 'user',
            content: `Пожалуйста, составьте сжатое резюме по следующей истории диалога:\n\n${trimmedExcerpt}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    broadcast('agent-summarizing-progress', {
      phase: '✨ Сжатие вызовов инструментов и фиксация контекста...',
      percent: 85,
    });

    if (res.ok) {
      const data: any = await res.json();
      const summary = data.choices?.[0]?.message?.content || 'История диалога сжата.';
      const newTokens = Math.max(1, Math.round(summary.length / 3.8));

      broadcast('agent-summarizing-end', {
        oldTokens: promptTokens,
        newTokens,
        summary,
      });

      return summary;
    }
  } catch (err: any) {
    console.error('Context summarization error:', err);
  }

  // Fallback summary if LLM call fails
  const fallback = 'Контекст автоматически сжат (достигнут лимит токенов).';
  broadcast('agent-summarizing-end', {
    oldTokens: promptTokens,
    newTokens: 100,
    summary: fallback,
  });

  return fallback;
}
