"""PUT /context/entries/{entry_id} - Update full raw text and summarize."""
import json
import logging
import os
import boto3

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_entry, update_entry

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = boto3.client('s3')
RAW_BUCKET = os.environ.get('RAW_BUCKET')

def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    path_params = event.get('pathParameters') or {}
    entry_id = path_params.get('entry_id')
    if not entry_id:
        return error('VALIDATION_ERROR', 'entry_id is required')

    body = {}
    try:
        body = json.loads(event.get('body', '{}'))
    except:
        pass
        
    raw_content = body.get('raw_content')
    if not raw_content:
        return error('VALIDATION_ERROR', 'raw_content is required')

    entry = get_entry(entry_id)
    if not entry:
        return error('NOT_FOUND', 'Entry not found', 404)

    if entry.get('user_id') != user_id:
        return error('FORBIDDEN', 'Access denied to this entry', 403)

    s3_key = entry.get('s3_raw_ref')
    if not s3_key:
        return error('NOT_FOUND', 'Raw content reference not found', 404)

    try:
        # Overwrite in S3
        s3.put_object(
            Bucket=RAW_BUCKET,
            Key=s3_key,
            Body=raw_content.encode('utf-8'),
            ContentType='text/plain',
        )
        
        # Simple fallback summary for hackathon
        new_summary = raw_content[:150] + ('...' if len(raw_content) > 150 else '')
        
        # Update DynamoDB
        updated_entry = update_entry(entry_id, {'summary_text': new_summary})
        
        return success({
            'entry_id': entry_id,
            'message': 'Successfully updated entry'
        })
    except Exception as e:
        logger.error(f"Failed to update entry: {str(e)}")
        return error('INTERNAL_ERROR', 'Failed to update entry', 500)
