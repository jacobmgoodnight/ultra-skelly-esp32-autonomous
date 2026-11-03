"""One fixed-endpoint Anthropic request; no retries, tools, logs or redirects.

Protocol verified against official API version 2026-10-21:
https://platform.claude.com/docs/en/api/messages/create
https://platform.claude.com/docs/en/build-with-claude/structured-outputs
https://platform.claude.com/docs/en/build-with-claude/thinking
"""
import json
import os
import re
import sys
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from conversation_policy import normalize_reply, validate_spoken_reply

API_URL = 'https://api.anthropic.com/v1/messages'
MODELS = frozenset(('claude-haiku-5-5', 'claude-sonnet-5-5'))
MAX_INPUT_BYTES = 16384
MAX_RESPONSE_BYTES = 32768


def _object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError('Duplicate cloud response field.')
        value[key] = item
    return value


def parse_json(data):
    def invalid_constant(_):
        raise ValueError('Invalid cloud JSON number.')
    return json.loads(data, object_pairs_hook=_object, parse_constant=invalid_constant)


def valid_key(key):
    return (isinstance(key, str) and 8 <= len(key) <= 2048
        and all(33 <= ord(char) <= 126 for char in key))


def build_request_body(payload):
    expected = {'op', 'model', 'messages', 'question', 'timeoutSeconds'}
    if not isinstance(payload, dict) or set(payload) != expected or payload['op'] != 'brain':
        raise ValueError('Invalid cloud brain request.')
    if payload['model'] not in MODELS or not isinstance(payload['question'], bool):
        raise ValueError('Invalid cloud brain model or cadence.')
    timeout = payload['timeoutSeconds']
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not .001 <= timeout <= 30:
        raise ValueError('Invalid cloud brain timeout.')
    messages = payload['messages']
    if (not isinstance(messages, list) or not 2 <= len(messages) <= 12
            or any(not isinstance(row, dict) or set(row) != {'role', 'content'}
                or not isinstance(row['content'], str) or not 1 <= len(row['content']) <= 8192
                for row in messages)
            or messages[0]['role'] != 'system' or messages[-1]['role'] != 'user'
            or any(row['role'] not in ('user', 'assistant') for row in messages[1:])):
        raise ValueError('Invalid bounded cloud brain messages.')
    properties = {'reply': {'type': 'string',
        'description': 'One specific complete spoken statement ending in a period or exclamation mark. At most 110 characters.'}}
    if payload['question']:
        properties['question'] = {'type': 'string',
            'description': 'One fresh related complete question ending in a question mark. At most 80 characters. Reply plus question: at most 140 characters and 24 words.'}
    # Current structured-output API does not support minLength/maxLength. Bounds
    # are descriptions here and hard post-validation before any speech.
    return {'model': payload['model'], 'max_tokens': 256, 'stream': False,
        'system': messages[0]['content'],
        'messages': [{'role': row['role'], 'content': row['content']} for row in messages[1:]],
        'thinking': {'type': 'adaptive', 'display': 'omitted'},
        'output_config': {'effort': 'low', 'format': {'type': 'json_schema', 'schema': {
            'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}}}}


def validate_result(value, question):
    expected = {'reply', 'question'} if question else {'reply'}
    if not isinstance(value, dict) or set(value) != expected or any(not isinstance(v, str) for v in value.values()):
        raise ValueError('Invalid cloud spoken fields.')
    answer = normalize_reply(value['reply'])
    if not re.fullmatch(r"[A-Za-z0-9 ,'-]+[.!]", answer) or len(answer) > 110:
        raise ValueError('Invalid cloud answer cadence.')
    spoken = answer
    if question:
        followup = normalize_reply(value['question'])
        if (not re.fullmatch(r"[A-Za-z][A-Za-z0-9'-]* [A-Za-z0-9 ,'-]+[?]", followup)
                or len(followup) > 80 or len(followup.split()) < 3):
            raise ValueError('Invalid cloud question cadence.')
        spoken += ' ' + followup
    validate_spoken_reply(spoken)
    if spoken.count('?') != int(question):
        raise ValueError('Invalid cloud question count.')
    return spoken


def parse_response(data, question):
    response = parse_json(data)
    if (not isinstance(response, dict) or response.get('type') != 'message'
            or response.get('role') != 'assistant' or response.get('stop_reason') != 'end_turn'):
        raise ValueError('Cloud reply did not complete normally.')
    details = response.get('stop_details')
    if isinstance(details, dict) and details.get('type') == 'refusal':
        raise ValueError('Cloud reply was declined.')
    content = response.get('content')
    if not isinstance(content, list) or not 1 <= len(content) <= 4:
        raise ValueError('Invalid cloud content blocks.')
    text = None
    for block in content:
        if not isinstance(block, dict):
            raise ValueError('Invalid cloud content block.')
        if block.get('type') == 'thinking':
            if (set(block) - {'type', 'thinking', 'signature'}
                    or any(not isinstance(block.get(name, ''), str) or len(block.get(name, '')) > 8192
                           for name in ('thinking', 'signature'))):
                raise ValueError('Invalid bounded cloud thinking block.')
            # Omitted thinking/signatures are not returned, retained or spoken.
            continue
        if block.get('type') != 'text' or text is not None or set(block) - {'type', 'text', 'citations'}:
            raise ValueError('Unsupported cloud content block.')
        if block.get('citations') not in (None, []):
            raise ValueError('Unsupported cloud citations.')
        text = block.get('text')
        if not isinstance(text, str) or not 1 <= len(text) <= 2048:
            raise ValueError('Invalid bounded cloud text.')
    if text is None:
        raise ValueError('Cloud reply has no spoken text.')
    return validate_result(parse_json(text), question)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, newurl):
        return None


def request_brain(payload, key, opener=None):
    if not valid_key(key):
        raise ValueError('Cloud brain credential is missing or invalid.')
    body = build_request_body(payload)
    encoded = json.dumps(body, ensure_ascii=True, allow_nan=False).encode('utf-8')
    if len(encoded) > MAX_INPUT_BYTES:
        raise ValueError('Cloud brain request exceeds its bound.')
    request = Request(API_URL, data=encoded, method='POST', headers={
        'Authorization': 'Bearer ' + key, 'anthropic-version': '2026-10-21', 'Content-Type': 'application/json'})
    connection = opener if opener is not None else build_opener(ProxyHandler({}), NoRedirect())
    with connection.open(request, timeout=payload['timeoutSeconds']) as response:
        if response.status != 200:
            raise RuntimeError('Cloud brain HTTP request failed.')
        headers = getattr(response, 'headers', {})
        if headers.get('Content-Encoding', 'identity').strip().lower() != 'identity':
            raise ValueError('Unsupported cloud response encoding.')
        if headers.get('Content-Type', 'application/json').split(';', 1)[0].strip().lower() != 'application/json':
            raise ValueError('Unsupported cloud response type.')
        declared = headers.get('Content-Length')
        if declared is not None:
            try:
                declared = int(declared)
            except (TypeError, ValueError):
                raise ValueError('Invalid cloud response length.') from None
            if not 1 <= declared <= MAX_RESPONSE_BYTES:
                raise ValueError('Cloud brain response exceeds its bound.')
        raw = response.read(MAX_RESPONSE_BYTES + 1)
    if not raw or len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError('Cloud brain response exceeds its bound.')
    if declared is not None and len(raw) != declared:
        raise ValueError('Incomplete cloud brain response.')
    return parse_response(raw, payload['question'])


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if not raw or len(raw) > MAX_INPUT_BYTES:
            raise ValueError('Invalid cloud worker input bound.')
        payload = parse_json(raw)
        spoken = request_brain(payload, os.environ.get('SKELLY_ANTHROPIC_API_KEY', ''))
        output = json.dumps({'reply': spoken}, ensure_ascii=True).encode('utf-8')
        if len(output) > 2048:
            raise ValueError('Invalid cloud worker output bound.')
        sys.stdout.buffer.write(output)
        sys.stdout.buffer.flush()
    except Exception:
        # No credential, transcript, provider error body or reasoning in logs.
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

