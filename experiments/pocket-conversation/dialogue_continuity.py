"""Small explicit scene/choice memory for connected Halloween conversations.

Only reviewed phrases and bounded visitor-supplied choices are used here. Open
questions still go to the local model; this is not a general language parser.
"""
import re
from followup_questions import question_tail, question_repeated

COLORS = ('red', 'green', 'purple', 'orange', 'blue', 'yellow', 'black', 'white', 'pink', 'silver', 'gold')
SCENES = ('door', 'ghost', 'pumpkin', 'costume', 'candy', 'story')
OPENINGS = {
    'ghost': 'Let us give the shadows a friendly tenant! What would you name our tiny ghost?',
    'door': 'A haunted doorway needs a proper welcome! What color should our front door be?',
    'pumpkin': 'Let us wake a pumpkin from its patch! Should it grin or look surprised?',
}
QUESTIONS = {
    'door': ('What sound should it make when someone knocks?', 'What would you put behind that haunted door?',
        'Should it open with a creak or a whisper?', 'What would its spooky welcome sign say?', 'Where should its secret passage lead?'),
    'ghost': ('What silly sound should our ghost make?', 'Where should our friendly ghost hide?',
        'Should our ghost dance or float?', 'What harmless trick should our ghost try?', 'What would make our ghost laugh?'),
    'pumpkin': ('Should our pumpkin glow green or purple?', 'Where should our pumpkin greet the guests?',
        'What would our pumpkin say if it could talk?', 'What funny name would suit our pumpkin?', 'Should it hum or rattle when someone passes?'),
    'costume': ('What spooky sound would your character make?', 'What would your character say at the door?',
        'What tiny detail would make it unmistakable?', 'How would your character greet a friendly ghost?', 'What harmless trick could your character do?'),
    'candy': ('What would you name a haunted shop selling it?', 'How would you guard it from a hungry ghost?',
        'What spooky shape would you make it?', 'Would you hide it in a pumpkin or a tiny coffin?'),
    'story': ('What happens next in our spooky story?', 'What funny surprise should our character find?',
        'How could our character solve that mystery?', 'What would make that ending surprising?'),
}


def scene(text):
    for key, pattern in (('costume', r'costumes?|cape|dressed'), ('door', r'doors?|doorway'),
            ('pumpkin', r'pumpkins?|jack o lantern'), ('candy', r'candy|chocolate|sweets?|treats?'),
            ('ghost', r'ghosts?|spirits?'), ('story', r'stor(?:y|ies)|tales?')):
        if re.search(r'\b(?:' + pattern + r')\b', text, re.I):
            return key
    return ''


def changes_topic(text):
    """Recognize an explicit request to leave a thread, including everyday topics."""
    return bool(re.search(r"\b(?:let(?:'s| us) talk about|(?:want|went|rather|prefer|would like) to talk about|(?:can|could) we talk about|change (?:the )?(?:topic|subject)|talk about something else)\b", text, re.I))


def color_choice(text):
    # A colour inside a richer answer is not the whole choice: e.g. 'shiny
    # black boots' must reach the model with the boots detail still intact.
    positive = re.split(r'\bnot\b', text, maxsplit=1, flags=re.I)[0]
    words = re.findall(r"[a-z]+", positive.lower())
    fillers = {'actually', 'maybe', 'please', 'it', 'is', 'should', 'be', 'use',
        'make', 'let', 'us', 's', 'i', 'choose', 'pick', 'would', 'like', 'go',
        'with', 'a', 'an', 'the', 'color', 'colour'}
    colors = [word for word in words if word in COLORS]
    return colors[0] if len(colors) == 1 and all(word in fillers or word in COLORS for word in words) else ''


def frame_for(text, history, previous=None):
    previous = previous or {}
    last = next((r['content'] for r in reversed(history) if r['role'] == 'assistant'), '')
    question = question_tail(last)
    explicit = scene(text)
    if changes_topic(text) and not explicit:
        return {'scene': '', 'slots': {}}
    subject = explicit or scene(question) or previous.get('scene', '') or scene(last)
    slots = dict(previous.get('slots', {})) if subject == previous.get('scene') else {}
    # A correction gives the new value first: purple, not green. Only retain
    # whitelisted colours and small choices, never arbitrary inferred facts.
    positive = re.split(r'\bnot\b', text, maxsplit=1, flags=re.I)[0]
    color = color_choice(text)
    negated = re.search(r"\b(?:don't|do not|dislike|hate)\b", positive, re.I)
    naming = subject == 'ghost' and re.search(r'\bname\b', question, re.I)
    if color and not negated and not naming:
        slots['color'] = color
    elif slots.get('color') and re.search(r"\b(?:not|no|dislike|hate|don't like|do not like|don't want|do not want)\s+(?:the\s+)?" + slots['color'] + r'\b', text, re.I):
        slots.pop('color', None)
    if subject == 'ghost' and re.search(r'\bname\b', question, re.I):
        match = re.fullmatch(r"\s*(?:(?:let us |let's )?call (?:it|him|her) )?([A-Za-z]{2,18})[.!]?\s*", text, re.I)
        if match and match[1].lower() not in ('nothing', 'nobody', 'anything', 'whatever', 'maybe'):
            slots['name'] = match[1].capitalize()
    return {'scene': subject, 'slots': slots}


def note(frame, history):
    last = next((r['content'] for r in reversed(history) if r['role'] == 'assistant'), '')
    question = question_tail(last)
    facts = ', '.join(key + '=' + value for key, value in frame.get('slots', {}).items())
    return ('\nConversation thread: ' + frame.get('scene', '') + '. Visitor choices: ' + facts + '.'
        + '\nYou last asked: ' + question + '\nA short answer answers that question. React to it and build on it; do not ask for a choice already given.') if question and frame.get('scene') else ''


def opening(text):
    subject = scene(text)
    if subject in OPENINGS and re.search(r"\b(?:let(?:'s| us)|can we|want to)\b.{0,16}\b(?:make|create|design|build|invent)\b", text, re.I):
        return OPENINGS[subject]
    return None


def compose(answer, subject, recent):
    for question in QUESTIONS.get(subject, ()):
        candidate = answer + ' ' + question
        if len(candidate) <= 140 and len(candidate.split()) <= 24 and not question_repeated(question, recent):
            return candidate
    return None


def bridge(text, history, previous, recent):
    """Use an explicit answered slot, rather than asking a new survey question."""
    if not history or changes_topic(text) or len(text.split()) > 16 or '?' in text or re.match(r'\s*(?:why|how|what|where|when|who|can|could|do|does|is|are)\b', text, re.I):
        return None
    last = next((r['content'] for r in reversed(history) if r['role'] == 'assistant'), '')
    question = question_tail(last)
    if not question:
        return None
    if re.search(r"\b(?:don't|do not|dislike|hate|not sure)\b", text, re.I):
        return None
    frame = frame_for(text, history, previous); subject = frame['scene']; slots = frame['slots']
    # A new subject must go to the model, not be treated as an answer to the old one.
    if scene(text) and scene(question) and scene(text) != scene(question):
        return None
    answer = None
    color = slots.get('color')
    positive = re.split(r'\bnot\b', text, maxsplit=1, flags=re.I)[0]
    current_color = bool(color_choice(text))
    if re.search(r'\bnot\b', text, re.I) and not current_color:
        return None
    if subject == 'ghost' and 'name' in slots and re.search(r'\bname\b', question, re.I):
        answer = slots['name'] + ' can haunt our doorstep with a tiny boo!'
    elif current_color and subject in ('door', 'ghost', 'pumpkin', 'costume'):
        noun = {'door': 'haunted door', 'ghost': 'friendly ghost', 'pumpkin': 'pumpkin', 'costume': 'costume'}[subject]
        answer = f'{color.capitalize()} it is! That gives {"your" if subject == "costume" else "our"} {noun} some eerie style.'
    elif subject == 'pumpkin' and re.search(r'\b(?:grin|tooth|smile|surprised)\b', text, re.I):
        answer = 'One missing tooth gives our pumpkin a wonderfully crooked grin!' if re.search(r'\btooth\b', text, re.I) else 'Our pumpkin has a mischievous grin!' if re.search(r'\b(?:grin|smile)\b', text, re.I) else 'Our pumpkin looks delightfully surprised!'
    elif subject == 'ghost' and re.search(r'\b(?:glow|disappear|dance|float)\b', text, re.I):
        if re.search(r'\bdance\b', text, re.I): answer = 'Our ghost can dance without a single foot!'
        elif re.search(r'\bdisappear\b', text, re.I): answer = 'A disappearing ghost will keep our guests guessing!'
        elif re.search(r'\bglow\b', text, re.I): answer = 'A glowing ghost will light up our little haunt!'
        else: answer = 'Our ghost can float above these creaky old bones!'
    elif subject in ('door', 'ghost', 'pumpkin') and re.search(r'\b(?:sound|say|noise|knock|hum|rattle)\b', question, re.I):
        sound = re.search(r'\b(boo)(?:ed|ing)?\b|\b(creak|rattle|whisper|howl|squeak|giggle)\b', text, re.I)
        if sound: answer = 'A little ' + (sound[1] or sound[2]).lower() + ' will make our haunt come alive!'
    elif subject in ('door', 'ghost', 'pumpkin') and re.search(r'\b(?:where|hide)\b', question, re.I):
        place = re.search(r'\b(attic|porch|garden|doorway|closet|tree|hallway|window)\b', text, re.I)
        if place: answer = 'The ' + place[1].lower() + ' is a perfect corner for our spooky creation!'
    if answer:
        if subject == 'ghost' and slots.get('name'):
            answer = answer.replace('Our ghost', slots['name']).replace('our ghost', slots['name'])
        reply = compose(answer, subject, recent)
        if reply:
            return {'text': reply, 'frame': frame}
    return None
