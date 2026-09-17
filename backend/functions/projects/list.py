"""GET /projects — List all projects for the authenticated user."""
import json
import logging
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import list_projects_for_user, count_entries_for_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    projects = list_projects_for_user(user_id)

    # Enrich with context count
    for project in projects:
        project['context_count'] = count_entries_for_project(project['project_id'])

    return success({'projects': projects})
