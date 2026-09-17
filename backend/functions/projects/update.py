"""PATCH /projects/{project_id} — Update project (rename, archive)."""
import json
import logging
import os
from datetime import datetime

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.db import get_project, update_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    project_id = event['pathParameters']['project_id']
    body = parse_body(event)

    # Verify ownership
    project = get_project(project_id)
    if not project:
        return error('NOT_FOUND', 'Project not found', 404)
    if project['user_id'] != user_id:
        return error('FORBIDDEN', 'Not your project', 403)

    # Build updates
    updates = {}
    if 'name' in body:
        updates['name'] = body['name'].strip()
    if 'status' in body:
        updates['status'] = body['status']
        if body['status'] == 'archived':
            updates['closed_at'] = datetime.utcnow().isoformat()

    if not updates:
        return error('VALIDATION_ERROR', 'No updates provided')

    updated = update_project(project_id, updates)
    return success(updated)
