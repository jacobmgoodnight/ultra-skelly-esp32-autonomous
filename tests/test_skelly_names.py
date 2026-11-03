"""Name introductions, corrections, recall and private visit memory regressions."""
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import Mock

HERE = Path(__file__).resolve().parents[1] / 'experiments/pocket-conversation'
sys.path[:0] = [str(HERE), str(HERE.parent / 'local-talkback')]
import chat_server
import conversation_policy as policy


class NameTests(unittest.TestCase):
    def engine(self, reply='Those silver stars suit a wizard! What spell would you try?'):
        engine = object.__new__(chat_server.Engines)
        engine.memory = policy.Memory()
        engine.deck = chat_server.companion.ReplyDeck()
        engine.brain = Mock()
        engine.brain.reply.return_value = reply
        return engine

    def decide(self, engine, text, session='synthetic-visitor'):
        return engine.select_reply(text, threading.Event(), time.monotonic()+10, session, 'friendly')

    def test_common_spoken_and_recognized_name_forms(self):
        cases = {"My name's Rowan.":'Rowan', 'My name’s Zora.':'Zora',
            'My names DJ.':'DJ', 'My name s Casey.':'Casey', 'Call me McKenzie.':'McKenzie',
            "My name is O'Neil.":"O'Neil", 'My name is Anne-Marie.':'Anne-Marie',
            "I'm Jacob.":'Jacob', 'I am Emma.':'Emma'}
        for text, name in cases.items():
            with self.subTest(text=text):
                self.assertEqual(policy.offered_name(text), name)

    def test_adjectives_costumes_ghost_names_and_output_commands_are_not_visitor_names(self):
        for text in ("I'm happy.", 'I am a wizard.', 'My ghost is named Boo.',
                "My ghost's name is Casper.", 'My name is not Alex.',
                "Don't call me Alex.", 'My name is Assistant.', 'My name is System.',
                'My name is Nobody.', 'My name is https.', 'My name is A123456789.'):
            with self.subTest(text=text):
                self.assertEqual(policy.offered_name(text), '')

    def test_explicit_correction_selects_new_name_and_never_not(self):
        self.assertEqual(policy.offered_name("Don't call me Alex, call me Sam."), 'Sam')
        self.assertEqual(policy.offered_name("My name is not Alex, it's Zora."), 'Zora')

    def test_simple_introduction_is_acknowledged_without_model_latency(self):
        for text in ("My name's Rowan.", 'Hello, call me Zora.', "I'm Jacob."):
            engine = self.engine()
            decision = self.decide(engine, text)
            self.assertIn(policy.offered_name(text), decision['text'])
            self.assertEqual(decision['reason'], 'visitor-name-acknowledged')
            self.assertIn('?', decision['text'])
            engine.brain.reply.assert_not_called()
            policy.validate_spoken_reply(decision['text'])

    def test_introduction_with_a_real_detail_keeps_model_answer_and_name(self):
        engine = self.engine()
        decision = self.decide(engine, "My name's Rowan and my cape has silver stars.")
        self.assertIn('Rowan', decision['text'])
        self.assertIn('silver stars', decision['text'])
        engine.brain.reply.assert_called_once()
        policy.validate_spoken_reply(decision['text'])

    def test_recall_variants_are_direct_and_use_the_correct_visit(self):
        engine = self.engine()
        introduction = self.decide(engine, "My name's Rowan.")
        engine.remember_reply(introduction, "My name's Rowan.", 'synthetic-visitor')
        for text in ('Do you know my name?', 'What was my name?', 'Do you remember my name?',
                     'What did I say my name was?'):
            self.assertIn('Rowan', self.decide(engine, text)['text'])
        engine.brain.reply.assert_not_called()
        self.assertNotIn('Rowan', self.decide(engine, 'What is my name?', 'another-visitor')['text'])

    def test_name_correction_replaces_old_name_and_survives_history_rollover(self):
        engine = self.engine()
        for text in ("My name's Rowan.", 'Actually, call me Zora.'):
            decision = self.decide(engine, text)
            engine.remember_reply(decision, text, 'synthetic-visitor')
        revision, _ = engine.memory.snapshot('synthetic-visitor')
        for n in range(12):
            engine.memory.commit('synthetic-visitor', revision, 'A new detail '+str(n), 'A fresh answer.')
        self.assertNotIn('Zora', str(engine.memory.snapshot('synthetic-visitor')[1]))
        result = self.decide(engine, 'Do you know my name?')
        self.assertIn('Zora', result['text'])
        self.assertNotIn('Rowan', result['text'])

    def test_forgetting_and_idle_expiry_remove_the_name_without_late_resurrection(self):
        now = [1.0]
        memory = policy.Memory(now=lambda:now[0])
        revision, _ = memory.snapshot('one')
        memory.commit('one', revision, "My name's Rowan.", 'Hello, Rowan!')
        now[0] += 301
        self.assertEqual(memory.name('one', revision), '')
        self.assertFalse(memory.commit('one', revision, 'Call me Zora.', 'late'))
        newer, _ = memory.snapshot('two')
        memory.commit('two', newer, 'Call me Zora.', 'Hello!')
        memory.forget('two')
        self.assertEqual(memory.name('two', newer), '')
        self.assertFalse(memory.commit('two', newer, 'Call me Alex.', 'late'))


if __name__ == '__main__':
    unittest.main()
