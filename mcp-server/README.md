# 🔌 Workstream C — MCP Server

> **Owner:** TBD (suggest: Swarup)  
> **Tech:** Node.js, MCP SDK  
> **Depends on:** Backend API (WS-B)

## What This Does

Exposes Continuum's context retrieval as **MCP tools** that any compatible client can use:

| Tool | Description |
|---|---|
| `continuum_get_context` | Get full context primer for a project |
| `continuum_search` | Semantic search across captured context |
| `continuum_list_projects` | List all user projects |
| `continuum_save_page` | Manually ingest content |

## Setup

```bash
cd mcp-server
npm install
```

## Run (Mock Mode)

```bash
npm run dev
# Runs with mock data — no backend needed
```

## Run (Live)

```bash
export CONTINUUM_API_URL="https://YOUR_API.execute-api.ap-south-1.amazonaws.com/prod"
export CONTINUUM_TOKEN="your_jwt_token"
npm start
```

## Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "continuum": {
      "command": "node",
      "args": ["/absolute/path/to/Continuum/mcp-server/src/index.js"],
      "env": {
        "CONTINUUM_API_URL": "https://YOUR_API.execute-api.ap-south-1.amazonaws.com/prod",
        "CONTINUUM_TOKEN": "your_jwt_token"
      }
    }
  }
}
```

## Connect to Cursor

Add to Cursor settings → MCP:

```json
{
  "continuum": {
    "command": "node",
    "args": ["/absolute/path/to/Continuum/mcp-server/src/index.js", "--mock"]
  }
}
```
