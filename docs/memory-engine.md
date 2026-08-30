# 0xAgent Memory Engine v1.0

> **Architecture Status:** Production Active  
> **Storage Backend:** Native `node:sqlite` (WAL Mode)  
> **Location:** `~/.0xagent/memory.db`  
> **Derived Indexing:** SQLite FTS5 (Full-Text Search) + BLOB Vector Table

---

## 1. Executive Summary

0xAgent Memory Engine v1.0 replaces legacy static JSON slicing (`memory.json`) with a multi-tiered, zero-LLM-hot-path memory engine. It separates **Canonical Data (Truth)** from **Derived Indexes (FTS5/Vectors)**, enforces a **Memory Write Policy** to prevent prompt pollution, uses a **Deterministic Router with Dynamic Token Budgeting (0..400 tokens)**, and renders dynamic **Persona Memory Views**.

```text
====================================== WRITE PATH (Async Background) ======================================

  USER MESSAGE ──────────► [ Local 9B/27B LLM ] ──────────► [ User Response ] (0 ms Hot-Path Latency)
                                    │
                                    ▼
                         [ Event Queue / Debounce ]
                        (20s Idle / Batch Threshold)
                                    │
                                    ▼
                        [ Background Memory Worker ]
                        (Extract Candidate Memories)
                                    │
                                    ▼
                         [ Memory Write Policy ]
                        (Explicit vs Strong vs Ignore)
                                    │
                                    ▼
                    [ SQLite Canonical Store + FTS5 ]
                    (Profile, Preferences, Episodes,
                     Persona-Scoped Relationships)


====================================== READ PATH (Context Assembly) =========================================

  USER MESSAGE
       │
       ▼
 [ Deterministic Memory Router ] ──── (Regex / Intent Detection — 0 ms)
       │
       ├────────────────────────────────────────┬───────────────────────────────────────┐
       ▼                                        ▼                                       ▼
 [ Structured Queries (SQL) ]            [ Episodic Search ]                     [ Casual Chat ]
 - Profile (Name, language, traits)      - SQLite FTS5 (Lexical)                 - 0 memories injected
 - Preferences (Tech, music, habits)     - Event Timestamp Decay                 - Clean token budget
 - Relationship (Active persona)         - Importance Weighting
       │                                        │                                       │
       └───────────────────┬────────────────────┘                                       │
                           ▼                                                            │
                 [ Ranking & Scoring ]                                                  │
                 (Similarity + Recency + Confidence)                                    │
                           │                                                            │
                           ▼                                                            │
              [ Dynamic Token Budget ] (0..400 tokens)                                  │
                           │                                                            │
                           └────────────────────┬───────────────────────────────────────┘
                                                │
                                                ▼
                                    [ Persona Memory View ]
                               (Canonical Facts + Persona Scope)
                                                │
                                                ▼
                                +──────────────────────────────+
                                | System Prompt + Memory View  |
                                | + Recent Clean Chat History  |
                                +--------------+---------------+
                                               │
                                               ▼
                                      [ 9B/27B Local LLM ]
```

---

## 2. Core Invariants & Design Principles

1. **Zero Added LLM Inference on Hot Path**: The main response generation loop does not make extra LLM calls to decide whether memory is needed or to save facts. Retrieval is deterministic and fast ($< 2\text{ ms}$).
2. **Canonical Data vs Derived Indexes**:
   - `canonical_memories` and `episodes` are the single source of truth.
   - `episodes_fts` and `episode_embeddings` are derived indexes that can be purged and rebuilt at any time without data loss.
3. **Natural Unique Identity & Superseding**:
   - Partial unique index: `UNIQUE(subject_id, category, domain, key) WHERE status = 'active'`.
   - When a fact value changes, the old record is automatically transitioned to `status = 'superseded'` and recorded in `memory_audit_log`.
4. **Subject Scoping**:
   - All memory items and episodes belong to a `subject_id` (default: `user_default`), allowing future multi-user separation without refactoring.
5. **Persona Relationships as Views**:
   - The user profile is stored once globally in `canonical_memories`.
   - Each persona (`default`, `architect`, `cyber_assistant`) maintains its own relationship state in `persona_relationships (subject_id, persona_id)`.

---

## 3. Database Schema (`~/.0xagent/memory.db`)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Provenance & Sources
CREATE TABLE memory_sources (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    message_id TEXT,
    source_type TEXT NOT NULL CHECK(source_type IN ('explicit_command', 'conversation_extraction', 'manual_edit')),
    raw_quote TEXT,
    created_at INTEGER NOT NULL
);

-- 2. Canonical User Memories (Profile, Preferences, Facts)
CREATE TABLE canonical_memories (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL DEFAULT 'user_default',
    category TEXT NOT NULL CHECK(category IN ('profile', 'preference', 'interest', 'fact', 'user_preference', 'project_convention', 'architecture', 'general')),
    domain TEXT NOT NULL DEFAULT 'general',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    is_explicit INTEGER NOT NULL DEFAULT 0,
    importance INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'candidate', 'superseded', 'invalidated', 'conflict')),
    source_id TEXT REFERENCES memory_sources(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_confirmed_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_unique_active_fact 
ON canonical_memories(subject_id, category, domain, key) 
WHERE status = 'active';

-- 3. Episodic Memory (Past Events & Dialogue Highlights)
CREATE TABLE episodes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL DEFAULT 'user_default',
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 2,
    lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active', 'consolidated', 'archived')),
    event_timestamp INTEGER NOT NULL,
    source_id TEXT REFERENCES memory_sources(id),
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL
);

-- 4. Persona Relationships
CREATE TABLE persona_relationships (
    subject_id TEXT NOT NULL DEFAULT 'user_default',
    persona_id TEXT NOT NULL,
    familiarity REAL NOT NULL DEFAULT 0.5,
    formality REAL NOT NULL DEFAULT 0.5,
    warmth REAL NOT NULL DEFAULT 0.5,
    humor_level REAL NOT NULL DEFAULT 0.5,
    preferred_address TEXT,
    relationship_summary TEXT,
    shared_references TEXT,
    interaction_count INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (subject_id, persona_id)
);

-- 5. Memory Audit & Lifecycle Log
CREATE TABLE memory_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('NEW', 'UPDATE', 'DELETE', 'INVALIDATE', 'CONFLICT', 'RESOLVE')),
    old_status TEXT,
    new_status TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    applied_by TEXT NOT NULL,
    actor_scope TEXT,
    timestamp INTEGER NOT NULL
);

-- 6. Derived Full-Text Search (FTS5)
CREATE VIRTUAL TABLE episodes_fts USING fts5(
    title,
    summary,
    content='episodes',
    content_rowid='rowid'
);
```

---

## 4. Memory Write Policy

The Write Policy sits between the extraction worker and the canonical database to prevent conversational hallucinations from becoming permanent memories:

| Origin / Intent | Confidence Threshold | Status Assigned | Action |
| :--- | :--- | :--- | :--- |
| **Explicit Command** (*"Запомни X"*) | Bypass confidence gate | `active` (`is_explicit = 1`) | Stored immediately in canonical store. |
| **Strong Inference** | $\ge 0.90$ | `active` (`is_explicit = 0`) | Automatically accepted. |
| **Medium Inference** | $0.70 \le \text{confidence} < 0.90$ | `candidate` | Saved for review; does not pollute main prompt. |
| **Weak Inference** | $< 0.70$ | N/A | **`IGNORE`** — Discarded immediately. |

---

## 5. Deterministic Memory Router & Scoring Formula

When a user query arrives, `routeAndRankMemories()` executes:

1. **Casual Chat Invariant**: If the message is a casual greeting or reaction (*"Привет"*, *"Ок"*, *"Спасибо"*), **0 memories** are injected.
2. **Fact Scoring**:
   $$\text{Score}_i = 1.5 \cdot \text{Importance} + 2.0 \cdot \text{Confidence} + \text{LexicalMatchBonus}$$
3. **Episodic Search**: If triggers like *"помнишь"*, *"в прошлый раз"*, *"поездка"* are present, an FTS5 search is executed across `episodes`.
4. **Dynamic Token Budget Allocator**: Candidate memories and episodes are added until the token budget (0..400 tokens) is reached, protecting the attention window of local 9B/27B models.
