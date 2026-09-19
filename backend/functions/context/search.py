"""POST /context/search — Semantic search across project context.

Uses exact cosine similarity against Bedrock Titan embeddings stored
in DynamoDB.  Mathematically identical to OpenSearch k-NN but without
the infrastructure cost — perfect for projects with < 1000 entries.
"""
import json
import logging
import math
import os

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error, get_user_id, parse_body
from shared.bedrock_client import embed
from shared.db import get_entries_for_project

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Minimum relevance score to include in results (0.0 – 1.0)
RELEVANCE_THRESHOLD = 0.3


def cosine_similarity(vec_a, vec_b):
    """Compute cosine similarity between two vectors.

    Returns a float between -1.0 and 1.0 (higher = more similar).
    """
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


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
        # 1. Embed the search query using Bedrock Titan
        logger.info(json.dumps({
            'action': 'search_embed_query',
            'project_id': project_id,
            'query': query,
        }))
        query_embedding = embed(query)

        # 2. Fetch all entries for this project from DynamoDB
        #    (paginate to get everything — fine for < 1000 entries)
        all_entries = []
        last_key = None
        while True:
            entries, last_key = get_entries_for_project(
                project_id, limit=100, last_key=last_key
            )
            all_entries.extend(entries)
            if not last_key:
                break

        logger.info(json.dumps({
            'action': 'search_entries_fetched',
            'project_id': project_id,
            'total_entries': len(all_entries),
        }))

        # 3. Compute cosine similarity for each entry that has an embedding
        scored_results = []
        for entry in all_entries:
            entry_embedding = entry.get('embedding')
            if not entry_embedding:
                # Entry was ingested before embeddings were stored — skip
                continue

            # Convert Decimal types from DynamoDB to float
            entry_embedding = [float(x) for x in entry_embedding]
            score = cosine_similarity(query_embedding, entry_embedding)

            if score >= RELEVANCE_THRESHOLD:
                scored_results.append({
                    'entry_id': entry['entry_id'],
                    'summary_text': entry.get('summary_text', ''),
                    'source_name': entry.get('source_name', ''),
                    'source_type': entry.get('source_type', ''),
                    'url': entry.get('url', ''),
                    'relevance_score': round(score, 4),
                    'captured_at': entry.get('captured_at', ''),
                })

        # 4. Sort by relevance (highest first) and take top_k
        scored_results.sort(key=lambda x: x['relevance_score'], reverse=True)
        results = scored_results[:top_k]

        logger.info(json.dumps({
            'action': 'context_search_complete',
            'project_id': project_id,
            'query': query,
            'entries_scanned': len(all_entries),
            'results_above_threshold': len(scored_results),
            'results_returned': len(results),
        }))

        return success({'results': results})

    except Exception as e:
        logger.error(f'Search error: {str(e)}')
        return error('INTERNAL_ERROR', str(e), 500)
