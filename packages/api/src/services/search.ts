/**
 * Web search service using multiple search providers
 * Falls back to multiple instances for reliability
 *
 * Supported providers:
 * - Brave Search API (set BRAVE_SEARCH_API_KEY env var)
 * - SearxNG public instances
 * - Mock data for development
 */

const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

const SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://paulgo.io',
  'https://search.mdosch.de',
  'https://searx.tiekoetter.com',
];

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  numberOfResults: number;
}

/**
 * Search using Brave Search API
 */
async function searchBrave(query: string, maxResults = 5): Promise<SearchResponse> {
  if (!BRAVE_SEARCH_API_KEY) {
    return { query, results: [], numberOfResults: 0 };
  }

  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', maxResults.toString());

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_SEARCH_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search returned ${response.status}`);
    }

    const data = (await response.json()) as any;
    const results: SearchResult[] = (data.web?.results || [])
      .slice(0, maxResults)
      .map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        content: result.description || '',
        publishedDate: result.age,
      }))
      .filter((result: SearchResult) => result.title && result.url);

    return {
      query,
      results,
      numberOfResults: results.length,
    };
  } catch (error) {
    console.error('Brave Search failed:', error);
    return {
      query,
      results: [],
      numberOfResults: 0,
    };
  }
}

/**
 * Mock search data for development/testing
 */
async function mockSearch(query: string, maxResults = 5): Promise<SearchResponse> {
  console.log('⚠️  Using mock search data (configure BRAVE_SEARCH_API_KEY for real search)');

  const mockResults: SearchResult[] = [
    {
      title: `Information about: ${query}`,
      url: 'https://example.com/result1',
      content: `This is a mock search result for "${query}". In a production environment, this would contain real search results from the web.`,
    },
    {
      title: 'Latest updates and news',
      url: 'https://example.com/result2',
      content:
        'Mock search results are being used. Configure a real search API key to get actual web results.',
    },
    {
      title: 'Documentation and resources',
      url: 'https://example.com/result3',
      content: 'For production use, set up Brave Search API key in your environment variables.',
    },
  ].slice(0, maxResults);

  return {
    query,
    results: mockResults,
    numberOfResults: mockResults.length,
  };
}

/**
 * Perform a web search using available providers
 * Priority: Brave API > SearxNG > Mock data
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResponse> {
  // Try Brave Search API first if configured
  if (BRAVE_SEARCH_API_KEY) {
    const braveResults = await searchBrave(query, maxResults);
    if (braveResults.numberOfResults > 0) {
      return braveResults;
    }
  }

  // Try SearxNG instances
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = new URL(`${instance}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('engines', 'google,bing,duckduckgo');
      url.searchParams.set('safesearch', '0');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ThebudimirBot/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue; // Try next instance
      }

      const text = await response.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        console.error(`${instance} returned invalid JSON`);
        continue;
      }

      const results: SearchResult[] = (data.results || [])
        .slice(0, maxResults)
        .map((result: any) => ({
          title: result.title || '',
          url: result.url || '',
          content: result.content || '',
          publishedDate: result.publishedDate,
        }))
        .filter((result: SearchResult) => result.title && result.url); // Filter out empty results

      if (results.length > 0) {
        return {
          query,
          results,
          numberOfResults: results.length,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Search failed for ${instance}: ${errorMessage}`);
      // Continue to next instance
    }
  }

  // If all instances fail, use mock data for development
  return mockSearch(query, maxResults);
}

/**
 * Format search results for AI consumption
 */
export function formatSearchResults(searchResponse: SearchResponse): string {
  if (searchResponse.numberOfResults === 0) {
    return `No search results found for "${searchResponse.query}".`;
  }

  let formatted = `Search results for "${searchResponse.query}":\n\n`;

  for (const [index, result] of searchResponse.results.entries()) {
    formatted += `[${index + 1}] ${result.title}\n`;
    formatted += `URL: ${result.url}\n`;
    formatted += `${result.content}\n`;
    if (result.publishedDate) {
      formatted += `Published: ${result.publishedDate}\n`;
    }
    formatted += '\n';
  }

  return formatted;
}
