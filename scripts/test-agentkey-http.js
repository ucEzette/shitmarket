#!/usr/bin/env node
/**
 * AgentKey HTTP API Test
 * Test real AgentKey endpoints for trending cashtags, crypto, and web3 news
 */

const fs = require('fs');
const path = require('path');

function readKey() {
  const envPath = path.join(process.cwd(), 'indexer', '.env');
  if (!fs.existsSync(envPath)) throw new Error('indexer/.env not found');
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split(/\r?\n/).find((l) => l.startsWith('CHAINBASE_AGENT_KEY='));
  if (!line) throw new Error('CHAINBASE_AGENT_KEY not found');
  return line.split('=')[1].trim();
}

async function callAgentKey(endpoint, params = {}) {
  const url = new URL(`https://api.agentkey.app/v1/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) url.searchParams.append(k, String(v));
  }
  
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${process.env.KEY}` },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

async function main() {
  process.env.KEY = readKey();
  console.log('🚀 AgentKey HTTP API Test');
  console.log(`📡 Key: ${process.env.KEY.slice(0, 8)}...\n`);

  // Test 1: Twitter trending
  console.log('✅ Test 1: Twitter Trending');
  try {
    const twitter = await callAgentKey('social/twitter/web/fetch_trending', { count: 5 });
    console.log(`   Response keys: ${Object.keys(twitter).join(', ')}`);
    const data = twitter.data || twitter.result || twitter;
    if (data && typeof data === 'object') {
      const keys = Array.isArray(data) ? 'array' : Object.keys(data).slice(0, 5).join(', ');
      console.log(`   Data type/sample keys: ${keys}`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item keys: ${Object.keys(data[0] || {}).join(', ')}`);
      }
    }
    console.log(`   ✓ Sample: ${JSON.stringify(data).slice(0, 150)}...`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  // Test 2: Crypto trending
  console.log('\n✅ Test 2: Crypto Trending');
  try {
    const crypto = await callAgentKey('crypto/market/trending', {});
    console.log(`   Response keys: ${Object.keys(crypto).join(', ')}`);
    const data = crypto.data || crypto.result || crypto;
    if (data && typeof data === 'object') {
      const keys = Array.isArray(data) ? 'array' : Object.keys(data).slice(0, 5).join(', ');
      console.log(`   Data type/sample keys: ${keys}`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item keys: ${Object.keys(data[0] || {}).join(', ')}`);
      }
    }
    console.log(`   ✓ Sample: ${JSON.stringify(data).slice(0, 150)}...`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  // Test 3: Crypto listings (for tickers with price data)
  console.log('\n✅ Test 3: Crypto Listings (for tickers)');
  try {
    const listings = await callAgentKey('crypto/market/listings', { limit: 5 });
    console.log(`   Response keys: ${Object.keys(listings).join(', ')}`);
    const data = listings.data || listings.result || listings;
    if (data && typeof data === 'object') {
      const keys = Array.isArray(data) ? 'array' : Object.keys(data).slice(0, 5).join(', ');
      console.log(`   Data type/sample keys: ${keys}`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item keys: ${Object.keys(data[0] || {}).join(', ')}`);
      }
    }
    console.log(`   ✓ Sample: ${JSON.stringify(data).slice(0, 150)}...`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  // Test 4: Web search (for news)
  console.log('\n✅ Test 4: Web Search for News');
  try {
    const news = await callAgentKey('search', { query: 'web3 crypto news', type: 'news', limit: 5 });
    console.log(`   Response keys: ${Object.keys(news).join(', ')}`);
    const data = news.data || news.result || news;
    if (data && typeof data === 'object') {
      const keys = Array.isArray(data) ? 'array' : Object.keys(data).slice(0, 5).join(', ');
      console.log(`   Data type/sample keys: ${keys}`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(`   First item keys: ${Object.keys(data[0] || {}).join(', ')}`);
      }
    }
    console.log(`   ✓ Sample: ${JSON.stringify(data).slice(0, 150)}...`);
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  // Test 5: Call /api/agentkey homepage endpoint
  console.log('\n✅ Test 5: Homepage /api/agentkey endpoint');
  try {
    const res = await fetch('http://localhost:3000/api/agentkey', { timeout: 30000 });
    if (!res.ok) {
      console.log(`   ✗ Status ${res.status}`);
    } else {
      const data = await res.json();
      console.log(`   ✓ Response contract:`);
      console.log(`      - trendingCashtags: ${data.trendingCashtags?.length || 0} items`);
      console.log(`      - hypeTopics: ${data.hypeTopics?.length || 0} items`);
      console.log(`      - intelligenceReport: ${data.intelligenceReport?.slice(0, 60) || '(empty)'}...`);
      if (data.trendingCashtags && data.trendingCashtags.length > 0) {
        console.log(`      - first cashtag: ${JSON.stringify(data.trendingCashtags[0])}`);
      }
    }
  } catch (e) {
    console.log(`   ✗ Error: ${e.message}`);
  }

  console.log('\n✅ Tests complete');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
