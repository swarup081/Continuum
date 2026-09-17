"""POST /context/search — Semantic search across project context."""
import json
import logging
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.bedrock_client import embed
from shared.db import get_entries_for_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    user_id = get_user_id(event)
    if not user_id:
        return error('UNAUTHORIZED', 'Missing or invalid token', 401)

    body = parse_body(event)
    project_id = body.get('project_id')
    query = body.get('query')
    top_k = body.get('top_k', 5)

    if not project_id or not query:
        return error('VALIDATION_ERROR', 'project_id and query are required')

    try:
        # Generate query embedding
        query_embedding = embed(query)

        # TODO: Replace with OpenSearch k-NN search once collection is provisioned
        # For now, fall back to DynamoDB scan + basic text matching
        entries, _ = get_entries_for_project(project_id, limit=50)

        # Simple text-based relevance scoring (temporary until OpenSearch is ready)
        query_lower = query.lower()
        scored_results = []
        for entry in entries:
            summary = entry.get('summary_text', '').lower()
            # Basic relevance: count query term matches
            score = sum(1 for word in query_lower.split() if word in summary)
            if score > 0:
                scored_results.append({
                    'entry_id': entry['entry_id'],
                    'summary_text': entry.get('summary_text', ''),
                    'source_name': entry.get('source_name', ''),
                    'source_type': entry.get('source_type', ''),
                    'url': entry.get('url', ''),
                    'relevance_score': min(score / len(query_lower.split()), 1.0),
                    'captured_at': entry.get('captured_at', ''),
                })

        # Sort by relevance and limit
        scored_results.sort(key=lambda x: x['relevance_score'], reverse=True)
        results = scored_results[:top_k]

        # If no text matches, return most recent entries
        if not results:
            results = [
                {
                    'entry_id': e['entry_id'],
                    'summary_text': e.get('summary_text', ''),
                    'source_name': e.get('source_name', ''),
                    'source_type': e.get('source_type', ''),
                    'url': e.get('url', ''),
                    'relevance_score': 0.5,
                    'captured_at': e.get('captured_at', ''),
                }
                for e in entries[:top_k]
            ]

        logger.info(json.dumps({
            'action': 'context_search',
            'project_id': project_id,
            'query': query,
            'results_count': len(results),
        }))

        return success({'results': results})

    except Exception as e:
        logger.error(f'Search error: {str(e)}')
        return error('INTERNAL_ERROR', str(e), 500)
