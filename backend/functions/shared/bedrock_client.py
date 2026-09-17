"""Bedrock client — summarize and embed via Amazon Bedrock."""
import json
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime')


def summarize(text, model_id='anthropic.claude-3-haiku-20240307-v1:0'):
    """Summarize text using Bedrock Claude Haiku.

    Args:
        text: The text to summarize (will be truncated to 10000 chars).
        model_id: Bedrock model ID.

    Returns:
        A 2-3 sentence summary string.
    """
    truncated = text[:10000]

    logger.info(json.dumps({
        'action': 'bedrock_summarize',
        'model': model_id,
        'input_length': len(truncated),
    }))

    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 300,
            'messages': [{
                'role': 'user',
                'content': (
                    'Summarize this captured context in 2-3 concise sentences. '
                    'Focus on key facts, decisions, findings, and action items. '
                    'Do not include any preamble like "Here is a summary".\n\n'
                    f'{truncated}'
                ),
            }],
        }),
    )

    result = json.loads(response['body'].read())
    summary = result['content'][0]['text']

    logger.info(json.dumps({
        'action': 'bedrock_summarize_complete',
        'summary_length': len(summary),
    }))

    return summary


def embed(text, model_id='amazon.titan-embed-text-v2:0'):
    """Generate embeddings using Bedrock Titan Embeddings.

    Args:
        text: The text to embed (truncated to 8000 chars).
        model_id: Bedrock embedding model ID.

    Returns:
        A list of floats (1024-dimensional vector).
    """
    truncated = text[:8000]

    logger.info(json.dumps({
        'action': 'bedrock_embed',
        'model': model_id,
        'input_length': len(truncated),
    }))

    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps({
            'inputText': truncated,
        }),
    )

    result = json.loads(response['body'].read())
    embedding = result['embedding']

    logger.info(json.dumps({
        'action': 'bedrock_embed_complete',
        'vector_dimensions': len(embedding),
    }))

    return embedding
