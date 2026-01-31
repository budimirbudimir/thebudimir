#!/usr/bin/env bun
/**
 * Test script for web search functionality
 * Run with: bun run test-search.ts
 */

// Test search service
import { formatSearchResults, webSearch } from './src/services/search';

async function testSearch() {
  console.log('🧪 Testing web search service...\n');

  const query = 'Mistral AI latest models 2026';
  console.log(`Query: "${query}"\n`);

  try {
    const results = await webSearch(query, 3);
    console.log(`Found ${results.numberOfResults} results\n`);

    const formatted = formatSearchResults(results);
    console.log(formatted);
  } catch (error) {
    console.error('❌ Search failed:', error);
  }
}

testSearch();
