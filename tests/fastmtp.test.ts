import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectModelReasoningCapabilities, parseGgufMetadata } from '../server/ggufParser';
import { buildLlamaServerArgs } from '../server/routes/llama/llamaArgsBuilder';
import { formatMessageContent } from '../server/agent/promptBuilder';
import path from 'node:path';
import fs from 'node:fs';

describe('FastMTP & Speculative Decoding Integration Suite', () => {
  it('should detect Qwen 3.8 reasoning and family capabilities', () => {
    const caps = detectModelReasoningCapabilities(
      'Qwen3.8-27B-IQ3_M',
      'Qwen3.8-27B-IQ3_M.gguf',
      'qwen35'
    );
    assert.equal(caps.family, 'qwen');
    assert.equal(caps.supportsReasoning, true);
    assert.equal(caps.recommendedReasoningEffort, 'xhigh');
  });

  it('should parse Raven/Qwen3.8 MTP model metadata correctly from file', () => {
    const modelPath = path.join(process.cwd(), 'models', 'RVN-IQ3_S-multilingual-mtp.gguf');
    if (fs.existsSync(modelPath)) {
      const meta = parseGgufMetadata(modelPath);
      assert.equal(meta.magicValid, true);
      assert.equal(meta.family, 'qwen');
      assert.equal(meta.supportsReasoning, true);
      assert.equal(meta.supportsFastMtp, true);
      assert.equal(meta.isDraft, false);
      assert.ok(meta.cleanTitle.includes('Qwen38') || meta.cleanTitle.includes('Raven') || meta.cleanTitle.includes('27B'));
    }
  });

  it('should prevent main model from being loaded as its own draft model', () => {
    const target = 'C:/models/RVN-IQ3_S-multilingual-mtp.gguf';
    const res = buildLlamaServerArgs({
      targetModel: target,
      host: '127.0.0.1',
      port: 11434,
      body: {
        specDraftModel: target, // mistakenly pointing to itself
      },
      localServerConfig: {
        spec_type: 'draft-mtp',
      },
    });

    // Should NOT include --spec-draft-model pointing to target
    const draftIdx = res.args.indexOf('--spec-draft-model');
    assert.equal(draftIdx, -1);
    // Should enable native draft-mtp
    assert.ok(res.args.includes('--spec-type'));
    assert.ok(res.args.includes('draft-mtp'));
  });

  it('should preserve XML tool tags in assistant messages when CoT thinking is stripped', () => {
    const msg: any = {
      id: 'msg-1',
      role: 'assistant',
      content: '<think>Let me inspect the file structure.\nI will list directory.</think>\n<list_dir path="." />',
      tool_calls: [
        {
          id: 'tc-1',
          name: 'list_dir',
          arguments: '{"path":"."}',
        },
      ],
    };

    const formatted = formatMessageContent(msg, true);
    assert.equal(typeof formatted, 'string');
    assert.ok(!formatted.includes('<think>'));
    assert.ok(formatted.includes('<list_dir path="." />'));
  });

  it('should reconstruct tool tags from tool_calls if model placed tool tag solely inside thinking block', () => {
    const msg: any = {
      id: 'msg-2',
      role: 'assistant',
      content: '<think>I need to read agent.ts:\n<read_file path="server/agent.ts" />\nNow let me analyze.</think>',
      tool_calls: [
        {
          id: 'tc-2',
          name: 'read_file',
          arguments: '{"path":"server/agent.ts"}',
        },
      ],
    };

    const formatted = formatMessageContent(msg, true);
    assert.equal(typeof formatted, 'string');
    assert.ok(!formatted.includes('<think>'));
    assert.ok(formatted.includes('<read_file path="server/agent.ts" />'));
  });

  it('should deterministically parse synthetic in-memory GGUF v3 binary header and metadata', () => {
    const tmpGguf = path.join(process.cwd(), 'tests', 'mock_qwen38_mtp.gguf');
    const buf = Buffer.alloc(1024);
    let offset = 0;

    // Header: Magic 'GGUF'
    buf.write('GGUF', 0, 4, 'ascii');
    buf.writeUInt32LE(3, 4); // version 3
    buf.writeBigUInt64LE(BigInt(50), 8); // tensor_count
    buf.writeBigUInt64LE(BigInt(4), 16); // kv_count = 4
    offset = 24;

    // Helper to write string KV
    const writeStringKv = (key: string, val: string) => {
      buf.writeBigUInt64LE(BigInt(key.length), offset);
      offset += 8;
      buf.write(key, offset, key.length, 'utf-8');
      offset += key.length;
      buf.writeUInt32LE(8, offset); // type = string (8)
      offset += 4;
      buf.writeBigUInt64LE(BigInt(val.length), offset);
      offset += 8;
      buf.write(val, offset, val.length, 'utf-8');
      offset += val.length;
    };

    // Helper to write uint32 KV
    const writeUInt32Kv = (key: string, val: number) => {
      buf.writeBigUInt64LE(BigInt(key.length), offset);
      offset += 8;
      buf.write(key, offset, key.length, 'utf-8');
      offset += key.length;
      buf.writeUInt32LE(4, offset); // type = uint32 (4)
      offset += 4;
      buf.writeUInt32LE(val, offset);
      offset += 4;
    };

    writeStringKv('general.architecture', 'qwen35');
    writeStringKv('general.name', 'Qwen38 Ara v5');
    writeStringKv('general.size_label', '27B');
    writeUInt32Kv('qwen35.nextn_predict_layers', 1);

    fs.writeFileSync(tmpGguf, buf.subarray(0, offset));

    try {
      const meta = parseGgufMetadata(tmpGguf);
      assert.equal(meta.magicValid, true);
      assert.equal(meta.version, 3);
      assert.equal(meta.architecture, 'qwen35');
      assert.equal(meta.modelName, 'Qwen38 Ara v5');
      assert.equal(meta.family, 'qwen');
      assert.equal(meta.supportsReasoning, true);
      assert.equal(meta.supportsFastMtp, true);
      assert.equal(meta.isDraft, false);
      assert.ok(meta.cleanTitle.includes('Qwen38 Ara v5 27B'));
    } finally {
      if (fs.existsSync(tmpGguf)) fs.unlinkSync(tmpGguf);
    }
  });
});

