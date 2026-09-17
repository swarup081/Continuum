/**
 * Continuum MCP Server
 *
 * Exposes project context as MCP tools for LLM clients (Claude, ChatGPT, Gemini).
 * Tools:
 *   - list_projects: List all user projects
 *   - get_active_project_summary: Get context primer for a project
 *   - search_context: Semantic search across project context
 *   - save_note: Save an important note to a project
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ─── Configuration ──────────────────────────────────────────────────

const API_BASE = process.env.CONTINUUM_API_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.CONTINUUM_TOKEN || '';
const USE_MOCK = process.env.CONTINUUM_USE_MOCK === 'true' || !AUTH_TOKEN;

// ─── API Client ─────────────────────────────────────────────────────

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  if (USE_MOCK) {
    return getMockResponse(path, body);
  }

  const url = `${API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

// ─── Mock Responses ─────────────────────────────────────────────────

function getMockResponse(path: string, body?: unknown): unknown {
  if (path === '/projects') {
    return {
      projects: [
        { project_id: 'proj_mock1', name: 'Buy Phone', status: 'active', context_count: 5, created_at: '2026-09-17T22:00:00Z' },
        { project_id: 'proj_mock2', name: 'Research Paper', status: 'active', context_count: 8, created_at: '2026-09-17T20:00:00Z' },
        { project_id: 'proj_mock3', name: 'Debug Auth Bug', status: 'archived', context_count: 3, created_at: '2026-09-16T10:00:00Z' },
      ],
    };
  }

  if (path.startsWith('/context/primer')) {
    return {
      primer: `## Your Context (via Continuum)\n\n**About you:** Mock user, CS student interested in mobile tech.\n\n**Active Project:** Buy Phone\nComparing Samsung S25 Ultra vs iPhone 16 Pro. Budget around ₹80,000.\n\n**Recent context:**\n- [ChatGPT] Discussed camera specs — S25 Ultra 200MP vs iPhone 16 Pro 48MP\n- [gsmarena.com] Samsung Galaxy S25 Ultra full review — excellent zoom, good battery\n- [ChatGPT] Price comparison — S25 Ultra ₹79,999 vs iPhone 16 Pro ₹89,999\n\n*This context was auto-loaded by Continuum.*`,
      project_name: 'Buy Phone',
      last_updated: '2026-09-17T22:30:00Z',
    };
  }

  if (path === '/context/search') {
    return {
      results: [
        {
          entry_id: 'entry_mock1',
          summary_text: 'Compared camera specs: S25 Ultra 200MP main sensor with 50MP 5x telephoto vs iPhone 16 Pro 48MP main with 12MP 5x telephoto. S25 Ultra wins on zoom.',
          source_name: 'ChatGPT',
          source_type: 'llm_chat',
          url: 'https://chatgpt.com/c/mock123',
          relevance_score: 0.94,
          captured_at: '2026-09-17T22:10:00Z',
        },
        {
          entry_id: 'entry_mock2',
          summary_text: 'GSMArena detailed review of Samsung Galaxy S25 Ultra camera system. 200MP sensor delivers exceptional detail in good light.',
          source_name: 'gsmarena.com',
          source_type: 'webpage',
          url: 'https://www.gsmarena.com/samsung_galaxy_s25_ultra-review.php',
          relevance_score: 0.87,
          captured_at: '2026-09-17T22:15:00Z',
        },
      ],
    };
  }

  if (path === '/ingest') {
    return { entry_id: 'entry_mock_' + Date.now(), status: 'processed' };
  }

  return {};
}

// ─── MCP Server Setup ───────────────────────────────────────────────

const server = new McpServer({
  name: 'continuum',
  version: '0.1.0',
});

// Tool: list_projects
server.tool(
  'list_projects',
  'List all Continuum projects for the current user. Shows project names, statuses (active/archived), and how many context items each has.',
  {},
  async () => {
    const data = await apiCall('GET', '/projects') as { projects: unknown[] };
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data.projects, null, 2),
      }],
    };
  }
);

// Tool: get_active_project_summary
server.tool(
  'get_active_project_summary',
  'Get a comprehensive summary of a Continuum project, including the user profile, project description, and recent context from LLM chats and webpages. Use this at the start of a conversation to understand what the user has been working on.',
  {
    project_id: z.string().describe('The project ID to get the summary for. Use list_projects first to find available project IDs.'),
  },
  async ({ project_id }) => {
    const data = await apiCall('GET', `/context/primer?project_id=${project_id}`) as { primer: string };
    return {
      content: [{
        type: 'text' as const,
        text: data.primer,
      }],
    };
  }
);

// Tool: search_context
server.tool(
  'search_context',
  'Search across all captured context in a Continuum project using semantic search. Use this to find specific information the user has encountered in previous LLM chats or webpages. Returns the most relevant context entries with summaries and source links.',
  {
    project_id: z.string().describe('The project ID to search in'),
    query: z.string().describe('Natural language search query — what information are you looking for?'),
  },
  async ({ project_id, query }) => {
    const data = await apiCall('POST', '/context/search', { project_id, query, top_k: 5 }) as { results: unknown[] };
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(data.results, null, 2),
      }],
    };
  }
);

// Tool: save_note
server.tool(
  'save_note',
  'Save an important piece of information, decision, or conclusion to the project context in Continuum. Use this when the user makes a decision, reaches a conclusion, or when you discover something important that should be remembered across sessions.',
  {
    project_id: z.string().describe('The project ID to save the note to'),
    text: z.string().describe('The note text to save. Be specific and include key details.'),
  },
  async ({ project_id, text }) => {
    const data = await apiCall('POST', '/ingest', {
      project_id,
      source_type: 'mcp_note',
      source_name: 'MCP (AI Assistant)',
      url: '',
      content: text,
      captured_at: new Date().toISOString(),
    }) as { entry_id: string };

    return {
      content: [{
        type: 'text' as const,
        text: `✅ Note saved to project (entry: ${data.entry_id}). This will be available in future sessions.`,
      }],
    };
  }
);

// ─── Start Server ───────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Continuum MCP server started');
}

main().catch(console.error);
