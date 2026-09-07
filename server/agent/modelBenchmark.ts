import { spawn } from 'node:child_process';
import { getSafeCliPath } from '../veronica/adapters/antigravityModels';
import { loadConfig } from '../config';

export type BenchmarkCategory =
  | 'reasoning'
  | 'coding'
  | 'instruction_following'
  | 'structured_data'
  | 'agentic'
  | 'retrieval'
  | 'language'
  | 'performance';

export interface BenchmarkTask {
  id: string;
  name: string;
  category: BenchmarkCategory;
  description: string;
  prompt: string;
  systemPrompt?: string;
  validate: (output: string, metrics: { latencyMs: number; tokensPerSec: number }) => {
    passed: boolean;
    score: number; // 0 to 100
    details: string;
  };
}

export interface BenchmarkTestResult {
  taskId: string;
  name: string;
  category: BenchmarkCategory;
  passed: boolean;
  score: number; // 0 to 100
  latencyMs: number;
  ttftMs: number;
  tokensPerSec: number;
  promptTokens: number;
  completionTokens: number;
  output: string;
  details: string;
}

export interface BenchmarkSuiteReport {
  modelName: string;
  provider: 'local' | 'antigravity' | 'openai';
  timestamp: number;
  totalTasks: number;
  passedTasks: number;
  overallScore: number; // 0 to 100
  averageTokensPerSec: number;
  averageLatencyMs: number;
  averageTtftMs: number;
  results: BenchmarkTestResult[];
}

export interface RunBenchmarkOptions {
  provider?: 'local' | 'antigravity' | 'openai';
  model?: string;
  endpoint?: string;
  taskIds?: string[];
  onProgress?: (event: {
    type: 'task_start' | 'task_complete';
    taskId: string;
    taskIndex: number;
    totalTasks: number;
    result?: BenchmarkTestResult;
  }) => void;
}

/**
 * High-quality, modern evaluation tasks testing intelligence, reasoning, coding,
 * strict constraints, structured output, and agentic tool invocation.
 */
export const BENCHMARK_TASKS: BenchmarkTask[] = [
  {
    id: 'reasoning_logic',
    name: 'Логический вывод и контр-интуиция',
    category: 'reasoning',
    description: 'Проверка внимательности, аналитического мышления и защиты от классических ловушек рассуждений.',
    prompt:
      "Ответь на задачу кратко:\n" +
      "'У фермера было 17 овец. Все, кроме девяти, сбежали. Сколько овец осталось у фермера?'\n" +
      "Объясни одним коротким предложением и строго в конце напиши строку: Ответ: <число>",
    validate: (output) => {
      const answerMatch = output.match(/ответ:\s*([0-9]+|девять|восемь)/i);
      if (answerMatch) {
        const ans = answerMatch[1].toLowerCase();
        if (ans === '9' || ans === 'девять') {
          return { passed: true, score: 100, details: 'Правильный логический ответ (9 овец, фраза "все кроме 9" распознана верно).' };
        } else {
          return { passed: false, score: 0, details: `Классическая галлюцинация: получен ошибочный вывод "${ans}" вместо 9.` };
        }
      }

      const hasEight = /\b8\b|\bвосемь\b/i.test(output);
      const hasNine = /\b9\b|\bдевять\b/i.test(output);

      if (hasNine && !hasEight) {
        return { passed: true, score: 100, details: 'Правильный логический ответ (9 овец).' };
      }
      if (hasEight) {
        return { passed: false, score: 0, details: 'Классическая галлюцинация: модель ошибочно вычла 17-9=8 вместо понимания условия.' };
      }
      return { passed: false, score: 0, details: 'Число оставшихся овец (9) не найдено в ответе.' };
    },
  },
  {
    id: 'ifeval_strict',
    name: 'Следование негативным ограничениям (IFEval)',
    category: 'instruction_following',
    description: 'Проверка многокритериального следования жестким ограничениям и запретам.',
    prompt:
      "Напиши текст строго по следующим правилам:\n" +
      "1. Текст должен состоять ровно из 3 предложений о физике.\n" +
      "2. Во втором предложении ЗАПРЕЩЕНО использовать русскую букву 'е' (и 'Е') ни в одном слове.\n" +
      "3. Ответ должен заканчиваться строго словом: 'ФИНИШ'.",
    validate: (output) => {
      const cleaned = output.trim();
      const endsWithFinish = /финиш[.!]?$/i.test(cleaned);

      // Split into sentences (by . ! ?)
      const rawSentences = cleaned
        .replace(/финиш[.!]?$/i, '')
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);

      const sentenceCount = rawSentences.length;
      const countOk = sentenceCount === 3;

      let noEOk = false;
      let secondSentence = '';
      if (rawSentences.length >= 2) {
        secondSentence = rawSentences[1];
        noEOk = !/[еЕ]/i.test(secondSentence);
      }

      let score = 0;
      const issues: string[] = [];
      if (countOk) score += 40;
      else issues.push(`Количество предложений: ${sentenceCount} (ожидалось ровно 3)`);

      if (noEOk) score += 40;
      else issues.push(`Во 2-м предложении обнаружена буква 'е': "${secondSentence.slice(0, 50)}..."`);

      if (endsWithFinish) score += 20;
      else issues.push("Ответ не заканчивается словом 'ФИНИШ'");

      return {
        passed: score >= 80,
        score,
        details: issues.length === 0 ? 'Все строгие правила (число предложений, запрет буквы, маркер) соблюдены.' : issues.join('; '),
      };
    },
  },
  {
    id: 'code_generation',
    name: 'Алгоритмический синтез кода (TypeScript)',
    category: 'coding',
    description: 'Проверка генерации чистого, синтаксически корректного кода без заглушек и антипаттернов.',
    prompt:
      "Напиши функцию на TypeScript:\n" +
      "function findLongestSubarrayWithSum(nums: number[], target: number): number[]\n" +
      "Функция должна находить самый длинный непрерывный подмассив с суммой элементов target. Если такого нет — возвращать [].\n" +
      "Требования:\n" +
      "- Выведи ТОЛЬКО чистый TypeScript код функции без лишних слов.\n" +
      "- Запрещено использовать '// TODO', 'any' или неполную реализацию.",
    validate: (output) => {
      const hasFunc = /function\s+findLongestSubarrayWithSum/i.test(output) || /const\s+findLongestSubarrayWithSum/i.test(output);
      const hasTodo = /\/\/\s*TODO/i.test(output);
      const hasAny = /:\s*any\b/i.test(output);

      if (!hasFunc) {
        return { passed: false, score: 0, details: 'Искомая функция findLongestSubarrayWithSum не объявлена.' };
      }

      let score = 70;
      const issues: string[] = [];
      if (hasTodo) {
        score -= 30;
        issues.push("Обнаружен запрещенный маркер '// TODO'");
      }
      if (hasAny) {
        score -= 30;
        issues.push("Обнаружен запрещенный тип 'any'");
      }

      // Syntax and logical structure check (sliding window or prefix sum map)
      const hasMapOrLoop = /for\s*\(|while\s*\(|Map<|indexOf|slice/i.test(output);
      if (hasMapOrLoop) {
        score += 30;
      } else {
        issues.push('Отсутствует цикл или структура алгоритмического поиска');
      }

      score = Math.min(100, Math.max(0, score));
      return {
        passed: score >= 70,
        score,
        details: issues.length === 0 ? 'Чистый TypeScript код без TODO и any, алгоритмическая структура корректна.' : issues.join('; '),
      };
    },
  },
  {
    id: 'structured_json',
    name: 'Строгое структурирование данных (JSON)',
    category: 'structured_data',
    description: 'Проверка способности возвращать валидный JSON строго по схеме без лишнего текста и markdown.',
    prompt:
      "Извлеки данные из текста:\n" +
      "'Алексей Смирнов, 34 года, работает тимлидом в Яндекс в городе Москва с окладом 450000 руб.'\n\n" +
      "Верни СТРОГО чистый валидный JSON объект (без markdown блоков ```json и без каких-либо комментариев):\n" +
      "{\n" +
      '  "name": string,\n' +
      '  "age": number,\n' +
      '  "role": string,\n' +
      '  "company": string,\n' +
      '  "city": string,\n' +
      '  "salary": number\n' +
      "}",
    validate: (output) => {
      let raw = output.trim();
      // Strip outer backticks if accidentally emitted
      if (raw.startsWith('```json')) raw = raw.slice(7);
      if (raw.startsWith('```')) raw = raw.slice(3);
      if (raw.endsWith('```')) raw = raw.slice(0, -3);
      raw = raw.trim();

      try {
        const obj = JSON.parse(raw);
        let score = 100;
        const issues: string[] = [];

        if (typeof obj.age !== 'number' || obj.age !== 34) {
          score -= 20;
          issues.push(`age должен быть числом 34, получено: ${obj.age}`);
        }
        if (typeof obj.salary !== 'number' || obj.salary !== 450000) {
          score -= 20;
          issues.push(`salary должен быть числом 450000, получено: ${obj.salary}`);
        }
        if (!obj.name || !String(obj.name).includes('Алексей')) {
          score -= 20;
          issues.push(`name не содержит 'Алексей': ${obj.name}`);
        }
        if (!obj.company || !String(obj.company).toLowerCase().includes('яндекс')) {
          score -= 20;
          issues.push(`company не содержит 'Яндекс': ${obj.company}`);
        }
        if (!obj.city || !String(obj.city).toLowerCase().includes('москва')) {
          score -= 10;
          issues.push(`city не содержит 'Москва': ${obj.city}`);
        }

        score = Math.max(0, score);
        return {
          passed: score >= 80,
          score,
          details: issues.length === 0 ? 'Валидный JSON, точные типы полей (числа без кавычек) и правильные значения.' : issues.join('; '),
        };
      } catch (err: any) {
        return { passed: false, score: 0, details: `Невалидный JSON синтаксис: ${err.message}` };
      }
    },
  },
  {
    id: 'agent_tool_calling',
    name: 'Агентский протокол вызова инструментов',
    category: 'agentic',
    description: 'Проверка соблюдения агентского формата вызова инструментов без выдумывания лишних действий.',
    prompt:
      "Ты автономный AI-агент. Твоя задача — прочитать файл 'package.json' в текущей рабочей папке.\n" +
      "Вызови инструмент read_file строго в формате XML-тегов:\n" +
      "<tool_call>\n" +
      "<read_file>\n" +
      "<file_path>package.json</file_path>\n" +
      "</read_file>\n" +
      "</tool_call>\n" +
      "Не пиши никаких рассуждений до вызова, выведи только сам вызов.",
    validate: (output) => {
      const hasToolCallTag = /<tool_call>[\s\S]*?<\/tool_call>/i.test(output);
      const hasReadFile = /read_file/i.test(output);
      const hasPackageJson = /package\.json/i.test(output);

      if (hasToolCallTag && hasReadFile && hasPackageJson) {
        return { passed: true, score: 100, details: 'Корректный синтаксис тегов <tool_call> и целевой параметр package.json.' };
      }
      if (hasReadFile && hasPackageJson) {
        return { passed: false, score: 50, details: 'Инструмент и аргумент указаны, но нарушен точный XML-формат <tool_call>.' };
      }
      return { passed: false, score: 0, details: 'Вызов инструмента не сформирован.' };
    },
  },
  {
    id: 'needle_haystack',
    name: 'Внимание в контексте (Needle in Haystack)',
    category: 'retrieval',
    description: 'Проверка извлечения конкретного секретного значения из объемного зашумленного текста конфигурации.',
    prompt:
      "Ниже приведен фрагмент конфигурационного файла сервиса:\n" +
      "SERVER_HOST=0.0.0.0\n" +
      "SERVER_PORT=8080\n" +
      "CACHE_TTL=3600\n" +
      "LOG_LEVEL=debug\n" +
      "METRICS_ENABLED=true\n" +
      "DATABASE_POOL_MIN=5\n" +
      "DATABASE_POOL_MAX=20\n" +
      "SECURITY_HASH_ALGO=sha256\n" +
      "VERONICA_ORCHESTRATOR_NONCE=zeta-992-omega-phoenix\n" +
      "QUEUE_MAX_SIZE=500\n" +
      "WORKER_TIMEOUT_SEC=30\n" +
      "SESSION_EXPIRY=86400\n\n" +
      "Вопрос: Какое точное значение у переменной VERONICA_ORCHESTRATOR_NONCE?\n" +
      "Ответь ТОЛЬКО значением, без лишних символов и слов.",
    validate: (output) => {
      const target = 'zeta-992-omega-phoenix';
      const clean = output.trim();
      if (clean === target) {
        return { passed: true, score: 100, details: 'Идеальное точное извлечение значения из контекста.' };
      }
      if (clean.includes(target)) {
        return { passed: true, score: 90, details: 'Значение найдено в ответе с дополнительными символами.' };
      }
      return { passed: false, score: 0, details: `Ключ не найден. Ожидалось: ${target}` };
    },
  },
  {
    id: 'russian_fluency',
    name: 'Русский технический язык и терминология',
    category: 'language',
    description: 'Проверка грамотности технического русского языка и точности формулировок архитектуры ОС.',
    prompt:
      "Объясни кратко разницу между процессами (processes) и потоками (threads) в операционных системах с точки зрения адресации памяти и изоляции.\n" +
      "Ответь строго на русском языке, выделив 3 ключевых пункта маркированным списком.",
    validate: (output) => {
      // Check Cyrillic density
      const cyrillicChars = (output.match(/[\u0400-\u04FF]/g) || []).length;
      const latinChars = (output.match(/[a-zA-Z]/g) || []).length;
      const totalLetters = cyrillicChars + latinChars;
      const cyrillicRatio = totalLetters > 0 ? cyrillicChars / totalLetters : 0;

      const hasMemoryConcept = /памят|адресн/i.test(output);
      const hasIsolationConcept = /изоляц|безопасн|крах|сбо/i.test(output);
      const hasBullets = /[-*•1-3]\s+/i.test(output);

      let score = 0;
      const issues: string[] = [];

      if (cyrillicRatio > 0.7) score += 40;
      else issues.push(`Недостаточно русскоязычный ответ (доля кириллицы ${Math.round(cyrillicRatio * 100)}%)`);

      if (hasMemoryConcept && hasIsolationConcept) score += 40;
      else issues.push('Не раскрыты ключевые понятия: адресное пространство и изоляция памяти');

      if (hasBullets) score += 20;
      else issues.push('Отсутствует маркированный список из пунктов');

      return {
        passed: score >= 75,
        score,
        details: issues.length === 0 ? 'Грамотный русский технический ответ с точной терминологией архитектуры ОС.' : issues.join('; '),
      };
    },
  },
  {
    id: 'speed_throughput',
    name: 'Скорость генерации и задержка (TTFT)',
    category: 'performance',
    description: 'Замер времени до первого токена (TTFT) и пропускной способности инференса (токенов в секунду).',
    prompt: 'Перечисли 15 распространенных цветов природы через запятую.',
    validate: (_output, metrics) => {
      const tps = metrics.tokensPerSec;
      const latency = metrics.latencyMs;

      // Score based on tokens per second
      let score = 100;
      if (tps < 5) score = 40;
      else if (tps < 15) score = 70;
      else if (tps < 30) score = 90;
      else score = 100;

      return {
        passed: tps > 3,
        score,
        details: `Скорость: ${tps.toFixed(1)} т/сек, общее время: ${(latency / 1000).toFixed(2)} сек.`,
      };
    },
  },
];

/**
 * Executes a single task against a local or remote OpenAI-compatible endpoint.
 */
async function executeOpenAiTask(
  task: BenchmarkTask,
  endpoint: string,
  modelName: string,
  timeoutMs = 45000
): Promise<{
  output: string;
  latencyMs: number;
  ttftMs: number;
  tokensPerSec: number;
  promptTokens: number;
  completionTokens: number;
}> {
  const url = endpoint.endsWith('/') ? `${endpoint}chat/completions` : `${endpoint}/chat/completions`;
  const startTime = Date.now();
  let ttftTime = 0;

  const body = {
    model: modelName,
    messages: [
      ...(task.systemPrompt ? [{ role: 'system', content: task.systemPrompt }] : []),
      { role: 'user', content: task.prompt },
    ],
    temperature: 0.1,
    stream: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Endpoint returned HTTP ${res.status}: ${await res.text()}`);
    }

    let fullText = '';
    let tokenCount = 0;

    if (res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (ttftTime === 0) {
          ttftTime = Date.now();
        }

        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                tokenCount++;
              }
            } catch {}
          }
        }
      }
    } else {
      const json = await res.json();
      fullText = json.choices?.[0]?.message?.content || '';
      tokenCount = json.usage?.completion_tokens || Math.round(fullText.length / 3.5);
    }

    const endTime = Date.now();
    const latencyMs = endTime - startTime;
    const ttftMs = ttftTime > 0 ? ttftTime - startTime : latencyMs;
    const evalDurationSec = Math.max(0.05, (endTime - (ttftTime || startTime)) / 1000);
    const tokensPerSec = tokenCount > 0 ? tokenCount / evalDurationSec : 0;

    return {
      output: fullText,
      latencyMs,
      ttftMs,
      tokensPerSec: Math.round(tokensPerSec * 10) / 10,
      promptTokens: Math.round(task.prompt.length / 3.5),
      completionTokens: tokenCount,
    };
  } finally {
    clearTimeout(timer);
  }
}

import { AntigravityLogParser } from '../veronica/adapters/antigravityLogParser';

/**
 * Executes a single task against Antigravity CLI (agy).
 */
async function executeAntigravityTask(
  task: BenchmarkTask,
  modelName: string,
  timeoutMs = 60000
): Promise<{
  output: string;
  latencyMs: number;
  ttftMs: number;
  tokensPerSec: number;
  promptTokens: number;
  completionTokens: number;
}> {
  const config = loadConfig();
  const cliPath = getSafeCliPath(config.veronica?.antigravity_cli_path);
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const args = [
      '--dangerously-skip-permissions',
      '--output-format',
      'stream-json',
    ];

    if (modelName) {
      args.push('--model', modelName);
    }

    let fullOutput = '';
    let finalResponse = '';
    let ttftTime = 0;
    let proc: any;

    try {
      proc = spawn(cliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    } catch (err: any) {
      return reject(new Error(`Failed to spawn agy at ${cliPath}: ${err.message}`));
    }

    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      reject(new Error(`Antigravity task timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    let lineBuffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      if (ttftTime === 0) {
        ttftTime = Date.now();
      }
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parsed = AntigravityLogParser.parseLine(trimmed);
        if (parsed.isJson && parsed.parsedEvent) {
          const ev = parsed.parsedEvent;
          if (ev.response) {
            finalResponse = ev.response;
          }
          const raw = ev.rawJson;
          if (raw?.step_update?.text_delta) {
            fullOutput += raw.step_update.text_delta;
          } else if (raw?.step_update?.delta) {
            fullOutput += raw.step_update.delta;
          } else if (raw?.step_update?.content) {
            fullOutput += raw.step_update.content;
          }
        } else if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          fullOutput += trimmed + '\n';
        }
      }
    });

    proc.stderr.on('data', () => {});

    proc.on('close', () => {
      clearTimeout(timer);
      if (lineBuffer.trim()) {
        const parsed = AntigravityLogParser.parseLine(lineBuffer.trim());
        if (parsed.isJson && parsed.parsedEvent?.response) {
          finalResponse = parsed.parsedEvent.response;
        }
      }
      const endTime = Date.now();
      const latencyMs = endTime - startTime;
      const ttftMs = ttftTime > 0 ? ttftTime - startTime : latencyMs;
      const resultText = (finalResponse || fullOutput).trim();
      const estTokens = Math.max(1, Math.round(resultText.length / 3.5));
      const durationSec = Math.max(0.1, latencyMs / 1000);
      const tokensPerSec = estTokens / durationSec;

      resolve({
        output: resultText,
        latencyMs,
        ttftMs,
        tokensPerSec: Math.round(tokensPerSec * 10) / 10,
        promptTokens: Math.round(task.prompt.length / 3.5),
        completionTokens: estTokens,
      });
    });

    proc.on('error', (err: any) => {
      clearTimeout(timer);
      reject(err);
    });

    // Write prompt to stdin of agy
    const promptText = task.systemPrompt ? `${task.systemPrompt}\n\n${task.prompt}` : task.prompt;
    proc.stdin.write(promptText + '\n');
    proc.stdin.end();
  });
}

/**
 * Main benchmark runner: executes selected tasks against the chosen model/provider.
 */
export async function runModelBenchmark(options: RunBenchmarkOptions = {}): Promise<BenchmarkSuiteReport> {
  const config = loadConfig();
  const provider = options.provider || 'local';
  const modelName =
    options.model ||
    (provider === 'local' ? (config.model_name || 'local:qwen2.5-coder-32b.gguf') : 'gemini-2.5-flash');
  const endpoint =
    options.endpoint ||
    (config.local_server
      ? `http://${config.local_server.host || '127.0.0.1'}:${config.local_server.port || 8080}/v1`
      : 'http://127.0.0.1:8080/v1');

  const selectedTasks = options.taskIds && options.taskIds.length > 0
    ? BENCHMARK_TASKS.filter((t) => options.taskIds!.includes(t.id))
    : BENCHMARK_TASKS;

  const results: BenchmarkTestResult[] = [];

  for (let i = 0; i < selectedTasks.length; i++) {
    const task = selectedTasks[i];
    if (options.onProgress) {
      options.onProgress({
        type: 'task_start',
        taskId: task.id,
        taskIndex: i,
        totalTasks: selectedTasks.length,
      });
    }

    let execution: {
      output: string;
      latencyMs: number;
      ttftMs: number;
      tokensPerSec: number;
      promptTokens: number;
      completionTokens: number;
    };

    try {
      if (provider === 'antigravity') {
        execution = await executeAntigravityTask(task, modelName);
      } else {
        execution = await executeOpenAiTask(task, endpoint, modelName);
      }

      const validation = task.validate(execution.output, {
        latencyMs: execution.latencyMs,
        tokensPerSec: execution.tokensPerSec,
      });

      const testResult: BenchmarkTestResult = {
        taskId: task.id,
        name: task.name,
        category: task.category,
        passed: validation.passed,
        score: validation.score,
        latencyMs: execution.latencyMs,
        ttftMs: execution.ttftMs,
        tokensPerSec: execution.tokensPerSec,
        promptTokens: execution.promptTokens,
        completionTokens: execution.completionTokens,
        output: execution.output,
        details: validation.details,
      };

      results.push(testResult);

      if (options.onProgress) {
        options.onProgress({
          type: 'task_complete',
          taskId: task.id,
          taskIndex: i,
          totalTasks: selectedTasks.length,
          result: testResult,
        });
      }
    } catch (err: any) {
      const failedResult: BenchmarkTestResult = {
        taskId: task.id,
        name: task.name,
        category: task.category,
        passed: false,
        score: 0,
        latencyMs: 0,
        ttftMs: 0,
        tokensPerSec: 0,
        promptTokens: 0,
        completionTokens: 0,
        output: '',
        details: `Ошибка выполнения: ${err.message || err}`,
      };
      results.push(failedResult);

      if (options.onProgress) {
        options.onProgress({
          type: 'task_complete',
          taskId: task.id,
          taskIndex: i,
          totalTasks: selectedTasks.length,
          result: failedResult,
        });
      }
    }
  }

  const totalTasks = results.length;
  const passedTasks = results.filter((r) => r.passed).length;
  const overallScore = totalTasks > 0 ? Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalTasks) : 0;
  const validTps = results.filter((r) => r.tokensPerSec > 0);
  const averageTokensPerSec = validTps.length > 0 ? Math.round((validTps.reduce((acc, r) => acc + r.tokensPerSec, 0) / validTps.length) * 10) / 10 : 0;
  const averageLatencyMs = totalTasks > 0 ? Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / totalTasks) : 0;
  const averageTtftMs = totalTasks > 0 ? Math.round(results.reduce((acc, r) => acc + r.ttftMs, 0) / totalTasks) : 0;

  return {
    modelName,
    provider,
    timestamp: Date.now(),
    totalTasks,
    passedTasks,
    overallScore,
    averageTokensPerSec,
    averageLatencyMs,
    averageTtftMs,
    results,
  };
}
