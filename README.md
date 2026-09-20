# ⚡ Continuum

> **Cross-LLM, cross-site context memory** — never re-explain yourself to an AI again.

[![Team 404](https://img.shields.io/badge/Team-404-blue)]()
[![WeMakeDevs](https://img.shields.io/badge/WeMakeDevs-First%20Commit-green)]()
[![AWS Hackathon](https://img.shields.io/badge/AWS-Hackathon%202026-orange)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE.txt)

---

## 🔗 Live Deployments

- **Web Dashboard:** [http://continuum-backend-dashboardbucket-mj9fnz0vgvsv.s3-website-ap-southeast-2.amazonaws.com](http://continuum-backend-dashboardbucket-mj9fnz0vgvsv.s3-website-ap-southeast-2.amazonaws.com)
- **AWS API Gateway:** `https://7h8hmfx6mg.execute-api.ap-southeast-2.amazonaws.com/prod`

---

## The Problem

Every time you switch from ChatGPT to Claude to Gemini — or even open a new chat window — you lose all your context. You have to re-explain who you are, what project you are researching, what decisions you already made, and what code snippets you tried. Users waste countless hours constantly copy-pasting notes and re-prompting.

## The Solution

**Continuum** is a privacy-first browser extension + AWS serverless backend that quietly captures your context inside a **project** (a trip you are planning, a bug you are chasing, an architecture comparison) across every LLM and website you touch. When you open an AI chat, Continuum allows you to inject relevant context back into whichever AI you are talking to with a single click.

---

## Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │               AWS Cloud (Serverless)         │
                               │                                              │
┌──────────────────────┐       │  ┌────────────────┐    ┌──────────────────┐  │
│                      │ HTTP  │  │  API Gateway   │───▶│  AWS Lambda      │  │
│  Chrome Extension    │───────┼─▶│  (REST API)    │    │  (Python 3.11)   │  │
│  (Manifest V3)       │       │  └────────────────┘    └────────┬─────────┘  │
│  - Continuous Capture│       │                                 │            │
│  - One-Click Inject  │       │         ┌───────────────────────┼────────┐   │
└──────────────────────┘       │         ▼                       ▼        ▼   │
                               │  ┌──────────────┐      ┌─────────────┐ ┌───┐ │
                               │  │Amazon Bedrock│      │  Amazon     │ │S3 │ │
┌──────────────────────┐       │  │- Claude Haiku│      │  Comprehend │ │Raw│ │
│                      │ HTTP  │  │- Titan Embed │      │  (PII Mask) │ └───┘ │
│  React Dashboard     │───────┼──┼──────┬───────┘      └─────────────┘   │   │
│  (S3 Website Hosting)│       │         ▼                                │   │
│  - Project Management│       │  ┌──────────────┐                        │   │
│  - Semantic Search   │       │  │Amazon        │◀───────────────────────┘   │
│  - Profile & Privacy │       │  │DynamoDB      │ (Metadata & Embeddings)    │
└──────────────────────┘       │  └──────────────┘                            │
                               └──────────────────────────────────────────────┘
```

---

## Comprehensive Project Structure

```
Continuum/
├── extension/                         # Chrome Extension (Manifest V3)
│   ├── manifest.json                  # Extension permissions, host rules & scripts
│   ├── background.js                  # Service worker: message routing, tabs & state
│   ├── content-scripts/
│   │   ├── gemini.js                  # DOM observer & text capture for Gemini
│   │   ├── chatgpt.js                 # DOM observer & text capture for ChatGPT
│   │   ├── claude.js                  # DOM observer & text capture for Claude
│   │   ├── generic.js                 # Text extraction & manual save for any website
│   │   └── injector.js                # One-click context primer injector & floating chip
│   ├── popup/
│   │   ├── popup.html                 # Extension popup interface
│   │   ├── popup.css                  # Dark glassmorphic styling
│   │   └── popup.js                   # Project switcher, capture toggle & CRUD
│   ├── utils/
│   │   ├── api-client.js              # REST client for AWS API Gateway
│   │   ├── privacy-filter.js          # Local client-side PII regex sanitizer
│   │   └── storage.js                 # Chrome storage helpers
│   └── icons/                         # Extension icons (SVG / PNG)
│
├── backend/                           # AWS Serverless Backend (AWS SAM)
│   ├── template.yaml                  # CloudFormation / SAM Infrastructure as Code
│   ├── requirements.txt               # Backend Python dependencies
│   └── functions/                     # Serverless Microservices
│       ├── auth/
│       │   ├── login.py               # User authentication & token issuance
│       │   └── register.py            # User registration (Cognito / DynamoDB)
│       ├── context/
│       │   ├── entries.py             # Paginated context entries query
│       │   ├── primer.py              # Composes high-density LLM context primer
│       │   ├── raw.py                 # Retrieves full raw transcript from S3
│       │   ├── search.py              # Semantic vector search via Titan embeddings
│       │   └── update.py              # Edit/delete captured context entry
│       ├── ingest/
│       │   ├── handler.py             # Ingest pipeline (Comprehend PII + Bedrock)
│       │   └── tabs.py                # Tab session capture for projects
│       ├── privacy/
│       │   └── handler.py             # Get and update domain/keyword blocklists
│       ├── profile/
│       │   └── handler.py             # Get and update persistent user profile facts
│       ├── projects/
│       │   ├── create.py              # Create new research project
│       │   ├── delete.py              # Delete project & cascade delete entries
│       │   ├── list.py                # List projects enriched with entry counts
│       │   ├── restore.py             # Restore archived project and reopen tabs
│       │   └── update.py              # Rename or change project status
│       └── shared/
│           ├── bedrock_client.py      # Claude Haiku summarization & Titan embedding
│           ├── comprehend_client.py   # Amazon Comprehend PII redaction wrapper
│           ├── db.py                  # DynamoDB table helper operations
│           └── response.py            # Standardized JSON response & JWT utilities
│
├── dashboard/                         # Web Dashboard (React 19 + Vite)
│   ├── index.html                     # HTML root
│   ├── vite.config.js                 # Vite build configuration
│   ├── package.json                   # React, Vite, React Router, Lucide icons
│   ├── public/                        # Static assets (favicons, SVG icons)
│   └── src/
│       ├── main.jsx                   # React entrypoint
│       ├── App.jsx                    # Routing & global toast provider
│       ├── App.css                    # Unified modern glassmorphism design system
│       ├── index.css                  # Base styles & typography
│       ├── components/
│       │   ├── ContextEntry.jsx       # Individual memory card component
│       │   ├── EntryEditorModal.jsx   # Modal for editing summary & source tags
│       │   ├── Navbar.jsx             # Top navigation bar & user status
│       │   ├── ProjectCard.jsx        # Project grid card with status badges
│       │   ├── ProtectedRoute.jsx     # Auth guard route wrapper
│       │   ├── Sidebar.jsx            # Quick navigation sidebar
│       │   └── Toast.jsx              # Toast notification container
│       ├── pages/
│       │   ├── Login.jsx              # User login page
│       │   ├── Register.jsx           # User registration page
│       │   ├── Projects.jsx           # Project dashboard & creation
│       │   ├── ProjectDetail.jsx      # Project context viewer & semantic search
│       │   ├── Profile.jsx            # Universal Profile facts editor
│       │   └── Privacy.jsx            # Domain & keyword privacy settings
│       └── services/
│           ├── api.js                 # Dashboard REST API client
│           └── auth.js                # Token management & session check
│
├── API_CONTRACTS.md                   # Full REST API specification
├── AI_TOOLS_USED.md                   # Hackathon AI tools usage disclosure
├── LICENSE.txt                        # MIT License
└── README.md                          # Project documentation
```

---

## Installation & Setup Guide

### 1. Dashboard & Account Setup
1. Visit the hosted web dashboard: [Live Continuum Dashboard](http://continuum-backend-dashboardbucket-mj9fnz0vgvsv.s3-website-ap-southeast-2.amazonaws.com).
2. Click **Sign Up** to create your account.
3. Once logged in, go to **Universal Profile** to add persistent facts about yourself (e.g., *"Senior Backend Engineer"*, *"Prefers TypeScript"*).
4. Configure any sensitive keywords or domains under **Privacy Settings**.
5. Create an active project (e.g., *"Japan Trip 2026"* or *"Distributed Cache Design"*).

### 2. Chrome Extension Installation
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top right).
3. Click **Load unpacked** (top left).
4. Select the `extension/` folder from your local clone of this repository.
5. Pin **Continuum** to your Chrome toolbar.

### 3. Everyday Usage Flow
1. Click the Continuum icon in your toolbar, log in with your credentials, and select your active project.
2. Toggle **Capture** to ON (green indicator).
3. Open ChatGPT, Gemini, Claude, or any documentation website. As you research and ask questions, Continuum automatically sanitizes PII and saves concise summaries in the background.
4. When you switch to another AI model or start a new chat, click the floating **"✦ Inject Context"** button directly above the chat box to instantly load your project history into the prompt!

---

## AWS Services Used

- **Amazon Bedrock:**
  - **Claude 3 Haiku** (`anthropic.claude-3-haiku-20240307-v1:0`) — Condenses multi-turn conversations into dense, factual context summaries.
  - **Titan Text Embeddings** (`amazon.titan-embed-text-v1`) — Generates 1024-dimensional semantic vectors for cosine similarity search.
- **Amazon Comprehend:** Automatic detection and masking of personally identifiable information (PII).
- **AWS Lambda:** Serverless Python microservices handling all REST API endpoints.
- **Amazon API Gateway:** Scalable REST API routes with CORS configuration and authorization.
- **Amazon DynamoDB:** NoSQL database with GSIs storing projects, context summaries, and embedding vectors.
- **Amazon S3:** Raw conversation transcript archive (`continuum-raw`) and static website hosting for the React dashboard.
- **Amazon Cognito:** User authentication and JWT verification.
- **AWS SAM & CloudFormation:** Declarative Infrastructure-as-Code pipeline.

---

## Team

**Team 404** — WeMakeDevs "First Commit" (Bharat Builds Tour) × AWS Hackathon 2026

## License

This project is licensed under the MIT License — see the [LICENSE.txt](./LICENSE.txt) file for details.