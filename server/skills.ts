import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SkillInfo } from '../src/types';

export type { SkillInfo };

const APP_DIR = path.join(os.homedir(), '.0xagent');
const SKILLS_DIR = path.join(APP_DIR, 'skills');

function ensureSkillsDir(): void {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
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
