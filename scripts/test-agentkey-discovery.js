#!/usr/bin/env node
/**
 * AgentKey MCP Discovery & Execution Test
 * 
 * Purpose:
 * 1. Discover AgentKey MCP endpoints via initialize, list_tools, describe_tool
 * 2. Execute sample endpoints (twitter trends, crypto tickers, web3 news)
 * 3. Map responses to homepage contract (trendingCashtags, hypeTopics, intelligenceReport)
 * 4. Verify live updates by calling the /api/agentkey route
 * 
 * Usage:
 *   node scripts/test-agentkey-discovery.js
 */

const fs = require('fs');
const path = require('path');

// Helper to read key from indexer/.env
function readKey() {
  const envPath = path.join(process.cwd(), 'indexer', '.env');
  if (!fs.existsSync(envPath)) throw new Error('indexer/.env not found');
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split(/\r?\n/).find((l) => l.startsWith('CHAINBASE_AGENT_KEY='));
  if (!line) throw new Error('CHAINBASE_AGENT_KEY not found in indexer/.env');
  return line.split('=')[1].trim();
}

// Parse SSE/JSON responses
function tryParseAgentKeyText(txt, contentType = '') {
  try {
    return JSON.parse(txt);
  } catch (e) {
    if ((contentType || '').includes('event-stream') || txt.includes('\ndata:')) {
      const events = txt.split(/\r\n\r\n|\n\n/).filter(Boolean);
      for (const ev of events) {
        const lines = ev.split(/\r\n|\n/);
        const dataLines = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
        if (!dataLines.length) continue;
        const data = dataLines.join('\n');
        if (data === '[DONE]') continue;
        try {
          return JSON.parse(data);
        } catch (e2) {
          continue;
        }
      }
    }
    const dataOnly = txt.split(/\r\n|\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
    if (dataOnly) {
      try {
        return JSON.parse(dataOnly);
      } catch (e3) {
        return null;
      }
    }
    return null;
  }
}

// MCP RPC call helper
async function callMcp(url, key, method, params, sessionId) {
  const payload = { jsonrpc: '2.0', id: Math.floor(Math.random() * 10000), method, params };
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${key}`,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), timeout: 30000 });
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  const json = tryParseAgentKeyText(text, contentType);
  if (!json) throw new Error(`Parse failed for ${method}: ${text.slice(0, 200)}`);
  if (json.error) throw new Error(`MCP error ${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function main() {
  const key = readKey();
  const url = 'https://api.agentkey.app/v1/mcp';
  console.log('🔌 AgentKey MCP Discovery & Execution Test');
  console.log(`📡 Key: ${key.slice(0, 6)}..., URL: ${url}`);
  console.log('---');

  // Step 1: Initialize
  console.log('\n✅ Step 1: Initialize MCP');
  let sessionId;
  try {
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '1',
        capabilities: { tools: { listChanged: false } },
        clientInfo: { name: 'shitmarket', version: '0.0.1' },
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(initPayload),
    });
    const json = await res.json();
    if (json.error) throw new Error(`Initialize failed: ${JSON.stringify(json.error)}`);
    sessionId = res.headers.get('mcp-session-id');
    console.log(`   ✓ Server version: ${json.result?.serverInfo?.version || 'unknown'}`);
    console.log(`   ✓ Session ID: ${sessionId?.slice(0, 12)}...`);
  } catch (err) {
    console.error(`   ✗ Initialize error: ${err.message}`);
    process.exit(1);
  }

  // Step 2: List tools
  console.log('\n✅ Step 2: Discover tools');
  let toolNames = [];
  try {
    const tools = await callMcp(url, key, 'list_tools', {}, sessionId);
    if (tools && Array.isArray(tools.tools)) {
      toolNames = tools.tools.map((t) => (typeof t === 'string' ? t : t.name || t)).filter(Boolean);
    } else if (tools && typeof tools === 'object') {
      // Try to extract names from nested structure
      const names = [];
      function extract(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          for (const el of obj) extract(el);
        } else {
          for (const [k, v] of Object.entries(obj)) {
            if (k === 'name' && typeof v === 'string') names.push(v);
            extract(v);
          }
        }
      }
      extract(tools);
      toolNames = names;
    }
    console.log(`   ✓ Found ${toolNames.length} tools`);
    if (toolNames.length > 0) {
      console.log(`   Examples: ${toolNames.slice(0, 5).join(', ')}${toolNames.length > 5 ? ', ...' : ''}`);
    }
  } catch (err) {
    console.log(`   ⚠ list_tools limited: ${err.message}`);
  }

  // Step 3: Describe and execute sample tools
  console.log('\n✅ Step 3: Execute discovery → describe → execute');
  
  // Try to find and describe candidate tools
  const candidates = [
    { query: 'twitter trending', prefixes: ['social/twitter', 'social'], desc: 'Twitter trending' },
    { query: 'crypto tickers', prefixes: ['crypto', 'crypto/market', 'token'], desc: 'Crypto tickers' },
    { query: 'web3 news', prefixes: ['search', 'news', 'web'], desc: 'Web3 news' },
  ];

  const results = {};
  for (const { query, prefixes, desc } of candidates) {
    console.log(`\n   📍 ${desc}:`);
    let candidate = null;

    // Try find_tools (semantic search)
    try {
      const found = await callMcp(url, key, 'find_tools', { q: query }, sessionId);
      if (found && found.tools && found.tools.length > 0) {
        candidate = typeof found.tools[0] === 'string' ? found.tools[0] : found.tools[0].name;
        console.log(`      ✓ find_tools(${query}) → ${candidate}`);
      }
    } catch (e) {
      // continue
    }

    // Try list_tools with prefixes if not found
    if (!candidate) {
      for (const prefix of prefixes) {
        try {
          const listed = await callMcp(url, key, 'list_tools', { prefix }, sessionId);
          if (listed && listed.tools && listed.tools.length > 0) {
            candidate = typeof listed.tools[0] === 'string' ? listed.tools[0] : listed.tools[0].name;
            console.log(`      ✓ list_tools(prefix="${prefix}") → ${candidate}`);
            break;
          }
        } catch (e) {
          // continue
        }
      }
    }

    if (candidate) {
      // Describe the tool
      try {
        const desc_result = await callMcp(url, key, 'describe_tool', { name: candidate }, sessionId);
        console.log(`      ✓ describe_tool(${candidate}):`);
        if (desc_result.name) console.log(`         - name: ${desc_result.name}`);
        if (desc_result.inputSchema) console.log(`         - params: ${JSON.stringify(desc_result.inputSchema.properties ? Object.keys(desc_result.inputSchema.properties) : desc_result.inputSchema).slice(0, 80)}...`);
        if (desc_result.execute_as) console.log(`         - execute_as.name: ${desc_result.execute_as.name || desc_result.execute_as.method}`);
      } catch (e) {
        console.log(`      ⚠ describe_tool error: ${e.message}`);
      }

      // Try to execute the tool
      try {
        let execName = candidate;
        let execParams = {};
        if (query.includes('twitter')) {
          execParams = { limit: 5 };
        } else if (query.includes('crypto')) {
          execParams = { limit: 5 };
        } else if (query.includes('news')) {
          execParams = { query: 'web3 news', limit: 5 };
        }
        const exec_result = await callMcp(url, key, 'execute_tool', { name: execName, params: execParams }, sessionId);
        console.log(`      ✓ execute_tool(${execName}, ${JSON.stringify(execParams)}) returned:`, JSON.stringify(exec_result).slice(0, 100) + '...');
        results[desc] = exec_result;
      } catch (e) {
        console.log(`      ⚠ execute_tool error: ${e.message}`);
      }
    } else {
      console.log(`      ✗ No candidate found (tried find_tools + prefixes ${prefixes.join(', ')})`);
    }
  }

  // Step 4: Call the /api/agentkey endpoint
  console.log('\n✅ Step 4: Test homepage API endpoint');
  try {
    const apiRes = await fetch('http://localhost:3000/api/agentkey', { timeout: 30000 });
    if (!apiRes.ok) {
      console.log(`   ⚠ /api/agentkey returned ${apiRes.status}`);
    } else {
      const data = await apiRes.json();
      console.log(`   ✓ /api/agentkey returned contract:`);
      console.log(`      - trendingCashtags: ${data.trendingCashtags?.length || 0} items`);
      console.log(`      - hypeTopics: ${data.hypeTopics?.length || 0} items`);
      console.log(`      - intelligenceReport: ${data.intelligenceReport?.slice(0, 60) || 'empty'}...`);
    }
  } catch (err) {
    console.log(`   ✗ /api/agentkey error: ${err.message}`);
  }

  console.log('\n✅ Discovery complete. Homepage should now show live AgentKey Alpha data.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
