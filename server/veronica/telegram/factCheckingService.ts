import { searchEngineRegistry } from '../../searchEngineRegistry';
import { loadConfig } from '../../config';
import { veronicaOrchestrator } from './veronicaOrchestrator';

export type FactVerdict = 'Правда' | 'Фейк' | 'Манипуляция' | 'Вне контекста' | 'Недостаточно данных';

export interface FactCheckClaimResult {
  claim: string;
  verdict: FactVerdict;
  explanation: string;
  reality: string;
  sources: { title: string; url: string }[];
}

export interface FactCheckReport {
  originalTopic: string;
  overallVerdict: FactVerdict;
  summary: string;
  claims: FactCheckClaimResult[];
  searchedQueries: string[];
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class FactCheckingService {
  private static instance: FactCheckingService;

  private constructor() {}

  public static getInstance(): FactCheckingService {
    if (!FactCheckingService.instance) {
      FactCheckingService.instance = new FactCheckingService();
    }
    return FactCheckingService.instance;
  }

  /**
   * Complete end-to-end fact check pipeline:
   * 1. Extract core claims from speech/transcript text
   * 2. Search web for factual corroboration/debunking
   * 3. Evaluate truthfulness via Veronica LLM
   * 4. Return structured report
   */
  public async verifyTranscript(
    transcript: string,
    metadata?: { title?: string; uploader?: string; url?: string }
  ): Promise<FactCheckReport> {
    const config = loadConfig();
    const cleanText = (transcript || '').trim();

    // 1. Extract factual claims to verify
    const claims = await this.extractClaims(cleanText, metadata?.title);

    // 2. Perform web search verification for the claims
    const searchContexts: { claim: string; query: string; results: { title: string; url: string; snippet: string }[] }[] = [];
    const searchedQueries: string[] = [];

    for (const claim of claims.slice(0, 3)) {
      const query = this.buildSearchQuery(claim, metadata?.title);
      searchedQueries.push(query);

      try {
        const { results } = await searchEngineRegistry.search(query, 3, config);
        searchContexts.push({
          claim,
          query,
          results: (results || []).map((r) => ({
            title: r.title || 'Untitled',
            url: r.url || '',
            snippet: r.snippet || '',
          })),
        });
      } catch (searchErr) {
        console.warn(`[FactCheckingService] Search error for query "${query}":`, searchErr);
      }
    }

    // 3. Evaluate veracity with Veronica LLM
    const report = await this.evaluateClaimsWithLLM(cleanText, searchContexts, metadata);
    report.searchedQueries = searchedQueries;

    return report;
  }

  /**
   * Extract verifiable factual claims from text
   */
  private async extractClaims(text: string, title?: string): Promise<string[]> {
    if (!text || text.length < 15) {
      return [title || text || 'Утверждение из видео'];
    }

    const prompt = `Analyze this spoken transcript from a video and extract 1 to 3 concrete, verifiable factual claims/statements.
TRANSCRIPT:
"${text.slice(0, 3000)}"
${title ? `VIDEO TITLE: ${title}` : ''}

Output ONLY a JSON array of strings in Russian, for example:
["Утверждение 1", "Утверждение 2"]
Do not add markdown formatting or commentary.`;

    try {
      const response = await veronicaOrchestrator.callRawLlm(prompt);
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      // Heuristic fallback
    }

    // Fallback: Split by sentence
    const sentences = text
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 200);

    return sentences.slice(0, 2);
  }

  private buildSearchQuery(claim: string, title?: string): string {
    // Keep query concise without punctuation
    const clean = claim
      .replace(/[«»""''.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const words = clean.split(' ').slice(0, 8).join(' ');
    return words || title || 'фактчек новости';
  }

  /**
   * Synthesize final verdict using Veronica LLM
   */
  private async evaluateClaimsWithLLM(
    originalText: string,
    searchContexts: { claim: string; query: string; results: { title: string; url: string; snippet: string }[] }[],
    metadata?: { title?: string; uploader?: string; url?: string }
  ): Promise<FactCheckReport> {
    const contextFormatted = searchContexts
      .map(
        (sc, i) =>
          `[Claim ${i + 1}]: "${sc.claim}"\nWeb Search Evidence:\n` +
          sc.results.map((r) => `- Title: ${r.title}\n  URL: ${r.url}\n  Snippet: ${r.snippet}`).join('\n')
      )
      .join('\n\n');

    const prompt = `You are Veronica's elite Fact-Checking & Intelligence Engine.
Analyze the transcribed video content and the web search evidence to deliver an objective, rigorous fact-check verdict.

TRANSCRIPT:
"${originalText.slice(0, 2500)}"
${metadata?.title ? `VIDEO TITLE: ${metadata.title}` : ''}
${metadata?.uploader ? `AUTHOR: ${metadata.uploader}` : ''}

SEARCH EVIDENCE:
${contextFormatted || 'No live web evidence retrieved.'}

POSSIBLE VERDICTS:
- "Правда" (Factually accurate)
- "Фейк" (Fabricated or scientifically/historically refuted)
- "Манипуляция" (Distorted, cherry-picked data, misleading framing)
- "Вне контекста" (Genuine quote or event presented in an inaccurate context)
- "Недостаточно данных" (Unverifiable or ambiguous)

Output strictly valid JSON matching this schema:
{
  "originalTopic": "Short topic name in Russian (max 50 chars)",
  "overallVerdict": "Правда" | "Фейк" | "Манипуляция" | "Вне контекста" | "Недостаточно данных",
  "summary": "1-2 sentence executive verdict summary in Russian",
  "claims": [
    {
      "claim": "The exact claim tested",
      "verdict": "Правда" | "Фейк" | "Манипуляция" | "Вне контекста" | "Недостаточно данных",
      "explanation": "Why this verdict was assigned based on evidence",
      "reality": "What actually occurred / the factual reality",
      "sources": [
        { "title": "Source Name or Title", "url": "https://..." }
      ]
    }
  ]
}
Return ONLY valid JSON.`;

    try {
      const response = await veronicaOrchestrator.callRawLlm(prompt);
      const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        originalTopic: parsed.originalTopic || metadata?.title || 'Анализ видеоматериала',
        overallVerdict: this.normalizeVerdict(parsed.overallVerdict),
        summary: parsed.summary || 'Фактчекинг утверждений завершён.',
        claims: Array.isArray(parsed.claims)
          ? parsed.claims.map((c: any) => ({
              claim: c.claim || 'Утверждение',
              verdict: this.normalizeVerdict(c.verdict),
              explanation: c.explanation || '',
              reality: c.reality || '',
              sources: Array.isArray(c.sources) ? c.sources : [],
            }))
          : [],
        searchedQueries: [],
      };
    } catch (err) {
      console.warn('[FactCheckingService] LLM evaluation error, using fallback report:', err);

      // Fallback verdict
      return {
        originalTopic: metadata?.title || 'Проверка видеозаписи',
        overallVerdict: 'Недостаточно данных',
        summary: 'Не удалось завершить углублённую сверку с источниками.',
        claims: searchContexts.map((sc) => ({
          claim: sc.claim,
          verdict: 'Недостаточно данных',
          explanation: 'Автоматическая сверка требует ручной проверки.',
          reality: 'Сверьтесь с проверенными первоисточниками.',
          sources: sc.results.map((r) => ({ title: r.title, url: r.url })),
        })),
        searchedQueries: [],
      };
    }
  }

  private normalizeVerdict(val: any): FactVerdict {
    const s = String(val || '').toLowerCase();
    if (s.includes('правда') || s.includes('true')) return 'Правда';
    if (s.includes('фейк') || s.includes('fake') || s.includes('ложь')) return 'Фейк';
    if (s.includes('манипуляц') || s.includes('manipulat')) return 'Манипуляция';
    if (s.includes('контекст') || s.includes('context')) return 'Вне контекста';
    return 'Недостаточно данных';
  }

  /**
   * Formats the report into a Telegram HTML card
   */
  public formatTelegramCard(report: FactCheckReport, sourceUrl?: string): string {
    const verdictIcons: Record<FactVerdict, string> = {
      'Правда': '🟢 <b>ИСТИНА (ПРАВДА)</b>',
      'Фейк': '🔴 <b>ФЕЙК (ЛОЖЬ)</b>',
      'Манипуляция': '🟠 <b>МАНИПУЛЯЦИЯ</b>',
      'Вне контекста': '🟡 <b>ВЫРВАНО ИЗ КОНТЕКСТА</b>',
      'Недостаточно данных': '⚪ <b>НЕ ПОДТВЕРЖДЕНО</b>',
    };

    const lines: string[] = [
      `🛡️ <b>Вероника :: Фактчек &amp; Анализ видео</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `📌 <b>Тема:</b> ${escapeHtml(report.originalTopic)}`,
      `⚖️ <b>Вердикт:</b> ${verdictIcons[report.overallVerdict] || report.overallVerdict}`,
      ``,
      `📝 <b>Резюме:</b> ${escapeHtml(report.summary)}`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
    ];

    if (report.claims && report.claims.length > 0) {
      for (const [i, c] of report.claims.entries()) {
        const icon = c.verdict === 'Правда' ? '✅' : c.verdict === 'Фейк' ? '❌' : c.verdict === 'Манипуляция' ? '⚠️' : '🔍';
        lines.push(``);
        lines.push(`${icon} <b>Тезис ${i + 1}:</b> <i>«${escapeHtml(c.claim)}»</i>`);
        lines.push(`📊 <b>Оценка:</b> <code>${escapeHtml(c.verdict)}</code>`);
        if (c.explanation) {
          lines.push(`🔍 <b>Анализ:</b> ${escapeHtml(c.explanation)}`);
        }
        if (c.reality) {
          lines.push(`💡 <b>Как на самом деле:</b> ${escapeHtml(c.reality)}`);
        }
        if (c.sources && c.sources.length > 0) {
          const srcLinks = c.sources
            .filter((s) => s.url && s.url.startsWith('http'))
            .slice(0, 3)
            .map((s) => `<a href="${escapeHtml(s.url)}">${escapeHtml(s.title || 'Источник')}</a>`)
            .join(' | ');
          if (srcLinks) {
            lines.push(`🔗 <b>Источники:</b> ${srcLinks}`);
          }
        }
      }
    }

    if (sourceUrl) {
      lines.push(``);
      lines.push(`📹 <i>Ссылка на материал:</i> <a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a>`);
    }

    return lines.join('\n');
  }
}

export const factCheckingService = FactCheckingService.getInstance();
