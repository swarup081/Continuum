# 🟢 Workstream B — AWS Backend

> **Owner:** TBD
> **Tech:** Python 3.12, AWS SAM, boto3, Lambda, DynamoDB, Bedrock, Comprehend, OpenSearch Serverless, S3, Cognito, API Gateway
> **You ARE the contract** — other workstreams build against your API.

## What You Own

The entire serverless backend — this is the **AWS depth showcase** for the hackathon:
1. Cognito User Pool for authentication
2. API Gateway REST API with all endpoints
3. Lambda functions for all business logic
4. DynamoDB tables (Projects, Context Entries, Users)
5. Bedrock integration (Claude Haiku for summarization, Titan for embeddings)
6. Comprehend for PII redaction
7. OpenSearch Serverless for vector search
8. S3 for raw content storage
9. CloudWatch dashboards (for demo video)

## Prerequisites

```bash
# Install AWS SAM CLI
brew install aws-sam-cli   # macOS
# or: pip install aws-sam-cli

# Install Python 3.12
brew install python@3.12

# Configure AWS credentials
aws configure
# Region: ap-south-1 (or your preferred region)

# Verify Bedrock model access
# Go to AWS Console → Bedrock → Model access → Enable:
#   - Anthropic Claude 3 Haiku
#   - Amazon Titan Embeddings V2
```

## Setup & Deploy

```bash
cd backend

# Create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Build and deploy
sam build
sam deploy --guided   # First time — saves config to samconfig.toml
sam deploy            # Subsequent deploys

# Get your API URL
aws cloudformation describe-stacks --stack-name continuum-backend \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text
```

## File Structure

```
backend/
├── template.yaml                  ← SAM template (ALL AWS resources)
├── samconfig.toml                 ← SAM deploy config (auto-generated)
├── requirements.txt
├── functions/
│   ├── auth/
│   │   ├── register.py            ← POST /auth/register
│   │   └── login.py               ← POST /auth/login + POST /auth/refresh
│   ├── projects/
│   │   ├── create.py              ← POST /projects
│   │   ├── list.py                ← GET /projects
│   │   ├── update.py              ← PATCH /projects/{id}
│   │   ├── restore.py             ← POST /projects/{id}/restore
│   │   └── delete.py              ← DELETE /projects/{id}
│   ├── ingest/
│   │   ├── handler.py             ← POST /ingest (the big pipeline)
│   │   └── tabs.py                ← POST /ingest/tabs
│   ├── context/
│   │   ├── primer.py              ← GET /context/primer
│   │   ├── search.py              ← POST /context/search
│   │   └── entries.py             ← GET /context/entries
│   ├── profile/
│   │   └── handler.py             ← GET/PUT /profile
│   ├── privacy/
│   │   └── handler.py             ← GET/PUT /privacy
│   └── shared/
│       ├── __init__.py
│       ├── db.py                  ← DynamoDB helpers
│       ├── bedrock_client.py      ← Summarize + embed via Bedrock
│       ├── comprehend_client.py   ← PII detection + redaction
│       ├── opensearch_client.py   ← Vector search operations
│       ├── response.py            ← Standard API response helpers
│       └── auth.py                ← JWT verification helper
├── tests/
│   ├── test_ingest.py
│   └── test_search.py
└── events/                        ← Test events for sam local invoke
    ├── ingest_event.json
    └── search_event.json
```

## Detailed Task Breakdown

### Phase 1: Infrastructure + Auth
- [ ] Write `template.yaml` with ALL resources (see skeleton below)
- [ ] Deploy base stack: Cognito + DynamoDB tables + S3 + API Gateway
- [ ] Implement `auth/register.py`:
  ```python
  # Use boto3 cognito-idp client
  # 1. cognito.sign_up(ClientId, Username=email, Password, UserAttributes=[{Name:'name', Value:name}])
  # 2. cognito.admin_confirm_sign_up(UserPoolId, Username=email)  # auto-confirm for hackathon
  # 3. cognito.initiate_auth(AuthFlow='USER_PASSWORD_AUTH', AuthParameters={USERNAME, PASSWORD})
  # 4. Return tokens
  ```
- [ ] Implement `auth/login.py`:
  ```python
  # cognito.initiate_auth(AuthFlow='USER_PASSWORD_AUTH', ...)
  # Return IdToken, RefreshToken
  ```
- [ ] Implement `shared/response.py`:
  ```python
  def success(body, status=200):
      return {'statusCode': status, 'headers': cors_headers, 'body': json.dumps(body)}
  
  def error(code, message, status=400):
      return {'statusCode': status, 'headers': cors_headers, 'body': json.dumps({'error': {'code': code, 'message': message}})}
  ```
- [ ] Implement `shared/auth.py` — extract user_id from JWT in API Gateway context
- [ ] Deploy and test: register → login → get token → hit protected endpoint

### Phase 2: Projects CRUD
- [ ] Implement `projects/create.py`:
  ```python
  # 1. Generate project_id (uuid4)
  # 2. Put item in ContinuumProjects table
  # 3. Return project object
  ```
- [ ] Implement `projects/list.py`:
  ```python
  # 1. Query UserProjectsIndex GSI with user_id from JWT
  # 2. For each project, get context_count from ProjectEntriesIndex
  # 3. Return sorted list (active first, then by created_at desc)
  ```
- [ ] Implement `projects/update.py` (rename, archive)
- [ ] Implement `projects/restore.py` (set status back to active, return saved tabs)
- [ ] Implement `projects/delete.py` (hard delete — delete all entries, S3 objects, OpenSearch vectors)

### Phase 3: The Ingest Pipeline (⭐ Most important)
- [ ] Implement `shared/comprehend_client.py`:
  ```python
  def redact_pii(text):
      comprehend = boto3.client('comprehend')
      response = comprehend.detect_pii_entities(Text=text[:5000], LanguageCode='en')
      # Sort entities by offset (reverse) and replace each with [PII_TYPE_REDACTED]
      for entity in sorted(response['Entities'], key=lambda e: e['BeginOffset'], reverse=True):
          text = text[:entity['BeginOffset']] + f'[{entity["Type"]}_REDACTED]' + text[entity['EndOffset']:]
      return text
  ```
- [ ] Implement `shared/bedrock_client.py`:
  ```python
  def summarize(text):
      bedrock = boto3.client('bedrock-runtime')
      response = bedrock.invoke_model(
          modelId='anthropic.claude-3-haiku-20240307-v1:0',
          body=json.dumps({
              'anthropic_version': 'bedrock-2023-05-31',
              'max_tokens': 300,
              'messages': [{
                  'role': 'user',
                  'content': f'Summarize this captured context in 2-3 sentences. Focus on key facts, decisions, and findings:\n\n{text}'
              }]
          })
      )
      return json.loads(response['body'].read())['content'][0]['text']
  
  def embed(text):
      bedrock = boto3.client('bedrock-runtime')
      response = bedrock.invoke_model(
          modelId='amazon.titan-embed-text-v2:0',
          body=json.dumps({'inputText': text[:8000]})
      )
      return json.loads(response['body'].read())['embedding']  # 1024-dim vector
  ```
- [ ] Implement `shared/opensearch_client.py`:
  ```python
  # Use opensearch-py with AWS4Auth (SigV4 signing)
  # Index name: 'continuum-vectors'
  # Document: { entry_id, project_id, user_id, embedding: [...], summary_text, source_name, captured_at }
  # Search: k-NN query with cosine similarity
  ```
- [ ] Implement `ingest/handler.py` — the full pipeline:
  ```python
  def handler(event, context):
      body = json.loads(event['body'])
      user_id = get_user_id(event)
      
      # 1. PII redaction (Comprehend)
      clean_content = redact_pii(body['content'])
      
      # 2. Summarize (Bedrock Claude Haiku)
      summary = summarize(clean_content)
      
      # 3. Embed (Bedrock Titan)
      embedding = embed(summary)
      
      # 4. Store raw in S3
      s3_key = f"{user_id}/{body['project_id']}/{entry_id}.txt"
      s3.put_object(Bucket=BUCKET, Key=s3_key, Body=clean_content)
      
      # 5. Store vector in OpenSearch
      index_vector(entry_id, body['project_id'], user_id, embedding, summary)
      
      # 6. Store metadata in DynamoDB
      table.put_item(Item={
          'entry_id': entry_id,
          'project_id': body['project_id'],
          'user_id': user_id,
          'source_type': body['source_type'],
          'source_name': body['source_name'],
          'url': body['url'],
          'summary_text': summary,
          's3_raw_ref': s3_key,
          'embedding_id': entry_id,
          'captured_at': body['captured_at']
      })
      
      return success({'entry_id': entry_id, 'status': 'processed'}, 202)
  ```

### Phase 4: Context Retrieval
- [ ] Implement `context/primer.py`:
  ```python
  def handler(event, context):
      project_id = event['queryStringParameters']['project_id']
      user_id = get_user_id(event)
      
      # 1. Get project details
      project = get_project(project_id)
      
      # 2. Get latest 5 entry summaries
      entries = get_recent_entries(project_id, limit=5)
      
      # 3. Get user profile
      profile = get_profile(user_id)
      
      # 4. Compose primer
      primer = compose_primer(profile, project, entries)
      
      return success({'primer': primer, 'project_name': project['name'], ...})
  ```
- [ ] Implement `context/search.py`:
  ```python
  def handler(event, context):
      body = json.loads(event['body'])
      
      # 1. Embed the query
      query_vector = embed(body['query'])
      
      # 2. k-NN search in OpenSearch (filter by project_id)
      results = vector_search(query_vector, body['project_id'], top_k=body.get('top_k', 5))
      
      # 3. Enrich with DynamoDB metadata
      enriched = enrich_results(results)
      
      return success({'results': enriched})
  ```
- [ ] Implement `context/entries.py` — paginated list from DynamoDB

### Phase 5: Profile + Privacy
- [ ] Implement `profile/handler.py` — GET/PUT on ContinuumUsers table
- [ ] Implement `privacy/handler.py` — GET/PUT on ContinuumUsers table (same table, privacy fields)

### Phase 6: CloudWatch + Demo Prep
- [ ] Add structured logging to ALL Lambdas:
  ```python
  import logging
  logger = logging.getLogger()
  logger.setLevel(logging.INFO)
  
  logger.info(json.dumps({
      'action': 'bedrock_invoke',
      'model': 'claude-3-haiku',
      'input_length': len(text),
      'summary_length': len(summary)
  }))
  ```
- [ ] Create CloudWatch dashboard with:
  - Lambda invocation count
  - Bedrock invocation latency
  - DynamoDB read/write capacity
  - API Gateway 4xx/5xx errors
- [ ] Screen-record CloudWatch showing Bedrock invocations during a live capture

## SAM Template Key Resources

Your `template.yaml` needs these resources (see the scaffolded file for the full version):

1. **Cognito**: UserPool + UserPoolClient
2. **DynamoDB**: 3 tables (Projects, ContextEntries, Users) with GSIs
3. **S3**: Raw content bucket
4. **OpenSearch Serverless**: Collection (vector search type) + access/encryption/network policies
5. **API Gateway**: REST API with Cognito authorizer
6. **Lambda Functions**: One per endpoint (or grouped by resource)
7. **IAM Roles**: Lambda execution role with permissions for all services

## Important AWS Notes

- **Bedrock model access**: Must be manually enabled in the AWS Console → Bedrock → Model access before your Lambda can call it
- **OpenSearch Serverless**: Takes 5-10 minutes to create. Do this early.
- **Comprehend**: `detect_pii_entities` has a 5000 character limit per call — chunk longer texts
- **Lambda cold starts**: First invocation after deploy takes 3-5s. Use provisioned concurrency if demo needs to be snappy (stretch goal)
- **CORS**: Must be configured on API Gateway AND in Lambda response headers

## Testing Locally

```bash
# Start local API
sam local start-api

# Test ingest
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","source_type":"webpage","source_name":"test.com","url":"https://test.com","content":"Test content","captured_at":"2026-09-17T22:00:00Z"}'

# Invoke a single function
sam local invoke IngestFunction -e events/ingest_event.json
```

## Integration Checklist

Once deployed, share with the team:
- [ ] API Gateway URL (base URL for all endpoints)
- [ ] Cognito User Pool ID
- [ ] Cognito App Client ID
- [ ] Region
