"""Question-only repetition checks and bounded topic-specific replacements."""
from difflib import SequenceMatcher
import re

BANK = {
    'candy': ('Would you invent a sweet that glows in the dark?', 'What would you call a ghost candy shop?',
        'How would you hide sweets from a hungry ghost?', 'Would your spooky sweets be sour or sweet?'),
    'costume': ('What spooky detail would finish your costume?', 'Would your costume glow or make a noise?',
        'What would your character say at the door?', 'How would your character greet a friendly ghost?'),
    'ghost': ('Would your ghost glow or disappear?', 'What sound would your friendly ghost make?',
        'Where would your ghost like to hide?', 'What would you name a tiny ghost?'),
    'house': ('What sound would your haunted door make?', 'Would your haunted room have a secret passage?',
        'What would you put inside a friendly haunted room?', 'Who would greet guests at your spooky door?'),
    'pumpkin': ('What face would you carve in a glowing pumpkin?', 'Would your pumpkin grin or look surprised?',
        'What would you name a pumpkin that could talk?'),
    'story': ('Where would your spooky story begin?', 'Who would be the friendly monster in your story?',
        'What funny surprise would end that story?'),
}
GENERAL = ('What silly power would a skeleton have?', 'Would you explore a moonlit maze or an old crypt?',
    'What would you name a friendly Halloween monster?', 'How would you decorate a tiny haunted doorway?',
    'What sound should these creaky bones make?', 'Would a ghost rather float or dance?',
    'Who would you invite to a friendly monster party?', 'What harmless trick would surprise a skeleton?',
    'Where would you hide a glowing Halloween lantern?', 'What would make a spooky night feel magical?')
CONTEXTUAL = ('Could you tell me a little more?', 'What would you like to try next?',
    'What else would you add?', 'How did that idea begin?', 'What happened next?',
    'How would you change it?', 'What do you think about that?',
    'Which part would you explore first?', 'Where would you take that idea?',
    'What would make it more fun?', 'What matters most to you about that?')


def split_followup(text):
    match = re.fullmatch(r'(.*[.!])\s+([^.!?]+\?)', text)
    return (match[1], match[2]) if match else (text, '')


def question_tail(text):
    return split_followup(text)[1] or (text if text.endswith('?') and text.count('?') == 1 else '')


def question_complete(question, model_output=False):
    """Catch obvious dangling clauses without rejecting normal longer questions.

    This is a small quality heuristic, not a general English grammar checker.
    Keep the answer and choose a reviewed question when the ending is dangling.
    """
    words = _words(question)
    dangling = {'a', 'an', 'the', 'and', 'or', 'but', 'my', 'your', 'our', 'their',
        'its', 'some', 'any', 'of', 'to', 'for', 'with', 'because'}
    return question.endswith('?') and len(words) >= 3 and words[-1] not in dangling


def _words(text):
    text = text.casefold().replace("what's", 'what is').replace("wouldn't", 'would not')
    return re.sub(r'[^a-z0-9 ]', '', text).split()


def topics(text):
    patterns = (('candy', r'cand(?:y|ies)|chocolate|sweets?|treats?|desserts?|snacks?'),
            ('costume', r'costumes?|dress(?:ed|ing)?'), ('pumpkin', r'pumpkins?|jack o lantern'),
            ('story', r'stor(?:y|ies)|movies?|films?|tales?'), ('house', r'houses?|rooms?|doors?|hallways?|crypts?'),
            ('ghost', r'ghosts?|spirits?'))
    return tuple(name for name, pattern in patterns if re.search(r'\b(?:' + pattern + r')\b', text, re.I))


def topic(text):
    return next(iter(topics(text)), '')


def question_repeated(question, recent):
    current = ' '.join(_words(question))
    # "Which" can ask for a new action or detail. It is not, by itself,
    # evidence that we are asking the visitor's favourite a second time.
    preference = lambda q: bool(re.search(r'\b(?:favorite|favourite|like|enjoy|prefer|best)\b', q, re.I))
    def aspect(q):
        for name, words in (('color', r'colou?r|red|green|purple'), ('sound', r'sound|noise|say'),
                ('name', r'name|call'), ('place', r'where|hide|place'), ('shape', r'shape|face'),
                ('size', r'size|big|small'), ('reason', r'why|reason')):
            if re.search(r'\b(?:' + words + r')\b', q, re.I):
                return name
        return ''
    for previous in recent:
        # A new dimension of the same creation is a useful continuation, even
        # when the sentence structure is very similar (colour versus sound).
        if aspect(question) and aspect(previous) and aspect(question) != aspect(previous):
            continue
        if SequenceMatcher(None, current, ' '.join(_words(previous))).ratio() >= .76:
            return True
        # Catch common paraphrases the full-reply comparison missed, e.g.
        # 'favorite candy' versus 'which sweets do you like'.
        if topic(question) and topic(question) == topic(previous) and preference(question) and preference(previous):
            return True
    return False


def echoes_visitor_question(question, transcript):
    return bool(question and re.match(r'\s*(?:what|which|who|why|where|when|how|do|does|did|is|are|can|could|would|should)\b', transcript, re.I)
        and _words(question) == _words(transcript))


def confirms_same_answer(question, answer):
    """Catch 'silver stars ... Did you mention silver stars?' without blocking why."""
    if not re.match(r'^(?:Did|Have) you (?:say|said|mention|mentioned|tell|told|choose|pick|chosen|picked)\b', question, re.I):
        return False
    filler = {'did', 'have', 'you', 'say', 'said', 'mention', 'mentioned', 'tell', 'told',
        'choose', 'chosen', 'pick', 'picked', 'me', 'us', 'your', 'my', 'is', 'was',
        'were', 'are', 'on', 'the', 'a', 'an', 'it', 'with', 'of', 'in', 'that', 'to', 'had',
        'add', 'adding', 'having'}
    content = set(_words(question)) - filler
    return len(content) >= 2 and content.issubset(set(_words(answer)) - filler)


def confirms_visitor_fact(question, transcript, history):
    """Avoid quizzing a supplied detail, without treating model text as evidence.

    This narrow lexical check only handles explicit 'Did/Have you mention...'
    forms. Uncertain, negative and interrogative visitor statements are left
    alone for clarification. Compare one statement at a time: separate visitor
    turns must never supply different pieces of an invented combined fact.
    """
    uncertain = re.compile(r"\b(?:no|not|never|maybe|perhaps|possibly|probably|might|unsure|uncertain)\b"
        r"|\b(?:don'?t|doesn'?t|didn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|can'?t|wouldn'?t)\b"
        r"|\bI (?:think|guess|wonder)\b", re.I)
    interrogative = re.compile(r'^(?:what|which|who|why|where|when|how|do|does|did|is|are|can|could|would|should)\b', re.I)
    values = [row['content'] for row in history if row['role'] == 'user'] + [transcript]
    for value in values:
        for statement in re.split(r'(?<=[.!?])\s+|;', value):
            statement = statement.strip()
            if (not statement or '?' in statement or uncertain.search(statement)
                    or interrogative.search(statement)):
                continue
            if confirms_same_answer(question, statement):
                return True
    return False


def asks_known_color(question, transcript, history):
    """Avoid asking a supplied object's colour again; retain only local text.

    Deliberately narrow: a silver star does not tell us a cape's colour. These
    checks use visitor statements, never model inventions, and save no new data.
    """
    # Only requests for an existing colour can repeat an established fact.
    # Imagining a change ("Could your cape change colour when you laugh?")
    # remains a useful new direction, even when its current colour is known.
    if not re.search(r'^(?:What|Which)\s+(?:colou?r\s+(?:is|are)\b|(?:is|are)\s+(?:the\s+)?colou?r\b|colou?r\s+(?:did|have)\s+you\s+(?:choose|chosen|pick|picked)\b)', question, re.I):
        return False
    if re.search(r'\b(?:chang\w*|turn\w*|becom\w*|if|when|instead|next|different)\b', question, re.I):
        return False
    from dialogue_continuity import COLORS
    nouns = r'boots?|shoes?|stars?|capes?|hats?|doors?|pumpkins?|ghosts?|costumes?'
    targets = re.findall(r'\b(' + nouns + r')\b', question, re.I)
    canonical = lambda word: re.sub(r's$', '', word.lower()).replace('shoe', 'boot')
    targets = {canonical(word) for word in targets}
    if not targets:
        return False
    color = r'(?:' + '|'.join(COLORS) + r')'
    for value in [row['content'] for row in history if row['role'] == 'user'] + [transcript]:
        if re.search(r"\b(?:not|don't|do not|dislike|hate)\b", value, re.I):
            continue
        before = re.findall(r'\b' + color + r'\s+(' + nouns + r')\b', value, re.I)
        after = re.findall(r'\b(' + nouns + r')\s+(?:is|are|was|were)\s+' + color + r'\b', value, re.I)
        if targets.intersection(canonical(word) for word in before + after):
            return True
    return False


def question_problem(question, transcript, history, recent, answer=''):
    """Apply the same narrow checks to model and replacement questions."""
    if not question_complete(question):
        return 'incomplete'
    if question_repeated(question, recent):
        return 'repeated'
    if echoes_visitor_question(question, transcript):
        return 'visitor-echo'
    if confirms_same_answer(question, answer):
        return 'answer-confirmation'
    if confirms_visitor_fact(question, transcript, history):
        return 'visitor-fact-confirmation'
    if asks_known_color(question, transcript, history):
        return 'known-color'
    return ''


def fresh_question(transcript, recent, max_chars=54, max_words=12, subject='', contextual=False, inherit_topic=True,
        history=(), answer='', avoid_pattern=None):
    short = ('What sounds spooky?', 'What would you add?', 'What happens next?', 'Who joins the fun?', 'How about you?')
    # Brief answers such as 'green' still belong to the previous question's
    # subject. An explicit new subject always takes priority.
    subject = subject or topic(transcript)
    if not subject and inherit_topic:
        subject = next((topic(q) for q in reversed(recent) if topic(q)), '')
    candidates = BANK.get(subject, ()) + (CONTEXTUAL if contextual else GENERAL) + short
    return next((q for q in candidates if len(q)<=max_chars and len(q.split())<=max_words
        and not question_problem(q, transcript, history, recent, answer)
        and not (avoid_pattern and avoid_pattern.search(q))), '')
