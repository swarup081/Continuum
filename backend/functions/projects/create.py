"""POST /projects — Create a new project."""
import json
import logging
import os
import uuid
from datetime import datetime

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.db import create_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    body = parse_body(event)
    name = body.get('name', '').strip()

    if not name:
        return error('VALIDATION_ERROR', 'Project name is required')

    project = {
        'project_id': f'proj_{uuid.uuid4().hex[:12]}',
        'user_id': user_id,
        'name': name,
        'description': body.get('description', ''),
        'status': 'active',
        'created_at': datetime.utcnow().isoformat(),
        'saved_tabs': [],
    }

    create_project(project)

    logger.info(json.dumps({
        'action': 'project_created',
        'project_id': project['project_id'],
        'user_id': user_id,
    }))

    return success(project, 201)
