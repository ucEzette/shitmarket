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
let sessionId: string | undefined;
let initialized = false;

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
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(initPayload),
  });
  const text = await res.text();
  // Try parse JSON first, then fall back to simple SSE parsing
  function tryParseAgentKeyText(txt: string, r: Response) {
    try {
      return JSON.parse(txt);
    } catch (e) {
      // try SSE-style parsing if content looks like event-stream
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('event-stream') || txt.includes('\ndata:')) {
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
      // last-ditch: parse any 'data: {...}' fragments in the whole body
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

  const json = tryParseAgentKeyText(text, res as Response);
  if (!json) throw new Error(`Invalid JSON from AgentKey MCP initialize: ${text}`);
  if (json.error) throw new Error(JSON.stringify(json.error));
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  initialized = true;
  return json.result;
}

async function sendRpc(apiKey: string, method: string, params: any): Promise<any> {
  if (!initialized) {
    await initializeClient(apiKey);
  }
  const id = rpcId++;
  const payload = { jsonrpc: '2.0', id, method, params };
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
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    // Try JSON parse; if fails, try SSE-style parsing similar to initializeClient
    function tryParseAgentKeyText(txt: string, r: Response) {
      try {
        return JSON.parse(txt);
      } catch (e) {
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('event-stream') || txt.includes('\ndata:')) {
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

    const json = tryParseAgentKeyText(text, res as Response);
    if (!json) throw new Error(`Invalid JSON from AgentKey MCP: ${text}`);
    if (json.error) {
      throw new Error(JSON.stringify(json.error));
    }
    return json.result;
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

export async function GET() {
  try {
    const apiKey = readKeyFromEnvOrFile();
    if (!apiKey) return NextResponse.json({ error: 'Missing CHAINBASE_AGENT_KEY' }, { status: 500 });

    // basic health check
    const listResp = await sendRpc(apiKey, 'list_tools', {});
    if (!listResp) return NextResponse.json({ error: 'AgentKey list_tools failed' }, { status: 500 });

    // Discover endpoints
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
    const twitterExec = await prepareAndExecute(twitterCandidate, 'agentkey_social', { path: 'twitter/web/fetch_trending', params: { limit: 7 } });
    const twitterArray = twitterExec ? (findFirstArray(twitterExec) || findFirstArray(twitterExec.result) || findFirstArray(twitterExec.data) || []) : [];
    const trendingCashtags = Array.isArray(twitterArray) ? mapCashtagsFromArray(twitterArray) : [];

    // Execute crypto tickers
    const cryptoExec = await prepareAndExecute(cryptoCandidate, 'agentkey_crypto', { type: 'cmc_quotes', limit: 10 });
    const cryptoArray = cryptoExec ? (findFirstArray(cryptoExec) || findFirstArray(cryptoExec.result) || findFirstArray(cryptoExec.data) || []) : [];
    const cryptoMapped = Array.isArray(cryptoArray) ? cryptoArray.slice(0, 10).map((it: any) => {
      const symbol = it.symbol || it.ticker || it.id || '';
      const name = it.name || it.title || '';
      const price = it.price || (it.quote && it.quote.price) || '';
      const change = it.change_24h || it.percent_change_24h || (it.quote && it.quote.percent_change_24h) || '';
      const volume = it.volume_24h || it.volume || '';
      const thumb = it.logo || it.icon || '';
      const color = (typeof change === 'string' && change.toString().startsWith('-')) ? 'text-jeet-red' : 'text-neon-moon';
      return { symbol, name, sentiment: '', volume: String(volume || ''), change: change ? String(change) : (price ? String(price) : ''), color, thumb };
    }) : [];

    // Execute news/search for intelligence report and hype topics
    const newsExec = await prepareAndExecute(newsCandidate, 'agentkey_search', { query: 'web3 news', type: 'news', num: 5 });
    const newsArray = newsExec ? (findFirstArray(newsExec) || findFirstArray(newsExec.result) || findFirstArray(newsExec.data) || []) : [];
    const hypeTopics = Array.isArray(newsArray) ? mapTopicsFromArray(newsArray) : [];
    const intelligenceReport = Array.isArray(newsArray) ? makeIntelligenceReportFromNews(newsArray) : '';

    // Merge crypto into trending cashtags (avoid duplicates)
    const mergedSymbols = new Set(trendingCashtags.map((t: any) => t.symbol));
    for (const c of cryptoMapped) {
      if (c.symbol && !mergedSymbols.has(c.symbol)) {
        trendingCashtags.push(c);
        mergedSymbols.add(c.symbol);
      }
    }

    return NextResponse.json({ trendingCashtags, hypeTopics, intelligenceReport });
  } catch (err: any) {
    console.error('AgentKey API error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

