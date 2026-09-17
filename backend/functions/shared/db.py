"""DynamoDB helper functions."""
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')

PROJECTS_TABLE = os.environ.get('PROJECTS_TABLE', 'ContinuumProjects')
ENTRIES_TABLE = os.environ.get('ENTRIES_TABLE', 'ContinuumContextEntries')
USERS_TABLE = os.environ.get('USERS_TABLE', 'ContinuumUsers')


def get_projects_table():
    return dynamodb.Table(PROJECTS_TABLE)


def get_entries_table():
    return dynamodb.Table(ENTRIES_TABLE)


def get_users_table():
    return dynamodb.Table(USERS_TABLE)


# ─── Projects ───────────────────────────────────────────────────────

def create_project(project):
    """Put a new project item."""
    table = get_projects_table()
    table.put_item(Item=project)
    return project


def get_project(project_id):
    """Get a single project by ID."""
    table = get_projects_table()
    response = table.get_item(Key={'project_id': project_id})
    return response.get('Item')


def list_projects_for_user(user_id):
    """List all projects for a user via GSI."""
    table = get_projects_table()
    response = table.query(
        IndexName='UserProjectsIndex',
        KeyConditionExpression=Key('user_id').eq(user_id),
        ScanIndexForward=False,  # newest first
    )
    return response.get('Items', [])


def update_project(project_id, updates):
    """Update project fields."""
    table = get_projects_table()
    update_expr = 'SET ' + ', '.join(f'#{k} = :{k}' for k in updates)
    expr_names = {f'#{k}': k for k in updates}
    expr_values = {f':{k}': v for k, v in updates.items()}

    response = table.update_item(
        Key={'project_id': project_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues='ALL_NEW',
    )
    return response.get('Attributes')


def delete_project(project_id):
    """Delete a project."""
    table = get_projects_table()
    table.delete_item(Key={'project_id': project_id})


# ─── Context Entries ────────────────────────────────────────────────

def create_entry(entry):
    """Put a new context entry."""
    table = get_entries_table()
    table.put_item(Item=entry)
    return entry


def get_entries_for_project(project_id, limit=20, last_key=None):
    """List entries for a project via GSI, paginated."""
    table = get_entries_table()
    kwargs = {
        'IndexName': 'ProjectEntriesIndex',
        'KeyConditionExpression': Key('project_id').eq(project_id),
        'ScanIndexForward': False,  # newest first
        'Limit': limit,
    }
    if last_key:
        kwargs['ExclusiveStartKey'] = last_key

    response = table.query(**kwargs)
    return response.get('Items', []), response.get('LastEvaluatedKey')


def get_recent_entries(project_id, limit=5):
    """Get the most recent N entries for a project."""
    items, _ = get_entries_for_project(project_id, limit=limit)
    return items


def delete_entries_for_project(project_id):
    """Delete all entries for a project (batch)."""
    table = get_entries_table()
    items, last_key = get_entries_for_project(project_id, limit=100)

    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={'entry_id': item['entry_id']})

    # Continue if there are more
    while last_key:
        items, last_key = get_entries_for_project(project_id, limit=100, last_key=last_key)
        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={'entry_id': item['entry_id']})


def count_entries_for_project(project_id):
    """Count entries for a project."""
    table = get_entries_table()
    response = table.query(
        IndexName='ProjectEntriesIndex',
        KeyConditionExpression=Key('project_id').eq(project_id),
        Select='COUNT',
    )
    return response.get('Count', 0)


# ─── Users (Profile + Privacy) ─────────────────────────────────────

def get_user(user_id):
    """Get user record (profile + privacy)."""
    table = get_users_table()
    response = table.get_item(Key={'user_id': user_id})
    return response.get('Item')


def upsert_user(user_id, updates):
    """Create or update user record."""
    table = get_users_table()
    updates['user_id'] = user_id

    # Use put_item for simplicity (full replace)
    table.put_item(Item=updates)
    return updates
