# 🟡 Workstream C — MCP Server

> **Owner:** TBD
> **Tech:** TypeScript, `@modelcontextprotocol/sdk`, Node.js
> **Depends on:** `API_CONTRACTS.md` (mock until backend is live)

## What You Own

MCP (Model Context Protocol) tool server that lets MCP-capable LLM clients (Claude, ChatGPT Developer Mode, potentially Gemini) pull and push context programmatically:

1. `list_projects` — list user's projects
2. `get_active_project_summary` — get context primer for a project
3. `search_context` — semantic search across project context
4. `save_note` — save a note/decision to a project
5. OAuth authentication via Cognito

## Prerequisites

```bash
# Node.js 20+
node --version  # Should be v20+

# npm
npm --version
```

## Setup

```bash
cd mcp-server

# Install dependencies
npm install

# Run locally (for testing with Claude Desktop)
npm run dev

# Build for production
npm run build
```

## File Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   ← MCP server entry point
│   ├── tools/
│   │   ├── list-projects.ts       ← list_projects tool
│   │   ├── get-summary.ts         ← get_active_project_summary tool
│   │   ├── search-context.ts      ← search_context tool
│   │   └── save-note.ts           ← save_note tool
│   ├── resources/
│   │   ├── profile.ts             ← continuum://profile resource
│   │   └── project-summary.ts     ← continuum://project/{id}/summary
│   ├── auth/
│   │   └── cognito-oauth.ts       ← OAuth token management
│   └── api-client.ts              ← HTTP client for backend API
├── mock/
│   └── mock-responses.json        ← Hardcoded responses matching API contracts
└── README.md
```

## Detailed Task Breakdown

### Phase 1: Server Skeleton + Stubs
- [ ] Initialize project: `npm init -y`, install deps
- [ ] Create `tsconfig.json`
- [ ] Create `src/index.ts` — MCP server with all 4 tools declared (returning mock data)
- [ ] Create `mock/mock-responses.json` with responses matching `API_CONTRACTS.md`
- [ ] Test locally with Claude Desktop config

### Phase 2: Tool Implementations
- [ ] `list-projects.ts`:
  ```typescript
  // Calls GET /projects
  // Returns formatted list of projects with name, status, context count
  // LLM can use this to pick which project to query
  ```

- [ ] `get-summary.ts`:
  ```typescript
  // Calls GET /context/primer?project_id=X
  // Returns the primer text — profile + project summary
  // This is the main "here's what the user is doing" context
  ```

- [ ] `search-context.ts`:
  ```typescript
  // Calls POST /context/search
  // Input: project_id + query string
  // Returns top-k relevant context entries with summaries
  // The LLM uses this when it needs specific info from past sessions
  ```

- [ ] `save-note.ts`:
  ```typescript
  // Calls POST /ingest with source_type: "mcp_note"
  // Input: project_id + text
  // Saves a note that the LLM thinks is worth remembering
  // Example: "User decided to go with Samsung S25 Ultra, budget ₹80K"
  ```

### Phase 3: OAuth + Auth Flow
- [ ] `cognito-oauth.ts`:
  ```typescript
  // For remote MCP (Claude connects to your server):
  // 1. Implement OAuth 2.0 authorization code flow
  // 2. Redirect to Cognito hosted UI for login
  // 3. Exchange authorization code for tokens
  // 4. Attach token to all API calls
  
  // For local MCP (Claude Desktop):
  // 1. Read token from environment variable or config file
  // 2. Simpler flow — no OAuth redirect needed
  ```

### Phase 4: API Client
- [ ] `api-client.ts`:
  ```typescript
  class ContinuumAPIClient {
    private baseUrl: string;
    private token: string;
    
    async listProjects(): Promise<Project[]> { ... }
    async getPrimer(projectId: string): Promise<Primer> { ... }
    async searchContext(projectId: string, query: string, topK?: number): Promise<SearchResult[]> { ... }
    async saveNote(projectId: string, text: string): Promise<IngestResult> { ... }
    async getProfile(): Promise<Profile> { ... }
  }
  ```

### Phase 5: MCP Resources (read-only context)
- [ ] `resources/profile.ts`:
  ```typescript
  // URI: continuum://profile
  // Returns user's universal profile as a resource
  // LLMs can auto-read this on connection
  ```

- [ ] `resources/project-summary.ts`:
  ```typescript
  // URI: continuum://project/{id}/summary
  // Returns project summary as a resource
  // LLMs can auto-read this for the active project
  ```

### Phase 6: Deploy + Test with LLM Clients
- [ ] Deploy to AWS (Lambda + Function URL, or EC2 with Docker)
- [ ] Test with **Claude Desktop** (local connection):
  ```json
  // ~/.config/claude/mcp_config.json (or equivalent)
  {
    "mcpServers": {
      "continuum": {
        "command": "node",
        "args": ["/path/to/mcp-server/dist/index.js"],
        "env": {
          "CONTINUUM_API_URL": "https://YOUR_API.amazonaws.com/prod",
          "CONTINUUM_TOKEN": "your_cognito_token"
        }
      }
    }
  }
  ```
- [ ] Screenshot: Claude listing projects via `list_projects`
- [ ] Screenshot: Claude searching context via `search_context`
- [ ] (Stretch) Test with ChatGPT Developer Mode MCP

## MCP Server Entry Point (`src/index.ts`)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ContinuumAPIClient } from './api-client.js';

const server = new McpServer({
  name: 'continuum',
  version: '0.1.0',
});

const apiClient = new ContinuumAPIClient(
  process.env.CONTINUUM_API_URL || 'http://localhost:3001',
  process.env.CONTINUUM_TOKEN || ''
);

// Tool: list_projects
server.tool(
  'list_projects',
  'List all projects for the current user with their names, statuses, and context counts',
  {},
  async () => {
    const projects = await apiClient.listProjects();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(projects, null, 2)
      }]
    };
  }
);

// Tool: get_active_project_summary
server.tool(
  'get_active_project_summary',
  'Get a summary of a project including recent context, decisions, and key findings from all sources',
  { project_id: z.string().describe('The project ID to get summary for') },
  async ({ project_id }) => {
    const primer = await apiClient.getPrimer(project_id);
    return {
      content: [{
        type: 'text',
        text: primer.primer
      }]
    };
  }
);

// Tool: search_context
server.tool(
  'search_context',
  'Semantic search across all captured context in a project. Use to find specific information from past sessions.',
  {
    project_id: z.string().describe('The project ID to search in'),
    query: z.string().describe('What to search for')
  },
  async ({ project_id, query }) => {
    const results = await apiClient.searchContext(project_id, query);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
      }]
    };
  }
);

// Tool: save_note
server.tool(
  'save_note',
  'Save an important piece of information to the project context. Use when the user makes a decision or you discover something important.',
  {
    project_id: z.string().describe('The project ID to save to'),
    text: z.string().describe('The note text to save')
  },
  async ({ project_id, text }) => {
    const result = await apiClient.saveNote(project_id, text);
    return {
      content: [{
        type: 'text',
        text: `Note saved successfully (entry_id: ${result.entry_id})`
      }]
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Mock Responses

Until the backend is deployed, use hardcoded responses in your API client:

```json
{
  "list_projects": {
    "projects": [
      { "project_id": "proj_mock1", "name": "Buy Phone", "status": "active", "context_count": 5 },
      { "project_id": "proj_mock2", "name": "Debug Auth Issue", "status": "archived", "context_count": 12 }
    ]
  },
  "primer": {
    "primer": "## Your Context (via Continuum)\n\n**About you:** Mock user, CS student.\n\n**Active Project:** Buy Phone\nComparing Samsung S25 Ultra vs iPhone 16 Pro. Budget ~₹80K.",
    "project_name": "Buy Phone",
    "last_updated": "2026-09-17T22:00:00Z"
  },
  "search": {
    "results": [
      {
        "entry_id": "entry_mock1",
        "summary_text": "Compared camera specs: S25 Ultra 200MP vs iPhone 16 Pro 48MP",
        "source_name": "ChatGPT",
        "relevance_score": 0.94
      }
    ]
  }
}
```

## Integration Checklist

When the backend (WS-B) is live:
- [ ] Update `CONTINUUM_API_URL` environment variable
- [ ] Test all 4 tools with real data
- [ ] Verify OAuth flow works with Cognito tokens
- [ ] Test end-to-end: Extension captures → Backend processes → MCP serves to Claude
- [ ] Take screenshots of Claude using your tools
