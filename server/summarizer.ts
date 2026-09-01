import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppConfig } from '../src/types';

const PROMPTS_DIR = path.join(os.homedir(), '.0xagent', 'prompts');
const SUMMARIZER_FILE = path.join(PROMPTS_DIR, 'summarizer.md');

const DEFAULT_SUMMARIZER_PROMPT = `# SUMMARIZER.md — Инструкция Фонового Сжатия Контекста

## Роль и Задача
Вы — Автоматический Аналитический Модуль Сжатия Истории Диалога.
Ваша единственная цель — сжать предыдущую историю сообщений и вызовов инструментов в краткую, объективную и структурированную сводку фактов.

## СТРОГИЕ ПРАВИЛА
1. Запрещено использовать фразы 'Вы — суммаризатор', 'Привет', 'Я сжал контекст', обращения от первого лица или имитировать роли и личности.
2. Пишите исключительно факты и текущий статус решения задачи в 3-м лице.
3. Обязательно сохраняйте оригинальные имена измененных/проверенных файлов, названия ключевых функций, классов, типов, принятые архитектурные решения и ошибки.
4. Обязательно сохраняйте исходные предпочтения и указания пользователя.
5. Удаляйте лирику, приветствия и дубликаты сообщений.

## Формат Вывода
- [TARGET] Главная цель пользователя: ...
- [FILES] Измененные / Проверенные файлы: ...
- [ACTIONS] Принятые решения и полученные результаты: ...
- [STATUS] Текущий прогресс и следующий шаг: ...`;

export function extractCleanTextContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    return content.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[Изображение]');
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (typeof part === 'string') {
          return part.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[Изображение]');
        }
        if (part && typeof part === 'object') {
          if (part.type === 'text' && typeof part.text === 'string') {
            return part.text.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[Изображение]');
          }
          if (part.type === 'image_url' || part.image_url) {
            return '[Изображение]';
          }
        }
        return '';
      })
      .filter(Boolean);
    return parts.join(' ');
  }
  return '';
}

export function estimateMessageTokens(content: any): number {
  if (!content) return 0;
  if (typeof content === 'string') {
    let text = content;
    let imgTokens = 0;
    const matches = text.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g);
    if (matches) {
      imgTokens += matches.length * 576;
      text = text.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '');
    }
    return Math.max(0, Math.round(text.length / 3.8)) + imgTokens;
  }
  if (Array.isArray(content)) {
    let total = 0;
    for (const item of content) {
      if (typeof item === 'string') {
        total += estimateMessageTokens(item);
      } else if (item && typeof item === 'object') {
        if (item.type === 'text' && typeof item.text === 'string') {
          total += estimateMessageTokens(item.text);
        } else if (item.type === 'image_url' || item.image_url) {
          total += 576;
        } else {
          const cleanStr = JSON.stringify(item).replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '');
          total += Math.max(1, Math.round(cleanStr.length / 3.8));
        }
      }
    }
    return total;
  }
  return 0;
}

export function estimatePromptTokens(messages: Array<{ role: string; content: any; images?: string[] | null }>): number {
  let total = 0;
  for (const m of messages) {
    total += estimateMessageTokens(m.content);
    if (Array.isArray(m.images)) {
      total += m.images.length * 576;
    }
  }
  return Math.max(1, total);
}

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
  messages: { role: string; content: any }[],
  config: AppConfig,
  broadcast: (event: string, payload: any) => void
): Promise<string> {
  const promptTokens = estimatePromptTokens(messages);
  broadcast('agent-summarizing-start', {
    promptTokens,
    estimatedNewTokens: Math.round(promptTokens * 0.25),
  });

  broadcast('agent-summarizing-progress', {
    phase: '[ANALYSIS] Анализ истории диалога...',
    percent: 25,
  });

  const summarizerPrompt = loadSummarizerPrompt();
  const apiEndpoint = `${config.api_url.replace(/\/$/, '')}/chat/completions`;

  const conversationExcerpt = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const cleanText = extractCleanTextContent(m.content);
      return cleanText ? `[${m.role.toUpperCase()}]: ${cleanText}` : null;
    })
    .filter(Boolean)
    .join('\n\n');

  broadcast('agent-summarizing-progress', {
    phase: '[LLM] Запуск локального LLM-суммаризатора...',
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
    const apiKey = config.groq_api_key || process.env.GROQ_API_KEY || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model_name,
        messages: [
          { role: 'system', content: summarizerPrompt },
          {
            role: 'user',
            content: `Пожалуйста, составьте объективное сжатое резюме фактов по следующей истории диалога:\n\n${trimmedExcerpt}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    broadcast('agent-summarizing-progress', {
      phase: '[COMPACT] Сжатие вызовов инструментов и фиксация контекста...',
      percent: 85,
    });

    if (res.ok) {
      const data: any = await res.json();
      let summary = data.choices?.[0]?.message?.content || 'История диалога сжата.';
      summary = summary.replace(/^(Вы —|Я —|Привет|Здравствуйте)[^\n]*\n?/gi, '').trim();
      const newTokens = estimateMessageTokens(summary);

      broadcast('agent-summarizing-end', {
        oldTokens: promptTokens,
        newTokens,
        summary,
      });

      return summary;
    } else {
      console.warn(`[summarizer] Context summarizer returned HTTP ${res.status}. Falling back to basic pruning.`);
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
