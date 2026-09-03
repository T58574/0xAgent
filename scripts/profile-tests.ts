import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const testsDir = path.join(process.cwd(), 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log(`Profiling ${files.length} test suites...\n`);

const results: { file: string; duration: number; status: string }[] = [];
for (const file of files) {
  const full = path.join(testsDir, file);
  const start = Date.now();
  try {
    execSync(`npx tsx --test "${full}"`, { stdio: 'pipe' });
    const duration = Date.now() - start;
    results.push({ file, duration, status: 'PASS' });
    console.log(`[PASS] ${file.padEnd(35)} ${duration}ms`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ file, duration, status: 'FAIL' });
    console.log(`[FAIL] ${file.padEnd(35)} ${duration}ms`);
  }
}

results.sort((a, b) => b.duration - a.duration);
console.log('\nTop Slowest Suites:');
for (const r of results.slice(0, 10)) {
  console.log(`- ${r.file}: ${r.duration}ms (${r.status})`);
}
