import { saveKnowledgeEntry, queryKnowledgeEntries, listKnowledgeCategories } from '../knowledgeBase';

export async function executeSaveKnowledge(params: {
  title: string;
  category?: string;
  content: string;
  summary?: string;
  tags?: string[];
  source?: string;
}): Promise<string> {
  if (!params.title || !params.content) {
    return '[Save Knowledge Error]: Title and content are required.';
  }
  const entry = await saveKnowledgeEntry({
    title: params.title,
    category: params.category || 'general',
    content: params.content,
    summary: params.summary,
    tags: params.tags,
    source: params.source || '0xAgent LLM',
  });

  return `Successfully saved entry to Knowledge Vault:\nID: ${entry.id}\nTitle: "${entry.title}"\nCategory: [${entry.category.toUpperCase()}]\nTags: ${entry.tags.join(', ') || 'none'}`;
}

export async function executeSearchKnowledge(query?: string, category?: string, tag?: string): Promise<string> {
  const results = await queryKnowledgeEntries({ query, category, tag });
  if (results.length === 0) {
    return `[Search Knowledge]: No entries found matching criteria (query: "${query || '*'}", category: "${category || 'all'}").`;
  }

  const lines = results.slice(0, 15).map((e, i) =>
    `[${i + 1}] ${e.title} (ID: ${e.id})\n    Category: ${e.category} | Tags: ${e.tags.join(', ') || 'none'}\n    Summary: ${e.summary}`
  );

  return `[Knowledge Vault Search Results (${results.length} found)]:\n\n${lines.join('\n\n')}`;
}

export async function executeListKnowledge(category?: string): Promise<string> {
  const results = await queryKnowledgeEntries({ category });
  const categories = await listKnowledgeCategories();

  const catSummary = categories.map(c => `- ${c.category}: ${c.count} entry(ies)`).join('\n');
  const entriesList = results.slice(0, 20).map(e => `- [${e.category.toUpperCase()}] ${e.title} (ID: ${e.id})`).join('\n');

  return `[Knowledge Vault Overview]\n\nCategories:\n${catSummary}\n\nEntries (${results.length}):\n${entriesList || 'No entries yet.'}`;
}
