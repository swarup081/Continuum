"""Comprehend client — PII detection and redaction via Amazon Comprehend."""
import json
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

comprehend = boto3.client('comprehend')

# Comprehend has a 5000 byte limit per call
MAX_CHUNK_SIZE = 5000


def redact_pii(text):
    """Detect and redact PII from text using Amazon Comprehend.

    Args:
        text: The raw text to redact PII from.

    Returns:
        Text with PII entities replaced by [TYPE_REDACTED] markers.
    """
    if not text:
        return text

    # Process in chunks if text is longer than limit
    if len(text.encode('utf-8')) > MAX_CHUNK_SIZE:
        chunks = _split_into_chunks(text, MAX_CHUNK_SIZE)
        return ''.join(redact_pii(chunk) for chunk in chunks)

    try:
        response = comprehend.detect_pii_entities(
            Text=text,
            LanguageCode='en',
        )

        entities = response.get('Entities', [])

        if not entities:
            return text

        logger.info(json.dumps({
            'action': 'comprehend_pii_detected',
            'entity_count': len(entities),
            'types': list(set(e['Type'] for e in entities)),
        }))

        # Sort entities by offset (reverse) to replace from end to start
        # This preserves character positions during replacement
        sorted_entities = sorted(entities, key=lambda e: e['BeginOffset'], reverse=True)

        redacted = text
        for entity in sorted_entities:
            start = entity['BeginOffset']
            end = entity['EndOffset']
            pii_type = entity['Type']
            redacted = redacted[:start] + f'[{pii_type}_REDACTED]' + redacted[end:]

        return redacted

    except Exception as e:
        logger.error(f'Comprehend PII detection failed: {str(e)}')
        # Return original text if Comprehend fails — don't block ingestion
        return text


def _split_into_chunks(text, max_bytes):
    """Split text into chunks that fit within Comprehend's byte limit."""
    chunks = []
    current = ''
    for sentence in text.split('. '):
        test = current + sentence + '. '
        if len(test.encode('utf-8')) > max_bytes:
            if current:
                chunks.append(current)
            current = sentence + '. '
        else:
            current = test
    if current:
        chunks.append(current)
    return chunks
