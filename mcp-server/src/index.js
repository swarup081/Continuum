#!/usr/bin/env node
/**
 * Continuum MCP Server
 *
 * Exposes 4 tools to any MCP-compatible client (Claude Desktop, Cursor, etc.):
 *   1. continuum_get_context  — Get context primer for the active project
 *   2. continuum_search       — Semantic search across project context
 *   3. continuum_list_projects — List all user projects
 *   4. continuum_save_page     — Manually ingest a webpage's content
 *
 * Run with --mock for local development without a deployed backend.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Config ─────────────────────────────────────────────────────────
const USE_MOCK = process.argv.includes('--mock');
const API_BASE = process.env.CONTINUUM_API_URL || 'https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod';
const AUTH_TOKEN = process.env.CONTINUUM_TOKEN || '';

// ─── API helper ─────────────────────────────────────────────────────
async function apiRequest(method, path, body = null) {
  if (USE_MOCK) return mockResponse(method, path, body);

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Mock responses ─────────────────────────────────────────────────
function mockResponse(method, path, body) {
  if (path.startsWith('/context/primer')) {
    return {
      primer: [
        '## Your Context (via Continuum)\n',
        '**About you:** Swarup, CS Student, 3rd Year\n',
        '**Active Project:** Buy Phone',
        'Comparing Samsung S25 vs iPhone 16\n',
        '**Recent context:**',
        '- [ChatGPT] Compared Samsung S25 Ultra 200MP camera vs iPhone 16 Pro 48MP. S25 wins on hardware, iPhone on processing.',
        '- [gsmarena.com] Samsung S25 Ultra review: 6.9" AMOLED, Snapdragon 8 Elite, excellent battery.',
        '- [Gemini] India prices: S25 Ultra ₹1,29,999, iPhone 16 Pro ₹1,34,900.',
        '- [amazon.in] S25 Ultra ₹1,24,999 with HDFC ₹5,000 off.',
        '- [Claude] iPhone for long-term support, Samsung for camera versatility.',
      ].join('\n'),
      project_name: 'Buy Phone',
      entry_count: 5,
    };
  }

  if (path === '/context/search') {
    const query = (body?.query || '').toLowerCase();
    const allResults = [
      { entry_id: 'e1', source_name: 'ChatGPT', summary_text: 'Compared Samsung S25 Ultra 200MP camera with 5x optical zoom vs iPhone 16 Pro 48MP. S25 wins on hardware specs, iPhone on computational photography.', relevance_score: 0.94 },
      { entry_id: 'e2', source_name: 'gsmarena.com', summary_text: 'Samsung S25 Ultra full review: 6.9" Dynamic AMOLED, Snapdragon 8 Elite, 5000mAh. Camera praised for zoom, battery rated excellent.', relevance_score: 0.88 },
      { entry_id: 'e3', source_name: 'Gemini', summary_text: 'India prices: Samsung S25 Ultra 256GB ₹1,29,999, iPhone 16 Pro 256GB ₹1,34,900. Flipkart exchange offers available.', relevance_score: 0.82 },
    ];
    return { results: allResults };
  }

  if (path === '/projects' && method === 'GET') {
    return {
      projects: [
        { project_id: 'proj_1', name: 'Buy Phone', status: 'active', context_count: 8 },
        { project_id: 'proj_2', name: 'Research Paper — ML Transformers', status: 'active', context_count: 15 },
        { project_id: 'proj_3', name: 'Debug Auth Middleware', status: 'active', context_count: 6 },
      ],
    };
  }

  if (path === '/ingest' && method === 'POST') {
    return { entry_id: 'entry_mock_' + Date.now(), status: 'processed' };
  }

  return {};
}

// ─── Tool definitions ───────────────────────────────────────────────
const TOOLS = [
  {
    name: 'continuum_get_context',
    description: 'Get the full context primer for the active Continuum project. Returns a formatted summary of recent context entries (from ChatGPT, Gemini, Claude, webpages) and the user\'s profile. Use this at the start of a conversation to understand what the user has been researching.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get context for (e.g., "proj_1")',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'continuum_search',
    description: 'Semantically search across all captured context entries in a Continuum project. Uses Bedrock Titan embeddings + cosine similarity. Returns the most relevant entries with source, summary, and relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to search within',
        },
        query: {
          type: 'string',
          description: 'The search query (natural language)',
        },
        top_k: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
      },
      required: ['project_id', 'query'],
    },
  },
  {
    name: 'continuum_list_projects',
    description: 'List all Continuum projects for the authenticated user. Returns project name, status (active/archived), and context entry count.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'continuum_save_page',
    description: 'Manually ingest content into a Continuum project. Use this to save webpage content, notes, or any text as a context entry. The backend will summarize it with Bedrock and store an embedding for semantic search.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to save content to',
        },
        content: {
          type: 'string',
          description: 'The text content to ingest',
        },
        url: {
          type: 'string',
          description: 'Source URL (optional)',
        },
        title: {
          type: 'string',
          description: 'Title of the content (optional)',
        },
      },
      required: ['project_id', 'content'],
    },
  },
];

// ─── Tool handlers ──────────────────────────────────────────────────
async function handleToolCall(name, args) {
  switch (name) {
    case 'continuum_get_context': {
      const data = await apiRequest('GET', `/context/primer?project_id=${args.project_id}`);
      return {
        content: [{
          type: 'text',
          text: data.primer || 'No context available for this project.',
        }],
      };
    }

    case 'continuum_search': {
      const data = await apiRequest('POST', '/context/search', {
        project_id: args.project_id,
        query: args.query,
        top_k: args.top_k || 5,
      });

      if (!data.results || data.results.length === 0) {
        return { content: [{ type: 'text', text: 'No relevant context found.' }] };
      }

      const formatted = data.results.map((r, i) =>
        `${i + 1}. **[${r.source_name}]** (${(r.relevance_score * 100).toFixed(0)}% match)\n   ${r.summary_text}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `## Search Results for "${args.query}"\n\n${formatted}`,
        }],
      };
    }

    case 'continuum_list_projects': {
      const data = await apiRequest('GET', '/projects');
      const projects = data.projects || [];

      if (projects.length === 0) {
        return { content: [{ type: 'text', text: 'No projects found.' }] };
      }

      const list = projects.map(p =>
        `- **${p.name}** (${p.status}) — ${p.context_count || 0} entries [ID: ${p.project_id}]`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `## Your Continuum Projects\n\n${list}`,
        }],
      };
    }

    case 'continuum_save_page': {
      const data = await apiRequest('POST', '/ingest', {
        project_id: args.project_id,
        source_type: 'webpage',
        source_name: args.url ? new URL(args.url).hostname : 'manual',
        url: args.url || '',
        title: args.title || '',
        content: args.content,
      });

      return {
        content: [{
          type: 'text',
          text: `✅ Content saved to project. Entry ID: ${data.entry_id}`,
        }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Server setup ───────────────────────────────────────────────────
const server = new Server(
  { name: 'continuum-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args || {});
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─── Start ──────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

if (USE_MOCK) {
  console.error('[Continuum MCP] Running in mock mode');
} else {
  console.error(`[Continuum MCP] Connected to ${API_BASE}`);
}
