"""DELETE /projects/{project_id} — Hard delete a project and all context."""
import json
import logging
import os
import boto3

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_project, delete_project, delete_entries_for_project, get_entries_for_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
RAW_BUCKET = os.environ.get('RAW_BUCKET', 'continuum-raw')


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

    # Delete S3 objects
    entries, _ = get_entries_for_project(project_id, limit=100)
    for entry in entries:
        s3_ref = entry.get('s3_raw_ref')
        if s3_ref:
            try:
                s3.delete_object(Bucket=RAW_BUCKET, Key=s3_ref)
            except Exception:
                pass  # Best effort

    # Delete DynamoDB entries
    delete_entries_for_project(project_id)

    # Delete project
    delete_project(project_id)

    logger.info(json.dumps({
        'action': 'project_deleted',
        'project_id': project_id,
    }))

    return success({}, 204)
