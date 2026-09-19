"""Continuum Local Server — Flask wrapper around Lambda handlers.

Runs on http://localhost:3001 and maps API Gateway routes to Lambda handlers.
No AWS account needed. Uses DynamoDB Local + Gemini API.

Usage:
    set LOCAL_MODE=true
    set GEMINI_API_KEY=your_key_here
    python local_server.py
"""
import json
import os
import sys
import logging

# Force LOCAL_MODE before anything else imports
os.environ['LOCAL_MODE'] = 'true'

from flask import Flask, request, jsonify
from flask_cors import CORS

# Add functions to path so handlers can find shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'functions'))

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def _make_event(body=None, path_params=None, query_params=None):
    """Build a fake API Gateway event from the Flask request."""
    event = {
        'body': json.dumps(body) if body else '{}',
        'pathParameters': path_params or {},
        'queryStringParameters': query_params or {},
        'requestContext': {
            'authorizer': {
                'claims': {'sub': 'dev-user-001'}
            }
        },
    }
    return event


def _lambda_response(result):
    """Convert a Lambda response dict to a Flask response."""
    body = json.loads(result.get('body', '{}'))
    status = result.get('statusCode', 200)
    return jsonify(body), status


# ─── Routes ──────────────────────────────────────────────────────────

# Projects
@app.route('/projects', methods=['POST'])
def create_project():
    from projects.create import handler
    event = _make_event(body=request.get_json(silent=True))
    return _lambda_response(handler(event, None))


@app.route('/projects', methods=['GET'])
def list_projects():
    from projects.list import handler
    event = _make_event(query_params=request.args.to_dict())
    return _lambda_response(handler(event, None))


@app.route('/projects/<project_id>', methods=['PATCH'])
def update_project(project_id):
    from projects.update import handler
    event = _make_event(
        body=request.get_json(silent=True),
        path_params={'project_id': project_id}
    )
    return _lambda_response(handler(event, None))


@app.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    from projects.delete import handler
    event = _make_event(path_params={'project_id': project_id})
    return _lambda_response(handler(event, None))


# Ingest
@app.route('/ingest', methods=['POST'])
def ingest():
    from ingest.handler import handler
    event = _make_event(body=request.get_json(silent=True))
    return _lambda_response(handler(event, None))


# Context
@app.route('/context/search', methods=['POST'])
def search_context():
    from context.search import handler
    event = _make_event(body=request.get_json(silent=True))
    return _lambda_response(handler(event, None))


@app.route('/context/primer', methods=['GET'])
def get_primer():
    from context.primer import handler
    event = _make_event(query_params=request.args.to_dict())
    return _lambda_response(handler(event, None))


@app.route('/context/entries', methods=['GET'])
def list_entries():
    from context.entries import handler
    event = _make_event(query_params=request.args.to_dict())
    return _lambda_response(handler(event, None))


# Profile
@app.route('/profile', methods=['GET', 'PUT'])
def profile():
    from profile.handler import handler
    if request.method == 'PUT':
        event = _make_event(body=request.get_json(silent=True))
    else:
        event = _make_event()
    # Inject httpMethod so handler can distinguish GET/PUT
    event['httpMethod'] = request.method
    return _lambda_response(handler(event, None))


# Privacy
@app.route('/privacy', methods=['GET', 'PUT'])
def privacy():
    from privacy.handler import handler
    if request.method == 'PUT':
        event = _make_event(body=request.get_json(silent=True))
    else:
        event = _make_event()
    event['httpMethod'] = request.method
    return _lambda_response(handler(event, None))


# Health check
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'mode': 'local'}), 200


if __name__ == '__main__':
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    if not gemini_key:
        logger.warning('⚠️  GEMINI_API_KEY not set! Summarization and embeddings will return fallback values.')
        logger.warning('   Get a free key at: https://aistudio.google.com/apikey')

    logger.info('🚀 Continuum Local Server starting on http://localhost:3001')
    logger.info('   Mode: LOCAL (DynamoDB Local + Gemini API)')
    app.run(host='0.0.0.0', port=3001, debug=True)
