"""Opt-in conversational Skelly. Generated replies, separate from reviewed catalog mode."""
import argparse
import os
from http.server import ThreadingHTTPServer
import re
import threading
import time

import server
from server import companion
from conversation_policy import Memory, PROFILES, SYSTEM, FALLBACK, REDIRECT, blocked_input, normalize_reply, validate_spoken_reply, interaction_instruction, followup_due, without_extra_question, offered_name, repeats_reply, release_old_jokes, current_thread, nervous_guest
from local_brain import LocalBrain
from pocket_voice import Cancelled, GuardedVoice, CATALOG, check, load_assets
from pathlib import Path
from thinking_cues import load_cues
from pocket_voice import convert_wave
from skeleton_tone import skeleton_tone, crypt_tone
from followup_questions import split_followup, question_tail, question_repeated, question_problem, fresh_question, topic as question_topic, topics as question_topics
from dialogue_continuity import bridge, frame_for, opening, changes_topic, note as dialogue_note
from voice_previews import load_previews
from conversation_policy import asks_visitor_name, name_only_introduction
from cloud_brain import from_env as cloud_brain_from_env
from cloud_voice import from_env as cloud_voice_from_env
import family_conversation

HALLOWEEN_THEME = re.compile(r'\b(?:Halloween|spooky|haunted|skeletons?|monsters?|ghosts?|pumpkins?|costumes?|crypts?)\b', re.I)

PUN_HINTS = {
    'spook tacles': 'Spook tacles sounds like spectacles, another word for glasses.',
    'I scream': 'I scream sounds like ice cream, a dessert.',
    'boo hamas': 'Boo hamas sounds like the Bahamas, a vacation destination.',
    'Purr ple': 'Purr ple sounds like purple; purring is a cat sound.',
    'funny bone': 'Funny means humorous, and funny bone is also the name for a spot near the elbow.',
}
PUN_ANSWERS = {
    'spook tacles': 'Spook tacles sounds like spectacles, another word for glasses!',
    'I scream': 'I scream sounds like ice cream, so the ghost turns dessert into a spooky sound!',
    'boo hamas': 'Boo hamas mixes a ghostly boo with the Bahamas, a vacation destination!',
    'Purr ple': 'Purr ple mixes purple with the purring sound a cat makes!',
    'funny bone': 'A funny bone is an elbow spot, and funny also means humorous!',
    'no body': 'No body sounds like nobody, and a skeleton has no fleshy body!',
}


def explain_catalog_joke(transcript, history, recent):
    last = next((row['content'] for row in reversed(history) if row['role'] == 'assistant'), '')
    if last not in CATALOG or not re.search(r'\b(?:why|explain|meaning|understand|that joke)\b', transcript, re.I):
        return None
    answer = next((answer for phrase, answer in PUN_ANSWERS.items() if phrase.casefold() in last.casefold()), '')
    if not answer:
        return None
    questions = ('Shall we invent a different pun?', 'Which word would you give a spooky twist?', 'What silly mix of words would you try?')
    return answer + ' ' + next((q for q in questions if not question_repeated(q, recent)), 'What would you add?')


def clarify_recognition(transcript, history):
    # An observed tiny-ASR confusion. Ask, rather than silently rewriting what
    # the visitor said. A genuine new cake topic or prior cake is left alone.
    users = ' '.join(row['content'] for row in history if row['role'] == 'user')
    recall = re.search(r'\b(?:remember|what did I (?:say|tell)|what was on my)\b', transcript, re.I)
    if recall and not changes_topic(transcript) and re.search(r'\bcake\b', transcript, re.I) and re.search(r'\bcape\b', users, re.I) and not re.search(r'\bcake\b', users, re.I):
        return "My old bones heard cake. Did you mean your costume's cape?"
    return None


class ConversationalVoice(GuardedVoice):
    """Only this explicit mode permits checked, newly generated spoken text."""
    validate_text = staticmethod(validate_spoken_reply)
    max_native_wav = 44 + 24000 * 10 * 2
    tone = 'haunt-dry'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.base_assets = self.paths, self.config
        self.haunt_assets = {}
        for variant in (('dry', 'croaky') if self.pocket else ()):
            lock = Path(__file__).with_name('haunt-' + variant + '.lock.json')
            try:
                self.haunt_assets['haunt-' + variant] = load_assets(lock_path=lock)
            except (OSError, ValueError, KeyError):
                pass
        if self.pocket:
            self.label = 'Pocket 18.2M · synthetic Haunt and E references · Piper fallback'

    @property
    def available_tones(self):
        return list(self.haunt_assets) + (['crypt', 'hollow', 'natural'] if self.pocket else ['natural'])

    @staticmethod
    def native_audio(data):
        return convert_wave(data, max_seconds=10, trim_padding=True)

    def synthesize(self, text, work, cancel=None, deadline=None):
        cancel = cancel if cancel is not None else threading.Event()
        deadline = deadline if deadline is not None else time.monotonic() + 10
        self.paths, self.config = self.haunt_assets.get(self.tone, self.base_assets)
        try:
            audio, source = super().synthesize(text, work, cancel, deadline)
        finally:
            self.paths, self.config = self.base_assets
        if source == 'pocket-e' and self.tone in self.haunt_assets:
            source = 'pocket-' + self.tone
        check(cancel, deadline)
        audio = crypt_tone(audio) if self.tone == 'crypt' else skeleton_tone(audio) if self.tone == 'hollow' else audio
        check(cancel, deadline)
        return audio, source

    @staticmethod
    def delivery_parts(text):
        # Only reviewed jokes need the question/punchline gap. A conversational
        # question followed by a sentence should use one native invocation.
        return GuardedVoice.delivery_parts(text) if text in CATALOG else [text]


def wants_joke(transcript, history):
    if re.search(r"\b(?:stop|no more|don't|do not|already|same|about that|about the)\b.{0,40}\b(?:jokes?|puns?)\b|\b(?:that|the|your) joke\b", transcript, re.I):
        return False
    if re.match(r"\s*(?:why|how come|explain|what made|stop|no more|don't|do not)\b", transcript, re.I):
        return False
    if re.search(r'\btell (?:me |us )?(?:why|how|what made)\b', transcript, re.I):
        return False
    if re.search(r"\b(?:tell|give) (?:me |us )?(?:(?:a|another|one|some|new|different|more) )?(?:[a-z]+ )?(?:joke|pun)\b|\b(?:another|one more|want a|hear a|know a) (?:[a-z]+ )?(?:joke|pun)\b|^joke please[.!?]*$|\bmake me laugh\b", transcript, re.I):
        return True
    last = next((message['content'] for message in reversed(history) if message['role'] == 'assistant'), '')
    return last in CATALOG and bool(re.fullmatch(
        r'\s*(?:another(?: one)?|one more)(?: joke)?(?: please)?[.!?]*\s*', transcript, re.I))


class Engines(server.Engines):
    conversation = True
    family_catalog = True

    def __init__(self, model='lfm', model_port=8776, pocket=True):
        # Capture optional keys only in their provider clients. Local ASR, model
        # and synthesis children must not inherit unrelated API credentials.
        cloud_brain, cloud_voice = cloud_brain_from_env(), cloud_voice_from_env()
        self.cloud_config_issue = {
            'brain': bool(os.environ.get('SKELLY_ANTHROPIC_API_KEY') or os.environ.get('SKELLY_ANTHROPIC_MODEL')) and cloud_brain is None,
            'voice': bool(os.environ.get('SKELLY_ELEVENLABS_API_KEY') or os.environ.get('SKELLY_ELEVENLABS_VOICE_ID') or os.environ.get('SKELLY_ELEVENLABS_MODEL')) and cloud_voice is None,
        }
        for name in ('SKELLY_ANTHROPIC_API_KEY', 'SKELLY_ELEVENLABS_API_KEY'):
            os.environ.pop(name, None)
        super().__init__(pocket=pocket)
        self.voice = ConversationalVoice(companion.TOOLS, pocket=pocket)
        self.local_voice = self.voice
        self.brain = LocalBrain(model=model, port=model_port)
        # Configuration checks only. No provider request, warm-up or account
        # check occurs until an explicit, consented cloud turn.
        self.cloud_brain, self.cloud_voice = cloud_brain, cloud_voice
        self.memory = Memory()
        self.phase = 'idle'
        try:
            self.voice_previews = load_previews()
        except (OSError, ValueError, KeyError):
            self.voice_previews = {}
        try:
            self.thinking_cues = load_cues()
        except (OSError, ValueError, KeyError):
            self.thinking_cues = []
            print('Fixed thinking cues unavailable; ordinary conversation still works.', flush=True)

    def respond(self, data, cancel, session=None, profile='friendly', tone='haunt-dry',
            brain_mode='local', voice_mode='local', cloud_consent=False, delivery='natural', conversation_mode='open'):
        if conversation_mode not in ('open', 'family') or (conversation_mode == 'family' and (brain_mode != 'local' or voice_mode != 'local')):
            raise ValueError('Family mode requires local speech and reviewed replies.')
        if brain_mode not in ('local', 'cloud') or voice_mode not in ('local', 'elevenlabs'):
            raise ValueError('Choose an available conversation model and voice.')
        if delivery not in ('natural', 'whispering', 'dry'):
            raise ValueError('Choose an available cloud delivery style.')
        if (brain_mode != 'local' or voice_mode != 'local') and not cloud_consent:
            raise ValueError('Cloud mode needs explicit consent for this chat.')
        if brain_mode == 'cloud' and getattr(self, 'cloud_brain', None) is None:
            raise ValueError('Cloud conversation is not configured on this laptop.')
        if voice_mode == 'elevenlabs' and getattr(self, 'cloud_voice', None) is None:
            raise ValueError('Cloud voice is not configured on this laptop.')
        local_voice = getattr(self, 'local_voice', self.voice)
        if tone not in local_voice.available_tones:
            raise ValueError('Choose an available voice tone.')
        local_voice.tone = tone
        self.turn_brain = self.cloud_brain if brain_mode == 'cloud' else self.brain
        self.voice = self.cloud_voice if voice_mode == 'elevenlabs' else local_voice
        if voice_mode == 'elevenlabs':
            self.voice.delivery = delivery
        self.family_mode = conversation_mode == 'family'
        self.phase = 'recognizing'
        try:
            return super().respond(data, cancel, session, profile)
        finally:
            self.voice = local_voice
            self.family_mode = False
            self.turn_brain = self.brain
            self.phase = 'idle'

    def start(self):
        self.brain.start()
        self.memory.start()
        try:
            self.brain.reply([{'role': 'system', 'content': SYSTEM + '\nPersonality: ' + PROFILES['friendly']},
                {'role': 'user', 'content': 'Hello.'}], threading.Event(), time.monotonic() + 6)
        except Exception:
            print('Conversation warm-up unavailable; the next explicit turn may load the model.', flush=True)

    def close(self):
        self.memory.close()
        self.brain.close()
        super().close()

    def select_reply(self, transcript, cancel, deadline, session=None, profile='friendly'):
        if not session:
            raise ValueError('Choose a conversation personality and a page session.')
        if getattr(self, 'family_mode', False):
            if profile not in family_conversation.GREETINGS:
                raise ValueError('Choose a conversation personality and a page session.')
            return family_conversation.select(transcript, self.memory, session, profile, cancel, deadline, self.deck)
        if profile not in PROFILES:
            raise ValueError('Choose a conversation personality and a page session.')
        revision, history = self.memory.snapshot(session)
        brain = getattr(self, 'turn_brain', self.brain)
        using_cloud = brain is getattr(self, 'cloud_brain', None)
        introduced_name = offered_name(transcript)
        name = introduced_name or self.memory.name(session, revision)
        recent_questions = self.memory.questions(session, revision)
        previous_frame = self.memory.frame(session, revision)
        frame = frame_for(transcript, history, previous_frame)
        thread = current_thread(history, transcript)
        visitor_thread = [row['content'] for row in thread if row['role'] == 'user'] + [transcript]
        # An explicit everyday switch must not become a Halloween thread merely
        # because the model introduced a pumpkin. Visitor words can invite the
        # theme back; no new inferred facts or persistent state are needed.
        everyday_thread = (any(changes_topic(value) for value in visitor_thread)
            and not any(HALLOWEEN_THEME.search(value) for value in visitor_thread))
        ask = bool(followup_due(transcript, history))
        started = time.monotonic()
        mode, reason, card, brain_source = 'generated', None, 0, 'reviewed'
        if blocked_input(transcript):
            text, mode, reason = REDIRECT, 'friendly-redirect', 'input-filter'
        elif asks_visitor_name(transcript):
            text = f'Your name is {name}!' if name else "I don't have a name in my short memory right now."
            reason = 'visitor-name-recall'
        elif introduced_name and name_only_introduction(transcript):
            text, reason = f'Good to meet you, {introduced_name}!', 'visitor-name-acknowledged'
        elif wants_joke(transcript, history):
            topic = companion.literal_topic(transcript)
            card, _, text = self.deck.next(topic) if topic is not None else self.deck.next_joke()
            mode = 'requested-joke'
        elif re.search(r'\b(?:goodbye|bye|good ?night|see you)\b', transcript, re.I):
            text = 'Till our next moonlit chat. Rest those weary bones!'
        elif clarification := clarify_recognition(transcript, history):
            text, reason = clarification, 'recognition-clarification'
        elif nervous_guest(transcript):
            answer = 'Let us keep this gentle.' if profile == 'friendly' else 'My creaky knees vote for something gentle!'
            questions = ('Would a friendly story or a quiet game feel better?',
                'What would make this feel more comfortable for you?', 'Shall we keep our story cheerful and gentle?')
            question = next((q for q in questions if not question_repeated(q, recent_questions)), 'Could you tell me a little more?')
            text, reason = answer + (' ' + question if ask else ''), 'nervous-guest'
        elif explanation := explain_catalog_joke(transcript, history, recent_questions):
            text, reason = explanation, 'reviewed-pun-explanation'
        elif ask and (scene_start := opening(transcript)):
            text, reason = scene_start, 'scene-started'
            frame = {'scene': frame['scene'], 'slots': {}}
        elif ask and (guided := bridge(transcript, history, previous_frame, recent_questions)):
            text, frame, reason = guided['text'], guided['frame'], 'answered-choice'
        else:
            self.phase = 'thinking'
            messages = [{'role': 'system', 'content': SYSTEM + '\nPersonality: ' + PROFILES[profile]
                + '\nTHIS TURN: ' + interaction_instruction(transcript, thread)}]
            if name:
                messages[0]['content'] += '\nVisitor first name: ' + name + '. Use it naturally, not in every reply.'
            # The full ledger still prevents repeats, but old-scene questions
            # must not prime generation after an explicit switch of subject.
            thread_questions = [question_tail(row['content']) for row in thread if row['role'] == 'assistant']
            thread_questions = [q for q in thread_questions if q]
            if thread_questions:
                messages[0]['content'] += '\nAlready asked in this thread; use a NEW detail: ' + ' | '.join(thread_questions[-2:])
            if not changes_topic(transcript):
                messages[0]['content'] += dialogue_note(frame, history)
            last = next((message['content'] for message in reversed(history) if message['role'] == 'assistant'), '')
            explain = bool(last in CATALOG and re.search(r'\b(?:why|explain|meaning|understand|that joke)\b', transcript, re.I))
            if explain:
                hints = [explanation for phrase, explanation in PUN_HINTS.items() if phrase.casefold() in last.casefold()]
                if hints:
                    messages[0]['content'] += '\nExplain the last joke directly. Wordplay fact: ' + ' '.join(hints)
            messages.extend(release_old_jokes(thread, explain))
            messages.append({'role': 'user', 'content': transcript[:500]})
            try:
                # A cancelled model was reaped. On the next explicit turn, allow
                # a bounded reload before starting the ordinary generation clock.
                # Keep both inside the existing overall turn deadline; no retry.
                cold = not brain.loaded
                brain.start(cancel, min(deadline, started + 12))
                # Cold inference also has to prefill its uncached system prompt.
                # Only that first reply gets extra time; warm replies keep 6 s.
                generation_budget = 12 if cold or using_cloud else 6
                brain_source = 'claude' if using_cloud else 'local'
                text = normalize_reply(brain.reply(messages, cancel, min(deadline, time.monotonic() + generation_budget),
                    question=ask))
                validate_spoken_reply(text)
                if not ask:
                    text = without_extra_question(text)
                if repeats_reply(text, history) and not re.search(r'\b(?:repeat|say that again)\b', transcript, re.I):
                    alternatives = ('My bones got stuck on repeat. What would you like to explore next?',
                        'Let us leave that old story in its crypt. Tell me a little more.',
                        'A fresh thought might wake these bones. What sounds interesting to you?')
                    text = next((line for line in alternatives if not repeats_reply(line, history)), FALLBACK)
                    mode, reason = 'conversation-recovery', 'repeated-output'
            except Cancelled:
                raise
            except Exception as error:
                check(cancel, deadline)
                if using_cloud:
                    # No paid voice call, local retry or invented spoken answer
                    # after a failed cloud response. Provider details stay private.
                    raise RuntimeError('Cloud conversation failed. Nothing played.') from None
                text, mode = FALLBACK, 'conversation-fallback'
                reason = ('model-timeout' if isinstance(error, TimeoutError) else
                    'model-output-rejected' if isinstance(error, ValueError) else 'model-unavailable')
        validate_spoken_reply(text)
        if introduced_name and mode == 'generated':
            answer, question = split_followup(text)
            if not re.search(r'(?<![A-Za-z])' + re.escape(introduced_name) + r'(?![A-Za-z])', answer, re.I):
                # Preserve the model's actual answer; only add the supplied name.
                # The ordinary follow-up budget below makes room without clipping.
                named_answer = introduced_name + ', ' + answer[0].lower() + answer[1:]
                if len(named_answer) <= 140 and len(named_answer.split()) <= 24:
                    text = named_answer + (' ' + question if question else '')
                    if len(text) > 140 or len(text.split()) > 24:
                        text = named_answer
                    validate_spoken_reply(text)
        # Check the question separately: a changed answer must not disguise the
        # same follow-up. Preserve the answer and replace only that question.
        if mode != 'requested-joke':
            answer, question = split_followup(text)
            last_reply = next((row['content'] for row in reversed(history) if row['role'] == 'assistant'), '')
            # The question is the strongest context for a brief answer. Prefer
            # its subject over incidental words in the previous answer.
            shifted = changes_topic(transcript) or reason == 'nervous-guest' or everyday_thread
            subject = '' if reason == 'nervous-guest' else question_topic(transcript)
            if not subject and not shifted:
                subject = question_topic(split_followup(last_reply)[1]) or question_topic(last_reply)
            # Cross-topic words can develop an idea (a wizard teaching a ghost
            # a spell). A word's coarse topic alone cannot establish a jump.
            # Keep only the narrow old failure: a stock preference survey on a
            # different known topic. This is not a semantic relevance score.
            survey = (re.match(r'^(?:What|Which) (?:(?:kind|type) of|is your (?:favorite|favourite))\b', question, re.I)
                and re.search(r'\b(?:like|enjoy|prefer|favorite|favourite)\b', question, re.I))
            different_subject = (reason != 'nervous-guest' and subject and question_topic(question)
                and subject not in question_topics(question) and survey)
            uninvited_theme = everyday_thread and HALLOWEEN_THEME.search(question)
            if ask and (question_problem(question, transcript, history, recent_questions, answer)
                    or different_subject or uninvited_theme):
                fresh = fresh_question(transcript, recent_questions, 139-len(answer), 24-len(answer.split()), subject,
                    contextual=True, inherit_topic=False, history=history, answer=answer,
                    avoid_pattern=HALLOWEEN_THEME if everyday_thread else None)
                if not fresh:
                    # Leave room without clipping a spoken sentence mid-word.
                    answer = re.split(r'(?<=[.!])\s+', answer)[0]
                    fresh = fresh_question(transcript, recent_questions, 139-len(answer), 24-len(answer.split()), subject,
                        contextual=True, inherit_topic=False, history=history, answer=answer,
                        avoid_pattern=HALLOWEEN_THEME if everyday_thread else None)
                if not fresh:
                    answer = 'These old bones are listening!'
                    fresh = fresh_question(transcript, recent_questions, subject=subject, contextual=True,
                        inherit_topic=False, history=history, answer=answer,
                        avoid_pattern=HALLOWEEN_THEME if everyday_thread else None)
                candidate = answer + ' ' + fresh
                validate_spoken_reply(candidate)
                text = candidate
                if mode == 'generated' and reason is None:
                    reason = 'fresh-question-selected' if question else 'followup-added'
            elif not ask and question:
                text = answer
        validate_spoken_reply(text)
        check(cancel, deadline)
        self.phase = 'synthesizing'
        return {'card': card, 'text': text, 'mode': mode, 'reason': reason,
            'modelSeconds': round(time.monotonic() - started, 3), 'revision': revision,
            'frame': frame, 'continueConversation': ask and mode != 'conversation-fallback',
            'brainSource': brain_source}

    def remember_reply(self, decision, transcript, session):
        if decision['mode'] == 'family':
            self.memory.commit(session, decision['revision'], decision['marker'], decision['text'])
            return
        # Do not retain unsafe/injection requests or failed generated responses.
        if decision['mode'] in ('generated', 'requested-joke', 'conversation-recovery'):
            self.memory.commit(session, decision['revision'], transcript, decision['text'], frame=decision.get('frame'))
        self.memory.remember_question(session, decision['revision'], decision['text'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, choices=range(1024, 65536), default=8777)
    parser.add_argument('--model', choices=('lfm', '0.8b', '2b'), default='lfm')
    parser.add_argument('--model-port', type=int, choices=range(1024, 65536), default=8776)
    parser.add_argument('--lazy-model', action='store_true', help='Load the local model on the first generated turn.')
    parser.add_argument('--skip-warmup', action='store_true', help='Start the model without a synthetic warm-up request.')
    parser.add_argument('--voice', choices=('pocket', 'piper'), default='pocket', help='Choose the local voice runtime. Piper needs no gated Pocket assets.')
    args = parser.parse_args()
    # Remove the local launcher identity before any voice or model child starts.
    launcher_instance = os.environ.pop('SKELLY_LAUNCHER_INSTANCE', '')
    engines, turns = Engines(args.model, model_port=args.model_port, pocket=args.voice == 'pocket'), server.Turns()
    engines.launcher_instance = launcher_instance
    try:
        print('Starting opt-in conversational Skelly. Microphone OFF; no playback.', flush=True)
        if args.lazy_model:
            engines.memory.start()
        elif args.skip_warmup:
            engines.brain.start()
            engines.memory.start()
        else:
            engines.start()
        with ThreadingHTTPServer(('127.0.0.1', args.port), server.make_handler(engines, args.port, turns)) as http:
            http.daemon_threads = False
            print(f'Ready: http://127.0.0.1:{args.port}/ — {engines.brain.label}.', flush=True)
            try:
                http.serve_forever()
            except KeyboardInterrupt:
                turns.stop()
    finally:
        turns.stop()
        engines.close()


if __name__ == '__main__':
    main()
