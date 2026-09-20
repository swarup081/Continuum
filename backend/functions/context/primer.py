"""GET /context/primer - Compose a short context primer for LLM injection."""
import json
import logging
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id
from shared.db import get_project, get_recent_entries, get_user

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    params = event.get('queryStringParameters') or {}
    project_id = params.get('project_id')

    if not project_id:
        return error('VALIDATION_ERROR', 'project_id query parameter is required')

    # Get project
    project = get_project(project_id)
    if not project:
        return error('NOT_FOUND', 'Project not found', 404)
    if project['user_id'] != user_id:
        return error('FORBIDDEN', 'Not your project', 403)

    # Get recent entries
    entries = get_recent_entries(project_id, limit=5)

    # Get user profile
    user = get_user(user_id) or {}
    facts = user.get('facts', [])

    # Compose primer
    primer = compose_primer(project, entries, facts)

    return success({
        'primer': primer,
        'project_name': project['name'],
        'profile_summary': format_profile(facts),
        'entry_count': len(entries),
        'last_updated': entries[0]['captured_at'] if entries else project['created_at'],
    })


def compose_primer(project, entries, facts):
    """Build a clean, concise primer for LLM injection."""
    lines = []

    if facts:
        fact_values = ', '.join(f['value'] for f in facts)
        lines.append('User Facts: ' + fact_values)

    if entries:
        lines.append('Recent context:')
        for entry in entries[:5]:
            source = entry.get('source_name', 'Unknown')
            summary = entry.get('summary_text', '')
            lines.append('- [' + source + '] ' + summary)

    return '\n'.join(lines)


def format_profile(facts):
    """Format profile facts into a short summary."""
    if not facts:
        return ''
    return ', '.join(f['value'] for f in facts[:3])
