"""Shared response helpers for Lambda functions."""
import json

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
    """Extract user_id from Cognito JWT claims in API Gateway event."""
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
