"""GET /context/entries — Paginated list of context entries."""
import json
import logging
import os
import base64

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_entries_for_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    params = event.get('queryStringParameters') or {}
    project_id = params.get('project_id')
    limit = int(params.get('limit', '20'))
    cursor = params.get('cursor')

    if not project_id:
        return error('VALIDATION_ERROR', 'project_id is required')

    # Decode cursor if provided
    last_key = None
    if cursor:
        try:
            last_key = json.loads(base64.b64decode(cursor))
        except Exception:
            pass

    entries, next_key = get_entries_for_project(project_id, limit=limit, last_key=last_key)

    # Encode next cursor
    next_cursor = None
    if next_key:
        next_cursor = base64.b64encode(json.dumps(next_key).encode()).decode()

    return success({
        'entries': entries,
        'next_cursor': next_cursor,
    })
