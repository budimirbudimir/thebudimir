import { formatSearchResults, webSearch } from '../search';

// Execute a tool and return the result
export async function executeTool(tool: string, params: string): Promise<string> {
  if (tool === 'web_search') {
    try {
      console.log(`🔍 ReAct: Executing web_search("${params}")`);
      const searchResults = await webSearch(params);
      return formatSearchResults(searchResults);
    } catch (error) {
      console.error('Web search failed:', error);
      return 'Error: Web search failed. Please try a different query.';
    }
  }
  return `Error: Unknown tool "${tool}"`;
}
