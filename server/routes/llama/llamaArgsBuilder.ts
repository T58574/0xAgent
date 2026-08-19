import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export interface BuildLlamaArgsParams {
  targetModel: string;
  host: string;
  port: number;
  body: any;
  localServerConfig: any;
  workspaceDir?: string | null;
  onLog?: (msg: string) => void;
}

export function resolveTargetExe(bodyExe?: string | null, configExe?: string | null): string {
  let targetExe = bodyExe || configExe || '';
  if (targetExe && fs.existsSync(targetExe)) return targetExe;

  const llamaDir = path.join(os.homedir(), '.0xagent', 'llama');
  if (fs.existsSync(llamaDir)) {
    const rootExe = path.join(llamaDir, 'llama-server.exe');
    if (fs.existsSync(rootExe)) return rootExe;

    const subdirs = fs.readdirSync(llamaDir, { withFileTypes: true });
    for (const d of subdirs) {
      if (d.isDirectory()) {
        const subExe = path.join(llamaDir, d.name, 'llama-server.exe');
        if (fs.existsSync(subExe)) return subExe;
        const altExe = path.join(llamaDir, d.name, 'llama.exe');
        if (fs.existsSync(altExe)) return altExe;
      }
    }
  }
  return targetExe;
}

export function resolveTargetModel(bodyModel?: string | null, configModel?: string | null, workspaceDir?: string | null): string {
  let targetModel = bodyModel || configModel || '';
  if (targetModel && fs.existsSync(targetModel)) return targetModel;

  const searchDirs = [
    path.join(process.cwd(), 'models'),
    path.join(os.homedir(), '.0xagent', 'models'),
    ...(workspaceDir ? [path.join(workspaceDir, 'models')] : []),
  ];

  for (const sDir of searchDirs) {
    if (fs.existsSync(sDir)) {
      const files = fs.readdirSync(sDir);
      const gguf = files.find((f) => f.endsWith('.gguf') && !/mmproj|projector|clip/i.test(f));
      if (gguf) return path.join(sDir, gguf);
    }
  }
  return targetModel;
}

export function findBestMmproj(targetModel: string, customMmproj?: string, workspaceDir?: string | null): string | null {
  if (customMmproj && fs.existsSync(customMmproj)) return customMmproj;

  const candidateDirs = [
    path.dirname(targetModel),
    path.join(os.homedir(), '.0xagent', 'models'),
    path.join(process.cwd(), 'models'),
    ...(workspaceDir ? [path.join(workspaceDir, 'models')] : []),
  ];

  const modelBaseLower = path.basename(targetModel).toLowerCase();
  for (const cDir of candidateDirs) {
    if (fs.existsSync(cDir)) {
      try {
        const files = fs.readdirSync(cDir);
        const mmprojFiles = files.filter((f) => f.endsWith('.gguf') && /mmproj|projector|clip/i.test(f));
        if (mmprojFiles.length > 0) {
          const modelTokens = modelBaseLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
          const matched = mmprojFiles.find((f) => {
            const fLower = f.toLowerCase();
            return modelTokens.some((tok) => fLower.includes(tok));
          });
          const best = path.join(cDir, matched || mmprojFiles[0]);
          if (fs.existsSync(best)) return best;
        }
      } catch {}
    }
  }
  return null;
}

export function buildLlamaServerArgs(params: BuildLlamaArgsParams): { args: string[]; mmprojPath?: string; specDraftPath?: string } {
  const { targetModel, host, port, body, localServerConfig: ls = {}, workspaceDir, onLog } = params;
  const args: string[] = ['-m', targetModel, '--host', host, '--port', String(port)];

  // 1. Multimodal Projector (mmproj) for Vision / Audio support
  const mmprojTarget = findBestMmproj(targetModel, body.mmprojPath || ls.mmproj_path, workspaceDir);
  if (mmprojTarget) {
    args.push('--mmproj', mmprojTarget);
    onLog?.(`[MMPROJ] Автоматически подключен проектор зрения/аудио: ${path.basename(mmprojTarget)}`);
  }

  // 2. Speculative Decoding and FastMTP draft models
  let specDraftTarget = body.specDraftModel !== undefined ? body.specDraftModel : ls.spec_draft_model;
  const isDraftDisabled = specDraftTarget === 'none' || specDraftTarget === 'disabled' || specDraftTarget === false || ls.spec_type === 'none' || body.specType === 'none';
  const modelNameLower = path.basename(targetModel).toLowerCase();
  const isQwen3 = /qwen3|qwen-3|qwen_3|qwen 3|qwen3.8/i.test(modelNameLower);
  const isQwenModel = isQwen3 || /qwen/i.test(modelNameLower);

  if (!isDraftDisabled) {
    if (!specDraftTarget || !fs.existsSync(specDraftTarget)) {
      const candidateDirs = [
        path.dirname(targetModel),
        path.join(os.homedir(), '.0xagent', 'models'),
        path.join(process.cwd(), 'models'),
        ...(workspaceDir ? [path.join(workspaceDir, 'models')] : []),
      ];

      for (const cDir of candidateDirs) {
        if (fs.existsSync(cDir)) {
          try {
            const files = fs.readdirSync(cDir);
            const draftFiles = files.filter((f) => f.endsWith('.gguf') && /fastmtp|mtp|draft/i.test(f) && !/mmproj|projector|clip/i.test(f));
            if (draftFiles.length > 0) {
              const qwenDraft = isQwenModel ? draftFiles.find((f) => /qwen3.*fastmtp|fastmtp.*qwen3|fastmtp/i.test(f)) : null;
              const selected = path.join(cDir, qwenDraft || draftFiles[0]);
              if (fs.existsSync(selected)) {
                specDraftTarget = selected;
                break;
              }
            }
          } catch {}
        }
      }
    }

    const rawSpecType = body.specType || ls.spec_type || 'default';
    const specDraftNgl = body.specDraftNgl !== undefined && body.specDraftNgl !== null ? body.specDraftNgl : (ls.spec_draft_ngl !== undefined && ls.spec_draft_ngl !== null ? ls.spec_draft_ngl : 'all');
    const specDraftNMax = body.specDraftNMax !== undefined && body.specDraftNMax !== null ? body.specDraftNMax : (ls.spec_draft_n_max !== undefined && ls.spec_draft_n_max !== null ? ls.spec_draft_n_max : 1);
    const specDraftPMin = body.specDraftPMin !== undefined && body.specDraftPMin !== null ? body.specDraftPMin : (ls.spec_draft_p_min !== undefined && ls.spec_draft_p_min !== null ? ls.spec_draft_p_min : 0);

    if (specDraftTarget && fs.existsSync(specDraftTarget)) {
      args.push('--spec-draft-model', specDraftTarget, '--spec-type', rawSpecType);
      if (specDraftNgl !== undefined && specDraftNgl !== null) args.push('--spec-draft-ngl', String(specDraftNgl));
      if (specDraftNMax !== undefined && specDraftNMax !== null) args.push('--spec-draft-n-max', String(specDraftNMax));
      if (specDraftPMin !== undefined && specDraftPMin !== null) args.push('--spec-draft-p-min', String(specDraftPMin));
      onLog?.(`[SPECULATIVE] Подключена отдельная драфт-модель: ${path.basename(specDraftTarget)} (тип: ${rawSpecType}, n-max: ${specDraftNMax}, ngl: ${specDraftNgl})`);
    } else if (rawSpecType && rawSpecType.startsWith('ngram-')) {
      args.push('--spec-type', rawSpecType);
      if (specDraftNMax !== undefined && specDraftNMax !== null) args.push('--spec-draft-n-max', String(specDraftNMax));
      onLog?.(`[SPECULATIVE] Активирован ngram lookup (${rawSpecType}, n-max: ${specDraftNMax})`);
    }
  }

  // 3. Jinja & Reasoning template flags
  const jinja = body.jinja !== undefined ? body.jinja : ls.jinja;
  if (jinja || (jinja === undefined && isQwen3)) args.push('--jinja');

  const reasoningPreserve = body.reasoningPreserve !== undefined ? body.reasoningPreserve : ls.reasoning_preserve;
  if (reasoningPreserve || (reasoningPreserve === undefined && isQwen3)) args.push('--reasoning-preserve');

  const reasoningFormat = body.reasoningFormat || ls.reasoning_format || (isQwen3 ? 'deepseek' : null);
  if (reasoningFormat) args.push('--reasoning-format', reasoningFormat);

  const reasoningEffort = body.reasoningEffort || ls.reasoning_effort || (isQwen3 ? 'medium' : null);
  if (reasoningEffort && reasoningEffort !== 'off' && reasoningEffort !== 'auto') {
    args.push('--reasoning', 'on', '--reasoning-effort', reasoningEffort);
  }

  const reasoningBudget = body.reasoningBudget !== undefined ? body.reasoningBudget : ls.reasoning_budget;
  if (reasoningBudget !== undefined && reasoningBudget !== null && Number(reasoningBudget) > 0) {
    args.push('--reasoning-budget', String(reasoningBudget));
  }

  // 4. Hardware, Sampling & Context parameters
  const ctxSize = body.ctxSize !== undefined ? body.ctxSize : ls.ctx_size;
  if (ctxSize) args.push('-c', String(ctxSize));

  const gpuLayers = body.gpuLayers !== undefined ? body.gpuLayers : ls.gpu_layers;
  if (gpuLayers !== undefined && gpuLayers !== null) args.push('-ngl', String(gpuLayers));

  const threads = body.threads !== undefined ? body.threads : ls.threads;
  if (threads !== undefined && threads !== null && Number(threads) > 0) args.push('-t', String(threads));

  const batchSize = body.batchSize !== undefined ? body.batchSize : ls.batch_size;
  if (batchSize) args.push('-b', String(batchSize));

  const ubatchSize = body.ubatchSize !== undefined ? body.ubatchSize : ls.ubatch_size;
  if (ubatchSize) args.push('-ub', String(ubatchSize));

  const temp = body.temp !== undefined ? body.temp : ls.temp;
  if (temp !== undefined && temp !== null) {
    args.push('--temp', String(temp));
  } else if (isQwen3) {
    args.push('--temp', '0.6');
  }

  const repeatPenalty = body.repeatPenalty !== undefined ? body.repeatPenalty : ls.repeat_penalty;
  if (repeatPenalty !== undefined && repeatPenalty !== null) {
    args.push('--repeat-penalty', String(repeatPenalty));
  } else if (isQwen3) {
    args.push('--repeat-penalty', '1.05');
  }

  const minP = body.minP !== undefined ? body.minP : ls.min_p;
  if (minP !== undefined && minP !== null && Number(minP) > 0) args.push('--min-p', String(minP));

  const topK = body.topK !== undefined ? body.topK : ls.top_k;
  if (topK !== undefined && topK !== null) {
    const tk = Math.round(Number(topK));
    if (tk >= 1) args.push('--top-k', String(tk));
  }

  const topP = body.topP !== undefined ? body.topP : ls.top_p;
  if (topP !== undefined && topP !== null && Number(topP) < 1 && Number(topP) > 0) args.push('--top-p', String(topP));

  const flashAttn = body.flashAttn !== undefined ? body.flashAttn : ls.flash_attn;
  if (flashAttn) args.push('-fa', 'on');

  const mmap = body.mmap !== undefined ? body.mmap : ls.mmap;
  if (mmap === false) args.push('--no-mmap');

  const mlock = body.mlock !== undefined ? body.mlock : ls.mlock;
  if (mlock === true) args.push('--load-mode', 'mlock');

  const cacheReuse = body.cacheReuse !== undefined ? body.cacheReuse : ls.cache_reuse;
  if (cacheReuse !== undefined && cacheReuse !== null && Number(cacheReuse) > 0) args.push('--cache-reuse', String(cacheReuse));

  const slotSavePath = body.slotSavePath !== undefined ? body.slotSavePath : ls.slot_save_path;
  if (slotSavePath && typeof slotSavePath === 'string' && slotSavePath.trim()) args.push('--slot-save-path', slotSavePath.trim());

  const embedding = body.embedding !== undefined ? body.embedding : ls.embedding;
  if (embedding) args.push('--embedding');

  const parallelSlots = body.parallelSlots !== undefined ? body.parallelSlots : ls.parallel_slots;
  const nSlots = parallelSlots !== undefined && parallelSlots !== null && Number(parallelSlots) >= 1 ? Number(parallelSlots) : 1;
  args.push('-np', String(nSlots));

  const customArgs = body.customArgs !== undefined ? body.customArgs : ls.custom_args;
  if (customArgs && typeof customArgs === 'string' && customArgs.trim()) {
    const extra = customArgs.trim().split(/\s+/).filter(Boolean);
    args.push(...extra);
  }

  return { args, mmprojPath: mmprojTarget || undefined, specDraftPath: specDraftTarget || undefined };
}
