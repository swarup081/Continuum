"""AI client — summarize and embed via Bedrock (cloud) or Gemini (local)."""
import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

LOCAL_MODE = os.environ.get('LOCAL_MODE', 'false').lower() == 'true'

if not LOCAL_MODE:
    import boto3
    bedrock = boto3.client('bedrock-runtime')


def summarize(text, model_id='anthropic.claude-3-haiku-20240307-v1:0'):
    """Summarize text using Bedrock Claude Haiku or Gemini.

    Args:
        text: The text to summarize (will be truncated to 10000 chars).
        model_id: Bedrock model ID (ignored in LOCAL_MODE).

    Returns:
        A 2-3 sentence summary string.
    """
    truncated = text[:10000]

    logger.info(json.dumps({
        'action': 'summarize',
        'mode': 'local' if LOCAL_MODE else 'bedrock',
        'input_length': len(truncated),
    }))

    if LOCAL_MODE:
        return _gemini_summarize(truncated)

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
        'action': 'summarize_complete',
        'summary_length': len(summary),
    }))

    return summary


def embed(text, model_id='amazon.titan-embed-text-v2:0'):
    """Generate embeddings using Bedrock Titan or Gemini.

    Args:
        text: The text to embed (truncated to 8000 chars).
        model_id: Bedrock embedding model ID (ignored in LOCAL_MODE).

    Returns:
        A list of floats (1024-dim for Titan, 768-dim for Gemini).
    """
    truncated = text[:8000]

    logger.info(json.dumps({
        'action': 'embed',
        'mode': 'local' if LOCAL_MODE else 'bedrock',
        'input_length': len(truncated),
    }))

    if LOCAL_MODE:
        return _gemini_embed(truncated)

    response = bedrock.invoke_model(
        modelId=model_id,
        body=json.dumps({
            'inputText': truncated,
        }),
    )

    result = json.loads(response['body'].read())
    embedding = result['embedding']

    logger.info(json.dumps({
        'action': 'embed_complete',
        'vector_dimensions': len(embedding),
    }))

    return embedding


# ─── Gemini Local Fallback ──────────────────────────────────────────

def _gemini_summarize(text):
    """Summarize using Google Gemini API (free tier)."""
    import google.generativeai as genai

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        logger.warning('GEMINI_API_KEY not set, returning truncated text as summary')
        return text[:200]

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')

    response = model.generate_content(
        'Summarize this captured context in 2-3 concise sentences. '
        'Focus on key facts, decisions, findings, and action items. '
        'Do not include any preamble like "Here is a summary".\n\n'
        f'{text}'
    )

    summary = response.text.strip()
    logger.info(json.dumps({
        'action': 'gemini_summarize_complete',
        'summary_length': len(summary),
    }))
    return summary


def _gemini_embed(text):
    """Generate embeddings using Google Gemini API (free tier)."""
    import google.generativeai as genai

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        logger.warning('GEMINI_API_KEY not set, returning zero vector')
        return [0.0] * 768

    genai.configure(api_key=api_key)
    result = genai.embed_content(
        model='models/text-embedding-004',
        content=text,
    )

    embedding = result['embedding']
    logger.info(json.dumps({
        'action': 'gemini_embed_complete',
        'vector_dimensions': len(embedding),
    }))
    return embedding

