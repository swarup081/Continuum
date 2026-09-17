"""POST /auth/register — Register a new user via Cognito."""
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
USER_POOL_ID = os.environ.get('USER_POOL_ID')
CLIENT_ID = os.environ.get('USER_POOL_CLIENT_ID')


def handler(event, context):
    """Handle POST /auth/register."""
    body = json.loads(event.get('body', '{}'))

    email = body.get('email')
    password = body.get('password')
    name = body.get('name', '')

    if not email or not password:
        return error('VALIDATION_ERROR', 'Email and password are required')

    try:
        # 1. Sign up
        signup_response = cognito.sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            Password=password,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'name', 'Value': name},
            ],
        )

        user_sub = signup_response['UserSub']

        # 2. Auto-confirm (for hackathon — skip email verification)
        cognito.admin_confirm_sign_up(
            UserPoolId=USER_POOL_ID,
            Username=email,
        )

        # 3. Auto-login to get tokens
        auth_response = cognito.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password,
            },
        )

        tokens = auth_response['AuthenticationResult']

        logger.info(json.dumps({
            'action': 'user_registered',
            'user_id': user_sub,
        }))

        return success({
            'user_id': user_sub,
            'email': email,
            'token': tokens['IdToken'],
            'refresh_token': tokens['RefreshToken'],
        }, 201)

    except cognito.exceptions.UsernameExistsException:
        return error('VALIDATION_ERROR', 'An account with this email already exists', 409)
    except Exception as e:
        logger.error(f'Registration error: {str(e)}')
        return error('INTERNAL_ERROR', str(e), 500)
