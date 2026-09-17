"""POST /ingest/tabs — Save tab URLs for project archive/restore."""
import json
import logging
import os

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

    body = parse_body(event)
    project_id = body.get('project_id')
    tabs = body.get('tabs', [])

    if not project_id:
        return error('VALIDATION_ERROR', 'project_id is required')

    project = get_project(project_id)
    if not project:
        return error('NOT_FOUND', 'Project not found', 404)
    if project['user_id'] != user_id:
        return error('FORBIDDEN', 'Not your project', 403)

    # Save tabs to project
    update_project(project_id, {'saved_tabs': tabs})

    logger.info(json.dumps({
        'action': 'tabs_saved',
        'project_id': project_id,
        'tab_count': len(tabs),
    }))

    return success({'saved': len(tabs)})
