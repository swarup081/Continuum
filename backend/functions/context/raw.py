"""GET /context/entries/{entry_id}/raw - Fetch full raw text from S3."""
import json
import logging
import os
import boto3

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_entry

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

    entry = get_entry(entry_id)
    if not entry:
        return error('NOT_FOUND', 'Entry not found', 404)

    if entry.get('user_id') != user_id:
        return error('FORBIDDEN', 'Access denied to this entry', 403)

    s3_key = entry.get('s3_raw_ref')
    if not s3_key:
        return error('NOT_FOUND', 'Raw content reference not found', 404)

    try:
        response = s3.get_object(Bucket=RAW_BUCKET, Key=s3_key)
        raw_content = response['Body'].read().decode('utf-8')
        return success({
            'entry_id': entry_id,
            'raw_content': raw_content
        })
    except Exception as e:
        logger.error(f"Failed to fetch from S3: {str(e)}")
        return error('INTERNAL_ERROR', 'Failed to retrieve raw content', 500)
