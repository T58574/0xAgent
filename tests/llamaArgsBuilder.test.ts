import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLlamaServerArgs,
  resolveTargetExe,
  resolveTargetModel,
  findBestMmproj,
} from '../server/routes/llama/llamaArgsBuilder';

describe('Llama Args Builder Test Suite', () => {
  it('should generate basic server CLI arguments', () => {
    const res = buildLlamaServerArgs({
      targetModel: 'C:/models/test-model.gguf',
      host: '127.0.0.1',
      port: 11434,
      body: {},
      localServerConfig: {
        ctx_size: 8192,
        gpu_layers: 33,
        threads: 8,
        batch_size: 512,
        ubatch_size: 128,
        parallel_slots: 1,
        flash_attn: true,
      },
    });

    assert.ok(res.args.includes('-m'));
    assert.ok(res.args.includes('C:/models/test-model.gguf'));
    assert.ok(res.args.includes('--host'));
    assert.ok(res.args.includes('127.0.0.1'));
    assert.ok(res.args.includes('--port'));
    assert.ok(res.args.includes('11434'));
    assert.ok(res.args.includes('-c'));
    assert.ok(res.args.includes('8192'));
    assert.ok(res.args.includes('-ngl'));
    assert.ok(res.args.includes('33'));
    assert.ok(res.args.includes('-t'));
    assert.ok(res.args.includes('8'));
    assert.ok(res.args.includes('-fa'));
    assert.ok(res.args.includes('on'));
    assert.ok(res.args.includes('-np'));
    assert.ok(res.args.includes('1'));
  });

  it('should respect zero falsy values correctly (Zero Falsy Bug rule)', () => {
    const res = buildLlamaServerArgs({
      targetModel: 'C:/models/test-model.gguf',
      host: '127.0.0.1',
      port: 11434,
      body: {
        gpuLayers: 0,
        threads: 0,
      },
      localServerConfig: {
        gpu_layers: 99,
        threads: 16,
      },
    });

    // gpuLayers = 0 should be passed as 0, not fall back to 99
    const nglIdx = res.args.indexOf('-ngl');
    assert.ok(nglIdx !== -1);
    assert.equal(res.args[nglIdx + 1], '0');
  });

  it('should auto-configure reasoning & jinja for Qwen3 models', () => {
    const res = buildLlamaServerArgs({
      targetModel: 'C:/models/Qwen3.8-32B-Instruct.gguf',
      host: '127.0.0.1',
      port: 11434,
      body: {},
      localServerConfig: {},
    });

    assert.ok(res.args.includes('--jinja'));
    assert.ok(res.args.includes('--reasoning-preserve'));
    assert.ok(res.args.includes('--reasoning-format'));
    assert.ok(res.args.includes('deepseek'));
    assert.ok(res.args.includes('--reasoning'));
    assert.ok(res.args.includes('on'));
    assert.ok(res.args.includes('--reasoning-effort'));
    assert.ok(res.args.includes('medium'));
    assert.ok(res.args.includes('--temp'));
    assert.ok(res.args.includes('0.6'));
    assert.ok(res.args.includes('--repeat-penalty'));
    assert.ok(res.args.includes('1.05'));
  });

  it('should round top-k to integer', () => {
    const res = buildLlamaServerArgs({
      targetModel: 'C:/models/model.gguf',
      host: '127.0.0.1',
      port: 11434,
      body: { topK: 40.7 },
      localServerConfig: {},
    });

    const topKIdx = res.args.indexOf('--top-k');
    assert.ok(topKIdx !== -1);
    assert.equal(res.args[topKIdx + 1], '41');
  });

  it('should not inject draft speculative flags when no draft model is present on disk', () => {
    const res = buildLlamaServerArgs({
      targetModel: 'C:/models/Qwen3.8-27B-IQ3_M.gguf',
      host: '127.0.0.1',
      port: 11434,
      body: {},
      localServerConfig: {
        spec_type: 'default',
        spec_draft_model: null,
      },
    });

    assert.equal(res.args.includes('--spec-draft-model'), false);
    assert.equal(res.args.includes('--spec-type'), false);
    assert.equal(res.args.includes('--spec-draft-n-max'), false);
  });
});
