"""GET/PUT /profile — Universal profile management."""
import json
import logging
import os
from datetime import datetime

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.db import get_user, upsert_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    method = event['httpMethod']

    if method == 'GET':
        return handle_get(user_id)
    elif method == 'PUT':
        return handle_put(user_id, event)
    else:
        return error('VALIDATION_ERROR', f'Unsupported method: {method}')


def handle_get(user_id):
    user = get_user(user_id)
    if not user:
        return success({'user_id': user_id, 'facts': []})

    return success({
        'user_id': user_id,
        'facts': user.get('facts', []),
    })


def handle_put(user_id, event):
    body = parse_body(event)
    facts = body.get('facts', [])

    # Add timestamps to facts
    now = datetime.utcnow().isoformat()
    for fact in facts:
        if 'updated_at' not in fact:
            fact['updated_at'] = now

    # Cap at 10 facts to prevent bloat
    if len(facts) > 10:
        facts = facts[:10]

    user = get_user(user_id) or {'user_id': user_id}
    user['facts'] = facts
    upsert_user(user_id, user)

    return success({
        'user_id': user_id,
        'facts': facts,
    })
