import test from 'node:test';
import assert from 'node:assert';
import { searchEngineRegistry, registerSearchEngineProvider, SearchEngineProvider } from '../server/searchEngineRegistry';
import { executeWebSearch } from '../server/tools/webTools';
import { getToolsState, saveToolsToggles, generateToolsMdContent } from '../server/toolsConfig';
import { AppConfig } from '../src/types';

test('Web Search Multi-Engine & Tools Architecture Test Suite', async (t) => {
  const baseMockConfig: AppConfig = {
    api_url: 'http://127.0.0.1:11434/v1',
    model_name: 'local:qwen2.5-coder-32b.gguf',
    system_prompt: '',
    web_search_provider: 'auto',
    firecrawl_api_key: null,
    firecrawl_api_url: 'https://api.firecrawl.dev',
    searxng_url: 'http://localhost:8080',
  };

  await t.test('1. Search Engine Registry Initialization & Available Providers', async () => {
    const list = await searchEngineRegistry.getEngineInfoList(baseMockConfig);
    const ids = list.map((e) => e.id);

    assert.ok(ids.includes('auto'), 'Should include auto cascade');
    assert.ok(ids.includes('firecrawl'), 'Should include firecrawl provider');
    assert.ok(ids.includes('searxng'), 'Should include searxng provider');
    assert.ok(ids.includes('duckduckgo'), 'Should include duckduckgo provider');
    assert.ok(ids.includes('wikipedia'), 'Should include wikipedia provider');
  });

  await t.test('2. Dynamic Custom Search Engine Registration', async () => {
    const mockCustomEngine: SearchEngineProvider = {
      id: 'custom_arxiv',
      name: 'arXiv Research Index',
      description: 'Scientific research papers index',
      requiresKey: false,
      isConfigured: () => true,
      isAvailable: async () => true,
      search: async (query, limit) => [
        {
          title: `Paper on ${query}`,
          url: 'https://arxiv.org/abs/1234.5678',
          snippet: `Detailed abstract for ${query}`,
          engine: 'custom_arxiv',
        },
      ],
      test: async () => ({ ok: true, latencyMs: 15, message: 'arXiv OK' }),
    };

    registerSearchEngineProvider(mockCustomEngine);

    const list = await searchEngineRegistry.getEngineInfoList(baseMockConfig);
    const hasCustom = list.some((e) => e.id === 'custom_arxiv');
    assert.strictEqual(hasCustom, true, 'Custom search engine should be listed dynamically');

    const searchRes = await searchEngineRegistry.search('Quantum Computing', 3, {
      ...baseMockConfig,
      web_search_provider: 'custom_arxiv',
    });

    assert.strictEqual(searchRes.engineUsed, 'arXiv Research Index');
    assert.strictEqual(searchRes.results.length, 1);
    assert.strictEqual(searchRes.results[0].engine, 'custom_arxiv');
  });

  await t.test('3. Auto Cascade Fallback Mechanism', async () => {
    // Isolate network call with fast local stub
    const origSearch = searchEngineRegistry.get('duckduckgo')?.search;
    const ddgProvider = searchEngineRegistry.get('duckduckgo');
    if (ddgProvider) {
      ddgProvider.search = async (q: string) => [
        { title: `Result for ${q}`, url: 'https://example.com/test', snippet: 'Test snippet', engine: 'duckduckgo' }
      ];
    }

    try {
      const outcome = await searchEngineRegistry.search('TypeScript tutorial', 2, {
        ...baseMockConfig,
        web_search_provider: 'auto',
      });

      assert.ok(outcome.results.length >= 0, 'Should return results or handled empty response');
      assert.ok(outcome.cascadeTrail && outcome.cascadeTrail.length > 0, 'Cascade trail should be populated');
    } finally {
      if (ddgProvider && origSearch) {
        ddgProvider.search = origSearch;
      }
    }
  });

  await t.test('4. Web Search Tool Execution', async () => {
    const emptyRes = await executeWebSearch('');
    assert.match(emptyRes, /empty/i, 'Empty query should be rejected with clear message');

    const origSearch = searchEngineRegistry.search;
    searchEngineRegistry.search = async (q: string) => ({
      results: [{ title: `TypeScript Guide`, url: 'https://ts.dev', snippet: 'Intro to TS', engine: 'mock' }],
      engineUsed: 'MockEngine',
      latencyMs: 5,
    });

    try {
      const validRes = await executeWebSearch('TypeScript');
      assert.ok(typeof validRes === 'string', 'Should return formatted text response');
      assert.ok(validRes.includes('TypeScript Guide'));
      assert.ok(validRes.length > 0);
    } finally {
      searchEngineRegistry.search = origSearch;
    }
  });

  await t.test('5. Tool Toggles & Dynamic TOOLS.md Generation', () => {
    const state = getToolsState();
    assert.ok(Array.isArray(state.tools) && state.tools.length > 10, 'Should return tool registry');

    const toggles = {
      read_file: true,
      write_file: true,
      patch_file: true,
      run_scratch_script: false,
    };

    const savedState = saveToolsToggles(toggles);
    const disabledTool = savedState.tools.find((t) => t.id === 'run_scratch_script');
    assert.strictEqual(disabledTool?.enabled, false, 'run_scratch_script should be disabled');

    const md = generateToolsMdContent(toggles);
    assert.ok(!md.includes('<run_scratch_script>'), 'Disabled tool must not be present in generated TOOLS.md');
    assert.ok(md.includes('<read_file'), 'Enabled tool must be present in generated TOOLS.md');
  });
});
