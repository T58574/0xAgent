import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  PersonaMetadata,
  PersonaDetail,
  PersonaFile,
  PersonaFileVersionRecord,
} from '../src/types';
import { getMemoryDb } from './memoryDb';
import { getUserMemories } from './memory';

const PERSONAS_DIR = path.join(os.homedir(), '.0xagent', 'personas');

export function getPersonasDir(): string {
  if (!fs.existsSync(PERSONAS_DIR)) {
    fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  }
  return PERSONAS_DIR;
}

export function createFileVersionSnapshot(
  personaId: string,
  file: PersonaFile,
  content: string,
  createdBy: string = 'system',
  proposalId?: string | null
): PersonaFileVersionRecord {
  const db = getMemoryDb();
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const versionId = `pfv_${hash.substring(0, 10)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT OR IGNORE INTO persona_file_versions (id, persona_id, file, content, content_sha256, created_by, source_proposal_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(versionId, personaId, file, content, hash, createdBy, proposalId || null, now);
  } catch (err) {
    console.warn(`[personas] Failed to insert file version snapshot:`, err);
  }

  // Update metadata.json with latest version id
  const pDir = path.join(getPersonasDir(), personaId);
  const metaPath = path.join(pDir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const parsed: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      parsed.active_version_id = versionId;
      parsed.compiled_sha256 = hash;
      parsed.updated_at = Date.now();
      fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {}
  }

  return {
    id: versionId,
    persona_id: personaId,
    file,
    content,
    content_sha256: hash,
    created_by: createdBy,
    source_proposal_id: proposalId || null,
    created_at: now,
  };
}

export function listPersonaFileVersions(personaId: string, file?: PersonaFile): PersonaFileVersionRecord[] {
  const db = getMemoryDb();
  if (file) {
    const rows = db.prepare(`
      SELECT * FROM persona_file_versions
      WHERE persona_id = ? AND file = ?
      ORDER BY created_at DESC
    `).all(personaId, file) as any[];
    return rows;
  }
  const rows = db.prepare(`
    SELECT * FROM persona_file_versions
    WHERE persona_id = ?
    ORDER BY created_at DESC
  `).all(personaId) as any[];
  return rows;
}

export function ensureBaselineFileVersions(personaId: string): void {
  const pDir = path.join(getPersonasDir(), personaId);
  const files: PersonaFile[] = ['SOUL.md', 'TOOLS.md', 'USER.md'];
  for (const f of files) {
    const fullPath = path.join(pDir, f);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        createFileVersionSnapshot(personaId, f, content, 'system');
      } catch {}
    }
  }
}

export function createPersonaDirectory(
  id: string,
  data: {
    name: string;
    description: string;
    icon: string;
    user_id: string;
    is_active: boolean;
    soul: string;
    tools: string;
    user: string;
  }
): void {
  const dir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const now = Date.now();
  const metadata: PersonaMetadata = {
    id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    user_id: data.user_id,
    is_active: data.is_active,
    created_at: now,
    updated_at: now,
  };

  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dir, 'SOUL.md'), data.soul, 'utf-8');
  fs.writeFileSync(path.join(dir, 'TOOLS.md'), data.tools, 'utf-8');
  fs.writeFileSync(path.join(dir, 'USER.md'), data.user, 'utf-8');

  // Create baseline snapshots in DB
  try {
    createFileVersionSnapshot(id, 'SOUL.md', data.soul, 'system');
    createFileVersionSnapshot(id, 'TOOLS.md', data.tools, 'system');
    createFileVersionSnapshot(id, 'USER.md', data.user, 'system');
  } catch {}
}

export function updatePersonaFile(
  id: string,
  filename: PersonaFile,
  content: string,
  proposalId?: string | null
): PersonaDetail {
  const pDir = path.join(getPersonasDir(), id);
  if (!fs.existsSync(pDir)) {
    throw new Error(`Persona not found: ${id}`);
  }

  fs.writeFileSync(path.join(pDir, filename), content, 'utf-8');

  // Record version snapshot
  const snapshot = createFileVersionSnapshot(id, filename, content, proposalId ? 'agent_proposal' : 'manual_edit', proposalId);

  const metaPath = path.join(pDir, 'metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      const parsed: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      parsed.active_version_id = snapshot.id;
      parsed.compiled_sha256 = snapshot.content_sha256;
      parsed.updated_at = Date.now();
      fs.writeFileSync(metaPath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch {}
  }

  return getPersonaDetailDirect(id)!;
}

const MAX_PROJECTED_USER_MEMORIES = 40;

export function compileUserProjection(subjectId: string = 'user_default', existingUserMd?: string): string {
  const activeMemories = getUserMemories(subjectId);

  // Extract pinned section if present in existing markdown
  let pinnedText = '';
  if (existingUserMd) {
    const pinnedMatch = existingUserMd.match(/<!-- 0xagent:user:pinned -->([\s\S]*?)<!-- \/0xagent:user:pinned -->/i);
    if (pinnedMatch && pinnedMatch[1]) {
      pinnedText = pinnedMatch[1].trim();
    }
  }

  const lines: string[] = [];
  lines.push(`# USER.md — Профиль пользователя`);
  lines.push(`<!-- 0xagent:user:pinned -->`);
  if (pinnedText) {
    lines.push(pinnedText);
  } else {
    lines.push(`## Pinned Preferences`);
    lines.push(`- Пользователь предпочитает структурированные технические объяснения.`);
  }
  lines.push(`<!-- /0xagent:user:pinned -->\n`);

  lines.push(`<!-- 0xagent:user:generated -->`);
  lines.push(`## Active User Memories`);
  if (activeMemories.length > 0) {
    const rankedMemories = [...activeMemories].sort(
      (a, b) => ((b.importance ?? 3) * (b.confidence ?? 1.0)) - ((a.importance ?? 3) * (a.confidence ?? 1.0))
    );
    const topMemories = rankedMemories.slice(0, MAX_PROJECTED_USER_MEMORIES);

    for (const mem of topMemories) {
      lines.push(`- [${mem.category.toUpperCase()}] ${mem.key}: ${mem.value}`);
    }

    if (rankedMemories.length > MAX_PROJECTED_USER_MEMORIES) {
      lines.push(`- ... (${rankedMemories.length - MAX_PROJECTED_USER_MEMORIES} дополнительных фактов сохранены в memory.db)`);
    }
  } else {
    lines.push(`- Нет динамических записей.`);
  }
  lines.push(`<!-- /0xagent:user:generated -->`);

  return lines.join('\n');
}

export function getPersonaDetailDirect(id: string): PersonaDetail | null {
  const pDir = path.join(getPersonasDir(), id);
  const metaPath = path.join(pDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) return null;

  try {
    const metadata: PersonaMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const soul = fs.existsSync(path.join(pDir, 'SOUL.md')) ? fs.readFileSync(path.join(pDir, 'SOUL.md'), 'utf-8') : '';
    const tools = fs.existsSync(path.join(pDir, 'TOOLS.md')) ? fs.readFileSync(path.join(pDir, 'TOOLS.md'), 'utf-8') : '';
    let user = fs.existsSync(path.join(pDir, 'USER.md')) ? fs.readFileSync(path.join(pDir, 'USER.md'), 'utf-8') : '';

    user = compileUserProjection(metadata.user_id || 'user_default', user);

    return { metadata, soul, tools, user };
  } catch {
    return null;
  }
}
