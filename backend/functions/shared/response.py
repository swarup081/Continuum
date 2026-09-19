"""Shared response helpers for Lambda functions."""
import json
import os

LOCAL_MODE = os.environ.get('LOCAL_MODE', 'false').lower() == 'true'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
}


def success(body, status_code=200):
    """Return a successful API response."""
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str),
    }


def error(code, message, status_code=400):
    """Return an error API response."""
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': {
                'code': code,
                'message': message,
            }
        }),
    }


def get_user_id(event):
    """Extract user_id from Cognito JWT claims or return dev user in LOCAL_MODE."""
    if LOCAL_MODE:
        return 'dev-user-001'
    try:
        claims = event['requestContext']['authorizer']['claims']
        return claims['sub']
    except (KeyError, TypeError):
        return None


def parse_body(event):
    """Parse JSON body from API Gateway event."""
    body = event.get('body', '{}')
    if isinstance(body, str):
        return json.loads(body)
    return body
