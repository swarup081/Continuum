"""GET/PUT /privacy — Privacy rules management."""
import json
import logging
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.db import get_user, upsert_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DEFAULT_BLOCKED_DOMAINS = [
    'web.whatsapp.com',
    'mail.google.com',
    'onlinesbi.com',
    'netbanking.hdfcbank.com',
]

DEFAULT_BLOCKED_KEYWORDS = ['password', 'OTP', 'CVV', 'PIN']


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

    return success({
        'blocked_domains': user.get('blocked_domains', DEFAULT_BLOCKED_DOMAINS) if user else DEFAULT_BLOCKED_DOMAINS,
        'blocked_keywords': user.get('blocked_keywords', DEFAULT_BLOCKED_KEYWORDS) if user else DEFAULT_BLOCKED_KEYWORDS,
        'capture_enabled': user.get('capture_enabled', True) if user else True,
    })


def handle_put(user_id, event):
    body = parse_body(event)

    user = get_user(user_id) or {'user_id': user_id}
    user['blocked_domains'] = body.get('blocked_domains', DEFAULT_BLOCKED_DOMAINS)
    user['blocked_keywords'] = body.get('blocked_keywords', DEFAULT_BLOCKED_KEYWORDS)
    user['capture_enabled'] = body.get('capture_enabled', True)
    upsert_user(user_id, user)

    return success({
        'blocked_domains': user['blocked_domains'],
        'blocked_keywords': user['blocked_keywords'],
        'capture_enabled': user['capture_enabled'],
    })
