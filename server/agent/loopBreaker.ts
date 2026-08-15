export interface LoopBreakerResult {
  isLooping: boolean;
  count: number;
  advisoryReminder?: string;
  forceHalt?: boolean;
}

export function deepSortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = deepSortKeys(obj[key]);
  }
  return result;
}

export function canonicalizeArguments(args: any): string {
  if (args === null || args === undefined) return '';
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      return JSON.stringify(deepSortKeys(parsed));
    } catch {
      return args.trim();
    }
  }
  return JSON.stringify(deepSortKeys(args));
}

export class LoopBreakerTracker {
  private sessions = new Map<
    string,
    {
      lastToolName: string;
      lastCanonicalArgs: string;
      consecutiveCount: number;
    }
  >();

  public trackCall(sessionId: string, toolName: string, args: any): LoopBreakerResult {
    const canonicalArgs = canonicalizeArguments(args);
    const state = this.sessions.get(sessionId);

    // Ignore transparent meta-tools from loop counting
    if (toolName === 'todo_write') {
      return { isLooping: false, count: state?.consecutiveCount || 0 };
    }

    if (state && state.lastToolName === toolName && state.lastCanonicalArgs === canonicalArgs) {
      state.consecutiveCount += 1;
      const count = state.consecutiveCount;

      if (count === 3) {
        const preview = canonicalArgs.length > 300 ? `${canonicalArgs.slice(0, 300)}...` : canonicalArgs;
        return {
          isLooping: true,
          count,
          advisoryReminder: `[СИСТЕМНОЕ ПРЕДУПРЕЖДЕНИЕ: Вы вызвали инструмент '${toolName}' с идентичными аргументами (${preview}) уже 3 раза подряд. Повторные одинаковые вызовы не приведут к успеху. Проанализируйте предыдущий вывод и ошибку, измените аргументы или выберите другой инструмент.]`,
        };
      }

      if (count >= 5) {
        return {
          isLooping: true,
          count,
          forceHalt: true,
          advisoryReminder: `[КРИТИЧЕСКИЙ РАЗРЫВ ЦИКЛА: Инструмент '${toolName}' вызван ${count} раз подряд без изменений. Автономный цикл остановлен во избежание бесконечного зацикливания. Завершите ответ или объясните проблему пользователю.]`,
        };
      }

      return { isLooping: count >= 3, count };
    }

    this.sessions.set(sessionId, {
      lastToolName: toolName,
      lastCanonicalArgs: canonicalArgs,
      consecutiveCount: 1,
    });

    return { isLooping: false, count: 1 };
  }

  public reset(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export const loopBreaker = new LoopBreakerTracker();
