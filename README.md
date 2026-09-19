# 🔄 Continuum

> **Cross-LLM, cross-site context memory** — never re-explain yourself to an AI again.

[![Team 404](https://img.shields.io/badge/Team-404-blue)]()
[![WeMakeDevs](https://img.shields.io/badge/WeMakeDevs-First%20Commit-green)]()
[![AWS Hackathon](https://img.shields.io/badge/AWS-Hackathon%202026-orange)]()

## The Problem

Every time you switch from ChatGPT to Claude to Gemini — or even just open a new tab — you lose your context. You re-explain who you are, what you're researching, what you already tried. You copy-paste the same links over and over.

## The Solution

**Continuum** is a browser extension + AWS backend that quietly remembers what you're doing inside a **project** — a phone you're comparing, a research paper you're reading, a bug you're chasing — across every LLM and every website you touch, and hands that context back to whichever AI you're talking to right now, **automatically**.

## Architecture

```
Browser Extension ──→ AWS Backend (API Gateway + Lambda)
(capture context)      ├── Bedrock (summarize + embed)
                       ├── Comprehend (PII redaction)
                       ├── DynamoDB (structured data)
                       ├── OpenSearch Serverless (vector search)
                       ├── S3 (raw blobs)
                       └── Cognito (auth)
                              ↑
Web Dashboard ─────────────────┘ (project mgmt, profile, privacy)
```

## Project Structure

```
continuum/
├── extension/       → Chrome Extension (Manifest V3)
├── backend/         → AWS Serverless Backend (SAM)
├── dashboard/       → React Web Dashboard (Vite)
├── API_CONTRACTS.md → Shared API contracts (source of truth)
└── AI_TOOLS_USED.md → AI tools usage log (hackathon requirement)
```


## Installation & Usage Guide

### 1. Dashboard & Account Setup
1. Visit the hosted web dashboard (e.g., your deployed AWS S3 bucket URL or Amplify URL).
2. Click **Sign Up** to create an account (managed via AWS Cognito).
3. Once logged in, go to your **Settings** to add user facts (e.g., "I code in Python") and privacy rules (e.g., blocking sensitive keywords).
4. Create a **New Project** (e.g., "Hackathon Ideas").

### 2. Extension Installation
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Turn on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left corner.
4. Select the `extension/` folder from this repository.
5. Pin the Continuum extension to your toolbar.

### 3. Usage
1. Click the Continuum extension icon in your browser toolbar.
2. It will automatically detect your logged-in session from the dashboard.
3. Select your active project (e.g., "Hackathon Ideas") from the dropdown.
4. Ensure the **Capture Context** toggle is turned on.
5. Go to ChatGPT, Claude, or Gemini and chat naturally. The extension will auto-capture, summarize, and securely store the context.
6. When you open a *new* chat window in the future, the extension will instantly inject your active project's primer and context history directly into the text box!

## Workstream Setup

Each workstream has its own README with detailed setup instructions:

| Workstream | README | Owner |
|---|---|---|
| 🔵 Browser Extension | [extension/README.md](./extension/README.md) | TBD |
| 🟢 AWS Backend | [backend/README.md](./backend/README.md) | TBD |
| 🔴 Dashboard | [dashboard/README.md](./dashboard/README.md) | TBD |

## Quick Start

```bash
# Clone
git clone https://github.com/swarup081/Continuum.git
cd Continuum

# Each person works in their own directory — see individual READMEs
```

## AWS Services Used

- **Amazon Bedrock** — Claude Haiku for summarization, Titan for embeddings
- **Amazon Comprehend** — PII detection and redaction
- **Amazon DynamoDB** — Projects, context entries, user profiles, privacy rules
- **Amazon OpenSearch Serverless** — Vector search for semantic retrieval
- **Amazon S3** — Raw context blob storage
- **AWS Lambda** — All business logic (serverless)
- **Amazon API Gateway** — REST API endpoints
- **Amazon Cognito** — User authentication (dashboard)
- **Amazon CloudWatch** — Monitoring and logging

## Team

**Team 404** — WeMakeDevs "First Commit" (Bharat Builds Tour) · AWS Hackathon, Sept 2026

## License

MIT
