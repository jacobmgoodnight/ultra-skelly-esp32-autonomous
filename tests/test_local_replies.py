"""Pure catalog/shuffle tests: no model, network, microphone or speaker access."""
import importlib.util
import random
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location('local_replies', Path(__file__).resolve().parents[1] / 'experiments/local-talkback/replies.py')
replies = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replies)


class ReplyVariety(unittest.TestCase):
    def test_stable_topics_and_bounded_reviewed_catalog(self):
        self.assertEqual(replies.TOPICS, (
            'unclear or off topic', 'hello greeting', 'skeleton joke', 'ghost joke',
            'witch joke', 'vampire joke', 'pumpkin joke', 'candy or trick or treat',
            'costume', 'who are you name', 'are you scary fear', 'dance music',
            'goodbye', 'how are you', 'thanks', 'favorite color', 'bat joke',
            'cat joke', 'mummy joke', 'tell a joke funny',
        ))
        self.assertEqual(len(replies.REPLIES), len(replies.TOPICS))
        lines = [line for variants in replies.REPLIES for line in variants]
        self.assertEqual(len(lines), 80)
        self.assertEqual(len(set(lines)), 80)
        for variants in replies.REPLIES:
            self.assertIsInstance(variants, tuple)
            self.assertEqual(len(variants), 4)
            for line in variants:
                self.assertIsInstance(line, str)
                self.assertTrue(line.isascii())
                self.assertEqual(line, line.strip())
                self.assertGreater(len(line), 20)
                self.assertLessEqual(len(line), 105)
                self.assertNotRegex(line, r'[{}<>\n\r]')

    def test_each_topic_exhausts_variants_before_refill_without_boundary_repeat(self):
        for seed in range(20):
            deck = replies.ReplyDeck(random.Random(seed))
            for topic_id in range(len(replies.TOPICS)):
                previous = None
                for _ in range(5):
                    cycle = []
                    for _ in range(4):
                        topic, variant, text = deck.next(topic_id)
                        self.assertEqual(topic, topic_id)
                        self.assertEqual(text, replies.REPLIES[topic][variant])
                        self.assertNotEqual(variant, previous)
                        previous = variant
                        cycle.append(variant)
                    self.assertEqual(set(cycle), set(range(4)))

    def test_generic_jokes_cycle_topics_and_variants(self):
        deck = replies.ReplyDeck(random.Random(18))
        per_topic = {topic: [] for topic in replies.JOKE_TOPICS}
        previous_topic = None
        for _ in range(8):
            cycle = []
            for _ in replies.JOKE_TOPICS:
                topic, variant, text = deck.next_joke()
                self.assertIn(topic, replies.JOKE_TOPICS)
                self.assertEqual(text, replies.REPLIES[topic][variant])
                self.assertNotEqual(topic, previous_topic)
                previous_topic = topic
                per_topic[topic].append(variant)
                cycle.append(topic)
            self.assertEqual(set(cycle), set(replies.JOKE_TOPICS))
        for variants in per_topic.values():
            self.assertEqual(set(variants[:4]), set(range(4)))
            self.assertEqual(set(variants[4:]), set(range(4)))

    def test_explicit_and_generic_requests_share_variant_bags(self):
        deck = replies.ReplyDeck(random.Random(2))
        first = deck.next(3)
        self.assertNotEqual(deck.next_joke()[0], first[0])
        ghost_variants = [first[1]]
        for _ in range(len(replies.JOKE_TOPICS)):
            topic, variant, _ = deck.next_joke()
            if topic == 3:
                ghost_variants.append(variant)
                break
        self.assertEqual(len(ghost_variants), 2)
        ghost_variants.extend(deck.next(3)[1] for _ in range(2))
        self.assertEqual(set(ghost_variants), set(range(4)))

    def test_recent_ids_and_all_bags_remain_bounded(self):
        deck = replies.ReplyDeck(random.Random(3))
        for index in range(2000):
            if index % 2:
                deck.next(index % len(replies.TOPICS))
            else:
                deck.next_joke()
            self.assertLessEqual(len(deck.recent_ids), replies.RECENT_LIMIT)
            self.assertEqual(len(deck._bags), len(replies.TOPICS))
            self.assertTrue(all(len(bag) <= 4 for bag in deck._bags))
            self.assertLessEqual(len(deck._joke_bag), len(replies.JOKE_TOPICS))
        snapshot = deck.recent_ids
        self.assertIsInstance(snapshot, tuple)
        self.assertEqual(len(snapshot), replies.RECENT_LIMIT)
        for topic, variant in snapshot:
            self.assertIs(type(topic), int)
            self.assertIs(type(variant), int)
            self.assertIn(topic, range(len(replies.TOPICS)))
            self.assertIn(variant, range(4))
        deck.next(0)
        self.assertNotEqual(snapshot, deck.recent_ids)

    def test_invalid_topic_ids_fail_without_mutating_state(self):
        deck = replies.ReplyDeck(random.Random(5))
        for invalid in [-1, 20, 10 ** 100, True, False, 1.0, '3', None, [], {}, b'3']:
            with self.assertRaises(ValueError):
                deck.next(invalid)
            self.assertEqual(deck.recent_ids, ())
            self.assertTrue(all(not bag for bag in deck._bags))
        for invalid_rng in [0, object(), {'shuffle': 1}]:
            with self.assertRaises(TypeError):
                replies.ReplyDeck(invalid_rng)

    def test_injected_randomness_is_reproducible_and_changes_order(self):
        def sequence(seed):
            deck = replies.ReplyDeck(random.Random(seed))
            return [deck.next_joke() for _ in range(36)]

        self.assertEqual(sequence(100), sequence(100))
        self.assertNotEqual(sequence(100), sequence(101))


if __name__ == '__main__':
    unittest.main()
