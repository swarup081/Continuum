"""POST /ingest — The main ingestion pipeline.

Pipeline:
1. Comprehend PII redaction
2. Bedrock summarization (Claude Haiku)
3. Bedrock embedding (Titan)
4. Store raw content in S3
5. Store metadata + embedding vector in DynamoDB
"""
import json
import logging
import os
import uuid
from datetime import datetime

import boto3
from decimal import Decimal

# Add shared to path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.comprehend_client import redact_pii
from shared.bedrock_client import summarize, embed

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

ENTRIES_TABLE = os.environ.get('ENTRIES_TABLE', 'ContinuumContextEntries')
RAW_BUCKET = os.environ.get('RAW_BUCKET', 'continuum-raw')


def handler(event, context):
    """Handle POST /ingest."""
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    body = parse_body(event)

    # Validate required fields
    required = ['project_id', 'source_type', 'source_name', 'url', 'content']
    missing = [f for f in required if not body.get(f)]
    if missing:
        return error('VALIDATION_ERROR', f'Missing required fields: {", ".join(missing)}')

    content = body['content']
    project_id = body['project_id']
    entry_id = f'entry_{uuid.uuid4().hex[:12]}'

    logger.info(json.dumps({
        'action': 'ingest_start',
        'entry_id': entry_id,
        'project_id': project_id,
        'source_type': body['source_type'],
        'source_name': body['source_name'],
        'content_length': len(content),
    }))

    try:
        # 1. PII Redaction (Amazon Comprehend)
        logger.info(json.dumps({'action': 'step_1_pii_redaction', 'entry_id': entry_id}))
        clean_content = redact_pii(content)

        # 2. Summarize (Amazon Bedrock — Claude Haiku)
        logger.info(json.dumps({'action': 'step_2_summarize', 'entry_id': entry_id}))
        summary_text = summarize(clean_content)

        # 3. Embed (Amazon Bedrock — Titan Embeddings)
        logger.info(json.dumps({'action': 'step_3_embed', 'entry_id': entry_id}))
        embedding = embed(summary_text)

        # 4. Store raw content in S3
        logger.info(json.dumps({'action': 'step_4_s3_store', 'entry_id': entry_id}))
        s3_key = f'{user_id}/{project_id}/{entry_id}.txt'
        s3.put_object(
            Bucket=RAW_BUCKET,
            Key=s3_key,
            Body=clean_content.encode('utf-8'),
            ContentType='text/plain',
        )

        # 5. Store metadata + embedding in DynamoDB
        logger.info(json.dumps({'action': 'step_5_dynamodb_store', 'entry_id': entry_id}))
        table = dynamodb.Table(ENTRIES_TABLE)
        entry = {
            'entry_id': entry_id,
            'project_id': project_id,
            'user_id': user_id,
            'source_type': body['source_type'],
            'source_name': body['source_name'],
            'url': body['url'],
            'title': body.get('title', ''),
            'summary_text': summary_text,
            's3_raw_ref': s3_key,
            'embedding': [Decimal(str(x)) for x in embedding],  # Titan 1024-dim vector for cosine similarity search
            'captured_at': body.get('captured_at', datetime.utcnow().isoformat()),
        }
        table.put_item(Item=entry)

        logger.info(json.dumps({
            'action': 'ingest_complete',
            'entry_id': entry_id,
            'summary_length': len(summary_text),
        }))

        return success({
            'entry_id': entry_id,
            'status': 'processed',
            'message': 'Context ingested and processed successfully',
        }, 202)

    except Exception as e:
        logger.error(json.dumps({
            'action': 'ingest_error',
            'entry_id': entry_id,
            'error': str(e),
        }))
        return error('INTERNAL_ERROR', f'Ingestion failed: {str(e)}', 500)

