"""POST /auth/login and POST /auth/refresh — Authenticate via Cognito."""
import json
import logging
import os
import boto3

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from shared.response import success, error

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client('cognito-idp')
CLIENT_ID = os.environ.get('USER_POOL_CLIENT_ID')


def handler(event, context):
    """Handle POST /auth/login and POST /auth/refresh."""
    path = event.get('path', '')
    body = json.loads(event.get('body', '{}'))

    if '/refresh' in path:
        return handle_refresh(body)
    return handle_login(body)


def handle_login(body):
    """Authenticate with email + password."""
    email = body.get('email')
    password = body.get('password')

    if not email or not password:
        return error('VALIDATION_ERROR', 'Email and password are required')

    try:
        response = cognito.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password,
            },
        )

        tokens = response['AuthenticationResult']

        # Get user sub from token
        user_info = cognito.get_user(AccessToken=tokens['AccessToken'])
        user_sub = next(
            (attr['Value'] for attr in user_info['UserAttributes'] if attr['Name'] == 'sub'),
            None,
        )

        logger.info(json.dumps({'action': 'user_login', 'user_id': user_sub}))

        return success({
            'user_id': user_sub,
            'token': tokens['IdToken'],
            'refresh_token': tokens['RefreshToken'],
        })

    except cognito.exceptions.NotAuthorizedException:
        return error('UNAUTHORIZED', 'Invalid email or password', 401)
    except cognito.exceptions.UserNotFoundException:
        return error('NOT_FOUND', 'No account found with this email', 404)
    except Exception as e:
        logger.error(f'Login error: {str(e)}')
        return error('INTERNAL_ERROR', str(e), 500)


def handle_refresh(body):
    """Refresh tokens using a refresh token."""
    refresh_token = body.get('refresh_token')

    if not refresh_token:
        return error('VALIDATION_ERROR', 'refresh_token is required')

    try:
        response = cognito.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='REFRESH_TOKEN_AUTH',
            AuthParameters={
                'REFRESH_TOKEN': refresh_token,
            },
        )

        tokens = response['AuthenticationResult']
        return success({
            'token': tokens['IdToken'],
            'refresh_token': refresh_token,  # Refresh token doesn't change
        })

    except Exception as e:
        return error('UNAUTHORIZED', 'Invalid or expired refresh token', 401)
