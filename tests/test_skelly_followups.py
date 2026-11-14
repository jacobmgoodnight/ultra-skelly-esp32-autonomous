"""Useful new questions survive; repaired questions obey the same checks."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1] / 'experiments/pocket-conversation'
sys.path.insert(0, str(HERE))
from followup_questions import BANK, asks_known_color, fresh_question, question_problem, question_repeated


class FollowupTests(unittest.TestCase):
    def test_a_new_action_is_not_another_favorite_question(self):
        for question, previous in (
                ('Which sweets would you share with a friend?', 'What is your favorite candy?'),
                ('Which sweets would you bake for the party?', 'Which sweets do you like?'),
                ('Which costume part should move when you dance?', 'Which costume do you like best?'),
                ('What would you choose to add to your costume?', 'Which costume do you like best?')):
            with self.subTest(question=question):
                self.assertFalse(question_repeated(question, [previous]))

    def test_actual_preference_paraphrases_and_exact_repeats_still_fail(self):
        self.assertTrue(question_repeated('Which sweets do you like?', ['What is your favorite candy?']))
        self.assertTrue(question_repeated('What sound would your ghost make?', ['What sound would your ghost make?']))
        self.assertFalse(question_repeated('What sound would your ghost make?', ['What color would your ghost be?']))

    def test_existing_colour_requests_repeat_a_visitor_fact(self):
        for question in ('What color is your cape?', 'What is the color of your cape?',
                'Which color did you choose for your cape?'):
            with self.subTest(question=question):
                self.assertTrue(asks_known_color(question, 'My cape is green.', []))
        self.assertTrue(asks_known_color('What color are your shoes?', 'Black boots.', []))

    def test_new_colour_effect_or_choice_is_a_new_detail(self):
        for question in ('Could your cape change color when you laugh?',
                'What color would your cape turn when you cast a spell?',
                'What color is your cape becoming?', 'Which color would you choose instead?'):
            with self.subTest(question=question):
                self.assertFalse(asks_known_color(question, 'My cape is green.', []))
                self.assertEqual(question_problem(question, 'My cape is green.', [], []), '')

    def test_colour_guard_uses_only_the_same_object_and_visitor_statements(self):
        history = [{'role': 'user', 'content': 'My cape has silver stars.'},
            {'role': 'assistant', 'content': 'Your green cape sounds magical!'}]
        self.assertFalse(asks_known_color('What color is your cape?', '', history))
        self.assertTrue(asks_known_color('What color are your stars?', '', history))
        self.assertFalse(asks_known_color('What color is your cape?', 'I do not like green capes.', []))

    def test_shared_checks_identify_observed_failure_modes(self):
        self.assertEqual(question_problem('What would you add to the?', '', [], []), 'incomplete')
        self.assertEqual(question_problem('What else would you add?', '', [], ['What else would you add?']), 'repeated')
        self.assertEqual(question_problem('Why are bones white?', 'Why are bones white?', [], []), 'visitor-echo')
        self.assertEqual(question_problem('Did you mention silver stars on your cape?', '', [], [],
            'Silver stars were on your cape!'), 'answer-confirmation')
        self.assertEqual(question_problem('What color is your cape?', 'My cape is green.', [], []), 'known-color')
        self.assertEqual(question_problem('Why did you choose silver stars for your cape?', '', [], [],
            'Silver stars were on your cape!'), '')

    def test_replacement_cannot_reask_a_known_colour(self):
        choices = ('What color is your cape?', 'What would your character say at the door?')
        with patch.dict(BANK, {'costume': choices}):
            selected = fresh_question('My cape is green.', [], subject='costume', history=[])
        self.assertEqual(selected, choices[1])
        self.assertEqual(question_problem(selected, 'My cape is green.', [], []), '')

    def test_replacement_cannot_confirm_the_answer_it_is_attached_to(self):
        choices = ('Did you mention silver stars?', 'What would your character say at the door?')
        answer = 'Silver stars were on your cape!'
        with patch.dict(BANK, {'costume': choices}):
            selected = fresh_question('', [], subject='costume', answer=answer)
        self.assertEqual(selected, choices[1])
        self.assertEqual(question_problem(selected, '', [], [], answer), '')

    def test_replacement_cannot_echo_a_visitors_question(self):
        transcript = 'Could you tell me a little more?'
        selected = fresh_question(transcript, [], contextual=True, inherit_topic=False)
        self.assertNotEqual(selected, transcript)
        self.assertEqual(question_problem(selected, transcript, [], []), '')

    def test_existing_topic_inheritance_and_budget_remain_available(self):
        recent = ['What would you name your ghost?']
        selected = fresh_question('Green.', recent)
        self.assertIn(selected, BANK['ghost'])
        self.assertEqual(recent, ['What would you name your ghost?'])
        self.assertEqual(fresh_question('Green.', recent, max_chars=2), '')
        self.assertEqual(fresh_question('Green.', recent, max_words=1), '')


if __name__ == '__main__':
    unittest.main()
