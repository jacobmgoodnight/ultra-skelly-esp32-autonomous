"""Exact reviewed family replies. The visitor transcript never becomes speech."""
import re
from companion import NAMES, REPLIES, literal_topic
from replies import JOKE_TOPICS
from conversation_policy import offered_name, blocked_input
from pocket_voice import CATALOG, check

# Reference only the existing reviewed catalog; no newly authored speech.
GREETINGS = {
    'friendly': (REPLIES[9][0], REPLIES[1][0]),
    'mischief': (REPLIES[9][1], REPLIES[1][1]),
    'guardian': (REPLIES[9][2], REPLIES[1][2]),
    'storyteller': (REPLIES[9][3], REPLIES[1][3]),
}
FAREWELL = REPLIES[12][0]
MORE = {
    'friendly': REPLIES[7][1],
    'mischief': REPLIES[8][1],
    'guardian': REPLIES[10][1],
    'storyteller': REPLIES[15][2],
}
FALLBACK = REPLIES[0][0]
RESET = REPLIES[1][0]
REDIRECT = REPLIES[0][1]
FAMILY_LINES = CATALOG


def validate_speech(text):
    """Fail closed at the final synthesis boundary, including name interpolation."""
    if not isinstance(text, str) or len(text) > 180:
        raise ValueError('Expected an approved family reply.')
    if text in FAMILY_LINES:
        return
    match = re.fullmatch(r'Hi, ([A-Z][a-z]+)! (.+)', text)
    if not match or match[1].casefold() not in NAMES or match[2] not in FAMILY_LINES:
        raise ValueError('Expected an approved family reply and allowlisted name.')


def select(transcript, memory, session, profile, cancel, deadline, deck):
    check(cancel, deadline)
    text = transcript.strip()
    new_visitor = bool(re.fullmatch(r'\s*(?:new visitor|start (?:a )?new visitor|new guest)[.!?]*\s*', text, re.I))
    if new_visitor:
        memory.reset(session)
    revision, history = memory.snapshot(session)
    previous = next((row['content'] for row in reversed(history) if row['role'] == 'assistant'), '')
    last_marker = next((row['content'] for row in reversed(history) if row['role'] == 'user'), '')
    # Strip only the exact allowlisted prefix used by the reviewed greeting.
    named = re.fullmatch(r'Hi, ([A-Z][a-z]+)! (.+)', previous)
    if named and named[1].casefold() in NAMES:
        previous = named[2]
    marker, card, keep_listening = 'other', 0, True
    if blocked_input(text):
        reply = REDIRECT
    elif new_visitor:
        reply, marker = RESET, 'greeting'
    elif re.search(r'\b(?:goodbye|bye|good ?night|see you)\b', text, re.I):
        reply, marker, keep_listening = FAREWELL, 'goodbye', False
    elif re.search(r'\b(?:joke|jokes|pun)\b|\bmake me laugh\b', text, re.I) and not re.search(r"\b(?:stop|no more|don't|do not)\b", text, re.I):
        topic = literal_topic(text)
        card, _, reply = deck.next(topic) if topic in JOKE_TOPICS else deck.next_joke()
        marker = 'joke'
    elif last_marker == 'joke' and previous in CATALOG and re.fullmatch(r'\s*(?:another(?: one)?|one more)(?: please)?[.!?]*\s*', text, re.I):
        card, _, reply = deck.next_joke()
        marker = 'joke'
    elif re.search(r'\b(?:tell me more|tell us more|go on)\b', text, re.I):
        topic = next((i for i, lines in enumerate(REPLIES) if previous in lines), None)
        if topic is not None:
            card, _, reply = deck.next(topic)
        else:
            reply = MORE[profile]
        marker = 'joke' if topic in JOKE_TOPICS else 'more'
    elif re.search(r'\b(?:hello|hi|hey|greetings)\b', text, re.I) or offered_name(text):
        reply, marker = GREETINGS[profile][int(bool(history))], 'greeting'
        name = offered_name(text)
        if name and name.casefold() in NAMES:
            reply = 'Hi, ' + name.capitalize() + '! ' + reply
    else:
        reply = FALLBACK
    validate_speech(reply)
    check(cancel, deadline)
    return {'card': card, 'text': reply, 'mode': 'family', 'reason': marker,
        'marker': marker, 'revision': revision, 'modelSeconds': 0,
        'continueConversation': keep_listening, 'brainSource': 'reviewed'}
