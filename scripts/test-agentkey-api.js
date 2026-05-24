#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const envPath = path.join(process.cwd(), 'indexer', '.env');
    if (!fs.existsSync(envPath)) {
      console.error('indexer/.env not found');
      process.exit(2);
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const line = content.split(/\r?\n/).find((l) => l.startsWith('CHAINBASE_AGENT_KEY='));
    if (!line) {
      console.error('CHAINBASE_AGENT_KEY not found in indexer/.env');
      process.exit(2);
    }
    const key = line.split('=')[1].trim();
    const url = 'https://api.agentkey.app/v1/mcp';
    // Initialize session first
    const initPayload = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1', capabilities: { tools: { listChanged: false } }, clientInfo: { name: 'shitmarket', version: '0.0.1' } } };
    const initRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(initPayload) });
    const initJson = await initRes.json().catch(() => null);
    console.log('initialize =>', JSON.stringify(initJson, null, 2));
    const sid = initRes.headers.get('mcp-session-id');
    console.log('mcp-session-id:', sid);

    // Now call list_tools using the session id (if provided)
    const listPayload = { jsonrpc: '2.0', id: 2, method: 'list_tools', params: {} };
    const listRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${key}`, ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify(listPayload) });
    const listJson = await listRes.json().catch(() => null);
    console.log('list_tools =>', JSON.stringify(listJson, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
