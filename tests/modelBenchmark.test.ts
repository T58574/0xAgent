import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BENCHMARK_TASKS } from '../server/agent/modelBenchmark';

describe('Model Benchmark Engine & Tasks Test Suite', () => {
  it('should define all 8 core benchmark intelligence tasks', () => {
    assert.strictEqual(BENCHMARK_TASKS.length, 8);
    const taskIds = BENCHMARK_TASKS.map((t) => t.id);
    assert.ok(taskIds.includes('reasoning_logic'));
    assert.ok(taskIds.includes('ifeval_strict'));
    assert.ok(taskIds.includes('code_generation'));
    assert.ok(taskIds.includes('structured_json'));
    assert.ok(taskIds.includes('agent_tool_calling'));
    assert.ok(taskIds.includes('needle_haystack'));
    assert.ok(taskIds.includes('russian_fluency'));
    assert.ok(taskIds.includes('speed_throughput'));
  });

  describe('1. Reasoning & Anti-Hallucination Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'reasoning_logic')!;

    it('should PASS when correct answer 9 is given', () => {
      const output = 'У фермера осталось 9 овец, так как убежали все, кроме этих девяти.\nОтвет: 9';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should FAIL when model hallucinates 17 - 9 = 8', () => {
      const output = 'У фермера осталось 8 овец, так как 17 - 9 = 8.\nОтвет: 8';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.score, 0);
      assert.ok(res.details.includes('галлюцинация'));
    });
  });

  describe('2. IFEval Strict Constraints Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'ifeval_strict')!;

    it('should PASS when all 3 rules are met', () => {
      // 1: Физика изучает фундаментальные законы природы.
      // 2: Закон Гука открыл гуру науки Роберт. (No Cyrillic 'е'/'Е'!)
      // 3: Это фундаментальная основа мира.
      // Ends with ФИНИШ
      const output = 'Физика изучает фундаментальные законы природы. Закон Гука открыл Гук для пружин. Это крутая наука. ФИНИШ';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, true);
      assert.ok(res.score >= 80);
    });

    it('should FAIL when letter "e" is present in second sentence', () => {
      const output = 'Физика изучает законы природы. Второй закон Ньютона имеет формулу F=ma. Это крутая наука. ФИНИШ';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, false);
      assert.ok(res.details.includes("буква 'е'"));
    });
  });

  describe('3. Code Generation Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'code_generation')!;

    it('should PASS clean TypeScript code without TODO and any', () => {
      const output = `
function findLongestSubarrayWithSum(nums: number[], target: number): number[] {
  let longest: number[] = [];
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) {
      sum += nums[j];
      if (sum === target && (j - i + 1) > longest.length) {
        longest = nums.slice(i, j + 1);
      }
    }
  }
  return longest;
}
`;
      const res = task.validate(output, { latencyMs: 2000, tokensPerSec: 40 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should penalize code containing // TODO and any', () => {
      const output = `
function findLongestSubarrayWithSum(nums: any, target: any): any {
  // TODO: implement logic
  return [];
}
`;
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 20 });
      assert.strictEqual(res.passed, false);
      assert.ok(res.score < 70);
    });
  });

  describe('4. Structured JSON Extraction Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'structured_json')!;

    it('should PASS on valid strictly typed JSON', () => {
      const output = JSON.stringify({
        name: 'Алексей Смирнов',
        age: 34,
        role: 'тимлид',
        company: 'Яндекс',
        city: 'Москва',
        salary: 450000,
      });
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should FAIL on invalid JSON syntax', () => {
      const output = '{ name: "Алексей", age: 34, ';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 30 });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.score, 0);
    });
  });

  describe('5. Agent Tool Calling Protocol Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'agent_tool_calling')!;

    it('should PASS on valid XML tool call tag', () => {
      const output = `<tool_call>
<read_file>
<file_path>package.json</file_path>
</read_file>
</tool_call>`;
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 25 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should FAIL when tool call format is missing', () => {
      const output = 'I will now inspect the package.json file on disk using read_file.';
      const res = task.validate(output, { latencyMs: 1000, tokensPerSec: 25 });
      assert.strictEqual(res.passed, false);
    });
  });

  describe('6. Needle in Haystack Context Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'needle_haystack')!;

    it('should PASS when secret token is extracted', () => {
      const output = 'zeta-992-omega-phoenix';
      const res = task.validate(output, { latencyMs: 500, tokensPerSec: 50 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should FAIL when secret token is wrong or missing', () => {
      const output = 'SERVER_PORT=8080';
      const res = task.validate(output, { latencyMs: 500, tokensPerSec: 50 });
      assert.strictEqual(res.passed, false);
    });
  });

  describe('7. Russian Technical Fluency Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'russian_fluency')!;

    it('should PASS for fluent Russian answer with memory concepts', () => {
      const output = `
1. Процессы изолированы и обладают отдельным адресным пространством памяти.
2. Потоки работают внутри одного процесса и разделяют общую виртуальную память (heap).
3. Сбой в одном потоке может привести к падению процесса, тогда как процессы защищены аппаратно.
`;
      const res = task.validate(output, { latencyMs: 2000, tokensPerSec: 35 });
      assert.strictEqual(res.passed, true);
      assert.ok(res.score >= 75);
    });
  });

  describe('8. Speed and Throughput Metrics Task', () => {
    const task = BENCHMARK_TASKS.find((t) => t.id === 'speed_throughput')!;

    it('should score 100 for high-speed inference (>30 t/s)', () => {
      const res = task.validate('Красный, синий, зеленый', { latencyMs: 400, tokensPerSec: 45 });
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.score, 100);
    });

    it('should penalize very slow inference (<5 t/s)', () => {
      const res = task.validate('Красный, синий, зеленый', { latencyMs: 6000, tokensPerSec: 2.5 });
      assert.strictEqual(res.passed, false);
      assert.strictEqual(res.score, 40);
    });
  });
});
