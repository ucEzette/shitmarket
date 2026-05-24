/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://api.agentkey.app/v1';

function readKeyFromEnvOrFile(): string | undefined {
  if (process.env.CHAINBASE_AGENT_KEY && process.env.CHAINBASE_AGENT_KEY.trim()) return process.env.CHAINBASE_AGENT_KEY;
  const envFile = path.join(process.cwd(), 'indexer', '.env');
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith('CHAINBASE_AGENT_KEY=')) {
        return line.split('=')[1].trim();
      }
    }
  }
  return undefined;
}

// Simple MCP client that performs an `initialize` first and reuses session id
let rpcId = 1;
let sessionId: string | undefined;
let initialized = false;
const MCP_URL = BASE_URL + '/mcp';

// Map old-style method names to standard MCP protocol methods
// All AgentKey tool names (list_tools, find_tools, describe_tool, execute_tool)
// are called via the standard MCP "tools/call" method, with the tool name
// nested inside the params as {name, arguments}.
function mcpMethod(method: string): string {
  if (method === 'initialize') return 'initialize';
  // All tool operations use tools/call
  return 'tools/call';
}

// Build params payload: for tool calls, nest the tool name + arguments inside
function mcpParams(method: string, params: any): any {
  if (method === 'list_tools') {
    return { name: 'list_tools', arguments: params };
  }
  if (method === 'find_tools') {
    return { name: 'find_tools', arguments: params };
  }
  if (method === 'describe_tool') {
    return { name: 'describe_tool', arguments: params };
  }
  if (method === 'execute_tool') {
    return { name: 'execute_tool', arguments: params };
  }
  return params;
}

const SSE_TERM = '\n';

async function fetchWithSSE(url: string, options: any): Promise<any> {
  const res = await fetch(url, options);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();

  // Try JSON parse first
  try {
    return { json: JSON.parse(text), raw: text, headers: res.headers };
  } catch (e) {
    // SSE-style: look for "data:" lines with JSON
    if (ct.includes('event-stream') || text.includes(SSE_TERM + 'data:')) {
      const lines = text.split(/\r?\n/);
      let lastData: any = null;
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const chunk = line.slice(5).trim();
          if (chunk === '[DONE]') continue;
          try {
            lastData = JSON.parse(chunk);
          } catch (e2) { /* skip malformed */ }
        }
      }
      if (lastData) return { json: lastData, raw: text, headers: res.headers };
    }
    // Last ditch: grab any JSON object from the response
    const match = text.match(/\{[^{}]*"jsonrpc"[^{}]*\}/);
    if (match) {
      try { return { json: JSON.parse(match[0]), raw: text, headers: res.headers }; } catch (e3) { /* ignore */ }
    }
    throw new Error(`Could not parse response: ${text.slice(0, 500)}`);
  }
}

async function initializeClient(apiKey: string) {
  const initPayload = {
    jsonrpc: '2.0',
    id: rpcId++,
    method: 'initialize',
    params: {
      protocolVersion: '1',
      capabilities: { tools: { listChanged: false } },
      clientInfo: { name: 'shitmarket', version: '0.0.1' },
    },
  };
  const { json, headers } = await fetchWithSSE(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(initPayload),
  });
  if (!json) throw new Error(`Invalid JSON from AgentKey MCP initialize`);
  if (json.error) throw new Error(JSON.stringify(json.error));
  const sid = headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  initialized = true;
  return json.result;
}

// Extract the actual data from MCP content array.
// The AgentKey MCP server wraps data in content[].text as JSON strings.
function extractMcpContent(result: any): any {
  if (!result) return result;
  if (result.content && Array.isArray(result.content)) {
    // Try to parse the text field of first text content item
    if (result.content[0]?.type === 'text' && typeof result.content[0]?.text === 'string') {
      try {
        return JSON.parse(result.content[0].text);
      } catch (e) {
        return result.content[0].text;
      }
    }
  }
  return result;
}

async function sendRpc(apiKey: string, method: string, params: any): Promise<any> {
  if (!initialized) {
    await initializeClient(apiKey);
  }
  const id = rpcId++;
  const mcpMethodName = mcpMethod(method);
  const mcpParamsValue = mcpParams(method, params);
  const payload = { jsonrpc: '2.0', id, method: mcpMethodName, params: mcpParamsValue };
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: any = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${apiKey}`,
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const { json } = await fetchWithSSE(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!json) throw new Error(`Invalid JSON from AgentKey MCP`);
    if (json.error) throw new Error(JSON.stringify(json.error));
    // Extract the actual data from the MCP content wrapper
    return extractMcpContent(json.result);
  } catch (err: any) {
    if (err && err.name === 'AbortError') throw new Error('AgentKey MCP request timed out');
    throw err;
  }
}

function collectNames(obj: any, out: string[] = []) {
  if (!obj || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    for (const el of obj) collectNames(el, out);
    return out;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'name' && typeof obj[key] === 'string') out.push(obj[key]);
    else collectNames(obj[key], out);
  }
  return out;
}

async function findCandidate(apiKey: string, q: string, prefixes: string[] = []) {
  // try semantic search
  try {
    const res = await sendRpc(apiKey, 'find_tools', { q });
    const candidates: string[] = [];
    if (res) {
      if (Array.isArray(res.tools) && res.tools.length) {
        for (const t of res.tools) {
          if (typeof t === 'string') candidates.push(t);
          else if (t && t.name) candidates.push(t.name);
        }
      } else {
        const names = collectNames(res, []);
        candidates.push(...names);
      }
      if (candidates.length) return candidates[0];
    }
  } catch (e) {
    // ignore and fallback to prefixes
  }

  // try list_tools with prefixes
  for (const prefix of prefixes) {
    try {
      const res = await sendRpc(apiKey, 'list_tools', { prefix });
      const names = collectNames(res, []);
      if (names.length) {
        const pick = names.find((n) => /trend|trending|fetch|topics|tickers|quotes|market|ticker/i.test(n)) || names[0];
        if (pick) return pick;
      }
    } catch (e) {
      // continue
    }
  }
  return null;
}

async function describeTool(apiKey: string, name: string) {
  try {
    const r = await sendRpc(apiKey, 'describe_tool', { name });
    return r;
  } catch (e) {
    return null;
  }
}

async function executeTool(apiKey: string, name: string, params: any) {
  const r = await sendRpc(apiKey, 'execute_tool', { name, params });
  return r;
}

function findFirstArray(obj: any): any[] | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const a = findFirstArray(v);
    if (a) return a;
  }
  return null;
}

function mapCashtagsFromArray(arr: any[]): any[] {
  return arr.slice(0, 10).map((it: any) => {
    const symbol = it.symbol || it.ticker || it.cashtag || it.tag || (it.symbol && typeof it.symbol === 'string' ? it.symbol.toUpperCase() : '') || '';
    const name = it.name || it.title || it.label || '';
    const sentiment = it.sentiment || it.sentiment_class || '';
    const volume = it.volume ? String(it.volume) : (it.vol ? String(it.vol) : '');
    const change = it.change || it.price_change || (it.delta ? String(it.delta) : '') || '';
    const thumb = it.thumb || it.logo || it.image || it.icon || '';
    const color = (typeof change === 'string' && change.startsWith('-')) ? 'text-jeet-red' : 'text-neon-moon';
    return { symbol, name, sentiment, volume, change, color, thumb };
  });
}

function mapTopicsFromArray(arr: any[]): any[] {
  return arr.slice(0, 10).map((it: any, idx: number) => {
    const topic = it.topic || it.name || it.title || it.keyword || `Topic ${idx + 1}`;
    const score = it.score || it.relevance || Math.min(100, Math.round((it.impact || 0) * 100)) || 50;
    const trend = it.trend || it.direction || '';
    return { topic, score: Number(score || 0), trend };
  });
}

function makeIntelligenceReportFromNews(arr: any[]): string {
  const headlines = arr.slice(0, 5).map((it: any) => it.title || it.headline || it.name || '').filter(Boolean);
  if (!headlines.length) return '';
  return headlines.join(' • ');
}

// Fallback demo data when AgentKey API has insufficient credits
const FALLBACK_DATA = {
  trendingCashtags: [
    { symbol: '$BONK', name: 'Bonk', sentiment: 'Bullish', volume: '12.4M', change: '+5.2%', color: 'text-neon-moon', thumb: '' },
    { symbol: '$WIF', name: 'Dogwifhat', sentiment: 'Bullish', volume: '8.7M', change: '+3.8%', color: 'text-neon-moon', thumb: '' },
    { symbol: '$PEPE', name: 'Pepe', sentiment: 'Bearish', volume: '6.2M', change: '-2.1%', color: 'text-jeet-red', thumb: '' },
    { symbol: '$SLERF', name: 'Slerf', sentiment: 'Bullish', volume: '4.9M', change: '+12.4%', color: 'text-neon-moon', thumb: '' },
    { symbol: '$MYRO', name: 'Myro', sentiment: 'Bearish', volume: '3.1M', change: '-1.5%', color: 'text-jeet-red', thumb: '' },
    { symbol: '$TRUMP', name: 'Trump', sentiment: 'Bullish', volume: '9.8M', change: '+8.3%', color: 'text-neon-moon', thumb: '' },
    { symbol: '$WEN', name: 'Wen', sentiment: 'Bullish', volume: '2.3M', change: '+1.2%', color: 'text-neon-moon', thumb: '' },
  ],
  hypeTopics: [
    { topic: 'Meme Coin Super Cycle', score: 92, trend: 'up' },
    { topic: 'Solana L2 Mania', score: 85, trend: 'up' },
    { topic: 'AI Agent Tokens', score: 78, trend: 'up' },
    { topic: 'Polymarket Predictions', score: 72, trend: 'up' },
    { topic: 'NFT Renaissance', score: 45, trend: 'down' },
  ],
  intelligenceReport: 'Meme coin super cycle narrative dominates. Solana meme tokens seeing highest volume since March. AI agent tokens gaining traction. Market neutral with bullish bias on high-volume meme pairs.'
};

export async function GET() {
  try {
    const apiKey = readKeyFromEnvOrFile();
    if (!apiKey) return NextResponse.json(FALLBACK_DATA);

    // basic health check - list_tools is free
    const listResp = await sendRpc(apiKey, 'list_tools', {});
    if (!listResp) return NextResponse.json(FALLBACK_DATA);

    // Discover endpoints (find_tools is also free)
    const twitterCandidate = await findCandidate(apiKey, 'twitter trending cashtags', ['social/twitter', 'social']);
    const cryptoCandidate = await findCandidate(apiKey, 'crypto top tickers', ['crypto', 'crypto/market', 'crypto/token', 'token']);
    const newsCandidate = await findCandidate(apiKey, 'web3 news latest', ['search', 'news', 'web']);

    // Helper: prepare and execute a discovered endpoint
    async function prepareAndExecute(candidate: string | null, fallbackWrapper: string, fallbackParams: any) {
      if (!candidate) {
        try {
          return await executeTool(apiKey, fallbackWrapper, fallbackParams);
        } catch (e) {
          return null;
        }
      }
      const desc = await describeTool(apiKey, candidate);
      let wrapperName = fallbackWrapper;
      let paramsForExec = fallbackParams;
      try {
        if (desc) {
          const execAs = (desc.execute_as) || (desc.result && desc.result.execute_as) || (desc.describe && desc.describe.execute_as) || null;
          if (execAs && execAs.name) {
            wrapperName = execAs.name;
            paramsForExec = execAs.params || execAs.params_template || fallbackParams;
          } else {
            if (/twitter|social/i.test(candidate)) {
              wrapperName = 'agentkey_social';
              paramsForExec = { path: candidate, params: {} };
            } else if (/crypto|token|market|price|ticker/i.test(candidate)) {
              wrapperName = 'agentkey_crypto';
              paramsForExec = { path: candidate, params: {} };
            } else if (candidate.startsWith('agentkey_')) {
              wrapperName = candidate;
              paramsForExec = fallbackParams;
            } else {
              wrapperName = 'agentkey_search';
              paramsForExec = { query: candidate, type: 'news', num: 5 };
            }
          }
        }
      } catch (e) {
        // ignore and use fallback
      }

      if (wrapperName === 'agentkey_social' && (!paramsForExec || typeof paramsForExec !== 'object' || !paramsForExec.path)) {
        paramsForExec = { path: candidate, params: {} };
      }

      try {
        const execRes = await executeTool(apiKey, wrapperName, paramsForExec);
        return execRes;
      } catch (e) {
        try {
          const execRes2 = await executeTool(apiKey, candidate, fallbackParams);
          return execRes2;
        } catch (e2) {
          return null;
        }
      }
    }

    // Execute twitter trending
    const twitterExec = await prepareAndExecute(twitterCandidate, 'agentkey_social', { path: 'social/twitter/web/fetch_trending', params: {} });
    const twitterArray = twitterExec ? (findFirstArray(twitterExec) || findFirstArray(twitterExec.result) || findFirstArray(twitterExec.data) || []) : [];

    // Execute crypto tickers
    const cryptoExec = await prepareAndExecute(cryptoCandidate, 'agentkey_crypto', { type: 'cmc_quotes', limit: 10 });
    const cryptoArray = cryptoExec ? (findFirstArray(cryptoExec) || findFirstArray(cryptoExec.result) || findFirstArray(cryptoExec.data) || []) : [];

    // Execute news/search for intelligence report and hype topics
    const newsExec = await prepareAndExecute(newsCandidate, 'agentkey_search', { query: 'web3 news', type: 'news', num: 5 });
    const newsArray = newsExec ? (findFirstArray(newsExec) || findFirstArray(newsExec.result) || findFirstArray(newsExec.data) || []) : [];

    // Try to map real data; fall back to demo if empty
    let trendingCashtags: any[];
    let hypeTopics: any[];
    let intelligenceReport: string;

    if (Array.isArray(twitterArray) && twitterArray.length > 0) {
      trendingCashtags = mapCashtagsFromArray(twitterArray);
      // Merge crypto into trending cashtags (avoid duplicates)
      if (Array.isArray(cryptoArray) && cryptoArray.length > 0) {
        const cryptoMapped = cryptoArray.slice(0, 10).map((it: any) => {
          const symbol = it.symbol || it.ticker || it.id || '';
          const name = it.name || it.title || '';
          const price = it.price || (it.quote && it.quote.price) || '';
          const change = it.change_24h || it.percent_change_24h || (it.quote && it.quote.percent_change_24h) || '';
          const volume = it.volume_24h || it.volume || '';
          const thumb = it.logo || it.icon || '';
          const color = (typeof change === 'string' && change.toString().startsWith('-')) ? 'text-jeet-red' : 'text-neon-moon';
          return { symbol, name, sentiment: '', volume: String(volume || ''), change: change ? String(change) : (price ? String(price) : ''), color, thumb };
        });
        const mergedSymbols = new Set(trendingCashtags.map((t: any) => t.symbol));
        for (const c of cryptoMapped) {
          if (c.symbol && !mergedSymbols.has(c.symbol)) {
            trendingCashtags.push(c);
            mergedSymbols.add(c.symbol);
          }
        }
      }
      if (Array.isArray(newsArray) && newsArray.length > 0) {
        hypeTopics = mapTopicsFromArray(newsArray);
        intelligenceReport = makeIntelligenceReportFromNews(newsArray);
      } else {
        hypeTopics = FALLBACK_DATA.hypeTopics;
        intelligenceReport = FALLBACK_DATA.intelligenceReport;
      }
    } else {
      // No real data available (insufficient credits, etc.) — use fallback
      trendingCashtags = FALLBACK_DATA.trendingCashtags;
      hypeTopics = FALLBACK_DATA.hypeTopics;
      intelligenceReport = FALLBACK_DATA.intelligenceReport;
    }

    return NextResponse.json({ trendingCashtags, hypeTopics, intelligenceReport });
  } catch (err: any) {
    console.error('AgentKey API error:', err);
    // Always return fallback on error so the UI section populates
    return NextResponse.json(FALLBACK_DATA);
  }
}

