"""PII client — redact PII via Comprehend (cloud) or regex (local)."""
import json
import logging
import os
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

LOCAL_MODE = os.environ.get('LOCAL_MODE', 'false').lower() == 'true'

if not LOCAL_MODE:
    import boto3
    comprehend = boto3.client('comprehend')

# Comprehend has a 5000 byte limit per call
MAX_CHUNK_SIZE = 5000

# Regex patterns for local PII detection
PII_PATTERNS = [
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 'EMAIL'),
    (r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b', 'PHONE'),
    (r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b', 'SSN'),
    (r'\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b', 'CREDIT_CARD'),
    (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', 'IP_ADDRESS'),
]


def redact_pii(text):
    """Detect and redact PII from text.

    Args:
        text: The raw text to redact PII from.

    Returns:
        Text with PII entities replaced by [TYPE_REDACTED] markers.
    """
    if not text:
        return text

    if LOCAL_MODE:
        return _regex_redact(text)

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


def _regex_redact(text):
    """Local regex-based PII redaction fallback."""
    redacted = text
    total_found = 0
    for pattern, pii_type in PII_PATTERNS:
        matches = re.findall(pattern, redacted)
        total_found += len(matches)
        redacted = re.sub(pattern, f'[{pii_type}_REDACTED]', redacted)

    if total_found > 0:
        logger.info(json.dumps({
            'action': 'regex_pii_redacted',
            'entity_count': total_found,
        }))

    return redacted


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

