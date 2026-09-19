"""One-time setup script: creates DynamoDB Local tables with all GSIs.

Usage:
    docker run -p 8000:8000 amazon/dynamodb-local
    python local_setup.py
"""
import boto3

dynamodb = boto3.client(
    'dynamodb',
    endpoint_url='http://localhost:8000',
    region_name='us-east-1',
    aws_access_key_id='local',
    aws_secret_access_key='local',
)


def create_tables():
    existing = dynamodb.list_tables()['TableNames']

    # 1. ContinuumProjects
    if 'ContinuumProjects' not in existing:
        dynamodb.create_table(
            TableName='ContinuumProjects',
            KeySchema=[
                {'AttributeName': 'project_id', 'KeyType': 'HASH'},
            ],
            AttributeDefinitions=[
                {'AttributeName': 'project_id', 'AttributeType': 'S'},
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
                {'AttributeName': 'created_at', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'UserProjectsIndex',
                    'KeySchema': [
                        {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'created_at', 'KeyType': 'RANGE'},
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                },
            ],
            BillingMode='PAY_PER_REQUEST',
        )
        print('✓ Created ContinuumProjects')
    else:
        print('• ContinuumProjects already exists')

    # 2. ContinuumContextEntries
    if 'ContinuumContextEntries' not in existing:
        dynamodb.create_table(
            TableName='ContinuumContextEntries',
            KeySchema=[
                {'AttributeName': 'entry_id', 'KeyType': 'HASH'},
            ],
            AttributeDefinitions=[
                {'AttributeName': 'entry_id', 'AttributeType': 'S'},
                {'AttributeName': 'project_id', 'AttributeType': 'S'},
                {'AttributeName': 'captured_at', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'ProjectEntriesIndex',
                    'KeySchema': [
                        {'AttributeName': 'project_id', 'KeyType': 'HASH'},
                        {'AttributeName': 'captured_at', 'KeyType': 'RANGE'},
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                },
            ],
            BillingMode='PAY_PER_REQUEST',
        )
        print('✓ Created ContinuumContextEntries')
    else:
        print('• ContinuumContextEntries already exists')

    # 3. ContinuumUsers
    if 'ContinuumUsers' not in existing:
        dynamodb.create_table(
            TableName='ContinuumUsers',
            KeySchema=[
                {'AttributeName': 'user_id', 'KeyType': 'HASH'},
            ],
            AttributeDefinitions=[
                {'AttributeName': 'user_id', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST',
        )
        print('✓ Created ContinuumUsers')
    else:
        print('• ContinuumUsers already exists')

    print('\n✅ All tables ready!')
    print('Tables:', dynamodb.list_tables()['TableNames'])


if __name__ == '__main__':
    create_tables()
