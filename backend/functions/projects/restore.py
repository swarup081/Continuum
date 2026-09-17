"""POST /projects/{project_id}/restore — Restore an archived project."""
import json
import logging
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_project, update_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    project_id = event['pathParameters']['project_id']

    project = get_project(project_id)
    if not project:
        return error('NOT_FOUND', 'Project not found', 404)
    if project['user_id'] != user_id:
        return error('FORBIDDEN', 'Not your project', 403)

    # Restore to active
    updated = update_project(project_id, {'status': 'active'})

    # Return saved tabs so extension can reopen them
    saved_tabs = project.get('saved_tabs', [])

    logger.info(json.dumps({
        'action': 'project_restored',
        'project_id': project_id,
        'tabs_count': len(saved_tabs),
    }))

    return success({
        'project_id': project_id,
        'status': 'active',
        'saved_tabs': [tab['url'] for tab in saved_tabs] if saved_tabs else [],
    })
