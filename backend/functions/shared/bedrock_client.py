"""Bedrock client - summarize and embed via Amazon Bedrock."""
import json
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime')


def summarize(text, model_id='amazon.nova-lite-v1:0'):
    """Summarize text using Bedrock."""
    truncated = text[:10000]

    logger.info(json.dumps({
        'action': 'bedrock_summarize',
        'model': model_id,
        'input_length': len(truncated),
    }))

    prompt = (
        'Summarize this captured context in 2-3 concise sentences. '
        'Focus on key facts, decisions, findings, and action items. '
        'Do not include any preamble like "Here is a summary".\n\n'
        + truncated
    )

    try:
        response = bedrock.converse(
            modelId=model_id,
            messages=[{
                'role': 'user',
                'content': [{'text': prompt}]
            }],
            inferenceConfig={
                'maxTokens': 300
            }
        )

        summary = response['output']['message']['content'][0]['text']

        logger.info(json.dumps({
            'action': 'bedrock_summarize_complete',
            'summary_length': len(summary),
        }))

        return summary
    except Exception as e:
        logger.error(f'Bedrock summarize failed: {str(e)}')
        return truncated[:150] + "..." if len(truncated) > 150 else truncated


def embed(text, model_id='amazon.titan-embed-text-v2:0'):
    """Generate embeddings using Bedrock Titan Embeddings."""
    truncated = text[:8000]

    logger.info(json.dumps({
        'action': 'bedrock_embed',
        'model': model_id,
        'input_length': len(truncated),
    }))

    try:
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
    except Exception as e:
        logger.error(f'Bedrock embed failed: {str(e)}')
        return [0.0] * 1024
