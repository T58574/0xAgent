import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface SkillInfo {
  name: string;
  filename: string;
  title: string;
  description: string;
  updatedAt: number;
}

const APP_DIR = path.join(os.homedir(), '.0xagent');
const SKILLS_DIR = path.join(APP_DIR, 'skills');

const UNIT_TEST_SKILL = `# Unit Test Creator Skill
Description: Automatically generates unit tests with high coverage for target code files.

## Instructions
1. Inspect target source file and identify public functions, methods, and edge cases.
2. Choose appropriate testing framework (Vitest, Jest, PyTest, etc.).
3. Write clean unit tests covering success paths and boundary conditions.
4. Execute tests and verify zero failures.`;

const AUDIT_SECURITY_SKILL = `# Security Auditor Skill
Description: Audits codebase for vulnerabilities, SQL injection, XSS, and hardcoded secrets.

## Instructions
1. Perform grep search for common sensitive patterns (API keys, credentials, raw query strings).
2. Inspect input validation and sanitization.
3. Generate detailed security report with severity levels and exact fix patches.`;

const REFACTOR_HELPER_SKILL = `# Code Refactoring Helper Skill
Description: Refactors monolithic or messy functions into modular, typed, clean components.

## Instructions
1. Read target module and decompose complex functions (>50 lines) into focused helpers.
2. Enforce strict TypeScript typing and error handling.
3. Verify backward compatibility with automated builds.`;

function ensureSkillsDir(): void {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  // Populate starter skills
  const testSkill = path.join(SKILLS_DIR, 'unit_test_creator.md');
  if (!fs.existsSync(testSkill)) {
    fs.writeFileSync(testSkill, UNIT_TEST_SKILL, 'utf-8');
  }

  const auditSkill = path.join(SKILLS_DIR, 'security_auditor.md');
  if (!fs.existsSync(auditSkill)) {
    fs.writeFileSync(auditSkill, AUDIT_SECURITY_SKILL, 'utf-8');
  }

  const refactorSkill = path.join(SKILLS_DIR, 'refactor_helper.md');
  if (!fs.existsSync(refactorSkill)) {
    fs.writeFileSync(refactorSkill, REFACTOR_HELPER_SKILL, 'utf-8');
  }
}

export function listSkills(): SkillInfo[] {
  ensureSkillsDir();
  const files = fs.readdirSync(SKILLS_DIR);
  const result: SkillInfo[] = [];

  for (const filename of files) {
    if (filename.endsWith('.md') || filename.endsWith('.txt')) {
      const fullPath = path.join(SKILLS_DIR, filename);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Extract title & description from markdown header
      let title = filename.replace(/\.(md|txt)$/i, '').replace(/_/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let description = 'Custom skill routine';
      const descMatch = content.match(/Description:\s*(.+)/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }

      result.push({
        name: filename.replace(/\.(md|txt)$/i, ''),
        filename,
        title,
        description,
        updatedAt: stat.mtimeMs,
      });
    }
  }

  return result;
}

export function readSkill(name: string): string {
  ensureSkillsDir();
  let safeName = path.basename(name);
  if (!safeName.endsWith('.md') && !safeName.endsWith('.txt')) {
    safeName += '.md';
  }
  const filePath = path.join(SKILLS_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Skill file not found: ${safeName}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function writeSkill(name: string, content: string): void {
  ensureSkillsDir();
  let safeName = path.basename(name);
  if (!safeName.endsWith('.md') && !safeName.endsWith('.txt')) {
    safeName += '.md';
  }
  const filePath = path.join(SKILLS_DIR, safeName);
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function deleteSkill(name: string): void {
  ensureSkillsDir();
  let safeName = path.basename(name);
  if (!safeName.endsWith('.md') && !safeName.endsWith('.txt')) {
    safeName += '.md';
  }
  const filePath = path.join(SKILLS_DIR, safeName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
