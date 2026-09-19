# Continuum — API Contracts

> **Source of truth for all workstreams.** Build against these contracts using mocks. Do not wait for other workstreams.

## Base URL

```
Production: https://{api-id}.execute-api.{region}.amazonaws.com/prod
Local Mock: http://localhost:3001
```

## Authentication

All endpoints (except `/auth/*`) require a Cognito JWT in the `Authorization` header:

```
Authorization: Bearer <cognito_id_token>
```

The backend extracts `user_id` from the JWT claims — clients never send `user_id` in the request body.

---

## Auth Endpoints

### `POST /auth/register`

```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Swarup"
}

// Response 201
{
  "user_id": "cognito-sub-uuid",
  "email": "user@example.com",
  "token": "eyJhbGci...",
  "refresh_token": "eyJjdHki..."
}
```

### `POST /auth/login`

```json
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response 200
{
  "user_id": "cognito-sub-uuid",
  "token": "eyJhbGci...",
  "refresh_token": "eyJjdHki..."
}
```

### `POST /auth/refresh`

```json
// Request
{
  "refresh_token": "eyJjdHki..."
}

// Response 200
{
  "token": "eyJhbGci...",
  "refresh_token": "eyJjdHki..."
}
```

---

## Project Endpoints

### `POST /projects`

```json
// Request
{
  "name": "Buy Phone",
  "description": "Comparing Samsung S25 vs iPhone 16"  // optional
}

// Response 201
{
  "project_id": "proj_abc123",
  "user_id": "cognito-sub-uuid",
  "name": "Buy Phone",
  "description": "Comparing Samsung S25 vs iPhone 16",
  "status": "active",
  "created_at": "2026-09-17T22:00:00Z",
  "context_count": 0
}
```

### `GET /projects`

```json
// Response 200
{
  "projects": [
    {
      "project_id": "proj_abc123",
      "name": "Buy Phone",
      "description": "Comparing Samsung S25 vs iPhone 16",
      "status": "active",
      "created_at": "2026-09-17T22:00:00Z",
      "context_count": 5
    },
    {
      "project_id": "proj_def456",
      "name": "Debug Auth Issue",
      "status": "archived",
      "created_at": "2026-09-16T10:00:00Z",
      "context_count": 12
    }
  ]
}
```

### `PATCH /projects/{project_id}`

```json
// Request — any combination of these fields
{
  "name": "Buy Phone - Final Decision",       // optional
  "status": "archived"                          // optional: "active" | "archived"
}

// Response 200 — full updated project object
```

### `POST /projects/{project_id}/restore`

Restore an archived project back to active. Also returns saved tab URLs so the extension can reopen them.

```json
// Response 200
{
  "project_id": "proj_abc123",
  "status": "active",
  "saved_tabs": [
    "https://chatgpt.com/c/abc123",
    "https://www.gsmarena.com/samsung_galaxy_s25-review.php",
    "https://gemini.google.com/app/xyz"
  ]
}
```

### `DELETE /projects/{project_id}`

Hard-delete a project and ALL its context. **Irreversible.**

```json
// Response 204 — No content
```

---

## Ingest Endpoints

### `POST /ingest`

Send captured context to the backend for processing.

```json
// Request
{
  "project_id": "proj_abc123",
  "source_type": "llm_chat",           // "llm_chat" | "webpage"
  "source_name": "ChatGPT",            // "ChatGPT" | "Claude" | "Gemini" | domain name
  "url": "https://chatgpt.com/c/abc",
  "content": "User asked about Samsung S25 specs... AI responded with...",
  "title": "Phone comparison chat",     // optional
  "captured_at": "2026-09-17T22:05:00Z"
}

// Response 202
{
  "entry_id": "entry_xyz789",
  "status": "processing",
  "message": "Context ingested, processing in background"
}
```

**Backend processing pipeline (async via Lambda):**
1. Comprehend PII redaction → strips sensitive data
2. Bedrock Claude Haiku → generates `summary_text`
3. Bedrock Titan Embeddings → generates vector, stores in OpenSearch
4. Raw `content` → stored in S3
5. Metadata → stored in DynamoDB

### `POST /ingest/tabs`

Save current tab URLs for a project (for restore later).

```json
// Request
{
  "project_id": "proj_abc123",
  "tabs": [
    { "url": "https://chatgpt.com/c/abc123", "title": "Phone comparison" },
    { "url": "https://www.gsmarena.com/...", "title": "Samsung S25 Review" }
  ]
}

// Response 200
{
  "saved": 2
}
```

---

## Context Retrieval Endpoints

### `GET /context/primer?project_id={project_id}`

Get a short primer for auto-injection into LLM chat boxes.

```json
// Response 200
{
  "primer": "## Your Context (via Continuum)\n\n**About you:** Swarup, CS student interested in mobile tech.\n\n**Active Project:** Buy Phone\nYou're comparing the Samsung S25 Ultra vs iPhone 16 Pro. Key findings so far:\n- S25 Ultra has better zoom camera (200MP)\n- iPhone 16 Pro has better video processing\n- Budget is around ₹80,000\n\n*This context was auto-loaded by Continuum from your previous research.*",
  "project_name": "Buy Phone",
  "profile_summary": "Swarup, CS student",
  "entry_count": 5,
  "last_updated": "2026-09-17T22:30:00Z"
}
```

### `POST /context/search`

Semantic search across a project's context.

```json
// Request
{
  "project_id": "proj_abc123",
  "query": "camera comparison between Samsung and iPhone",
  "top_k": 5
}

// Response 200
{
  "results": [
    {
      "entry_id": "entry_001",
      "summary_text": "Compared camera specs: S25 Ultra 200MP main + 50MP telephoto vs iPhone 16 Pro 48MP main + 12MP telephoto...",
      "source_name": "ChatGPT",
      "source_type": "llm_chat",
      "url": "https://chatgpt.com/c/abc123",
      "relevance_score": 0.94,
      "captured_at": "2026-09-17T22:10:00Z"
    },
    {
      "entry_id": "entry_002",
      "summary_text": "GSMArena detailed camera review of Samsung Galaxy S25 Ultra...",
      "source_name": "gsmarena.com",
      "source_type": "webpage",
      "url": "https://www.gsmarena.com/...",
      "relevance_score": 0.87,
      "captured_at": "2026-09-17T22:15:00Z"
    }
  ]
}
```

### `GET /context/entries?project_id={project_id}&limit=20&cursor={cursor}`

Paginated list of context entries.

```json
// Response 200
{
  "entries": [
    {
      "entry_id": "entry_001",
      "source_type": "llm_chat",
      "source_name": "ChatGPT",
      "url": "https://chatgpt.com/c/abc123",
      "title": "Phone comparison chat",
      "summary_text": "Discussed Samsung S25 vs iPhone 16 camera specs...",
      "captured_at": "2026-09-17T22:10:00Z"
    }
  ],
  "next_cursor": "eyJlbnRyeV9pZCI6ICJlbnRyeV8wMDIifQ==",
  "total_count": 42
}
```

---

## Profile Endpoints

### `GET /profile`

```json
// Response 200
{
  "user_id": "cognito-sub-uuid",
  "facts": [
    { "key": "name", "value": "Swarup", "updated_at": "2026-09-17T22:00:00Z" },
    { "key": "profession", "value": "CS Student, 3rd year", "updated_at": "2026-09-17T22:00:00Z" },
    { "key": "interest_1", "value": "Mobile technology & smartphones", "updated_at": "2026-09-17T22:00:00Z" },
    { "key": "interest_2", "value": "Web development", "updated_at": "2026-09-17T22:00:00Z" }
  ]
}
```

### `PUT /profile`

```json
// Request — full replace of facts array
{
  "facts": [
    { "key": "name", "value": "Swarup" },
    { "key": "profession", "value": "CS Student, 3rd year" },
    { "key": "interest_1", "value": "Mobile technology" }
  ]
}

// Response 200 — updated profile object with timestamps
```

---

## Privacy Endpoints

### `GET /privacy`

```json
// Response 200
{
  "blocked_domains": [
    "web.whatsapp.com",
    "mail.google.com",
    "onlinesbi.com",
    "netbanking.hdfcbank.com"
  ],
  "blocked_keywords": ["password", "OTP", "CVV", "PIN"],
  "capture_enabled": true
}
```

### `PUT /privacy`

```json
// Request
{
  "blocked_domains": ["web.whatsapp.com", "mail.google.com", "onlinesbi.com"],
  "blocked_keywords": ["password", "OTP", "CVV"],
  "capture_enabled": true
}

// Response 200 — updated privacy rules
```

---

## Error Format (all endpoints)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "project_id is required"
  }
}
```

| HTTP Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing/invalid fields |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Accessing another user's data |
| 404 | `NOT_FOUND` | Project/entry doesn't exist |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server-side failure |

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /ingest` | 60 req/min per user |
| `POST /context/search` | 30 req/min per user |
| All others | 120 req/min per user |

---

## CORS

API Gateway is configured with:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```
