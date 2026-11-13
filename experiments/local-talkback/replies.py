"""Reviewed Halloween reply variants; no visitor text is accepted or retained."""
import random
from collections import deque


# Topic numbers are the existing companion model's stable selection contract.
TOPICS = (
    'unclear or off topic',
    'hello greeting',
    'skeleton joke',
    'ghost joke',
    'witch joke',
    'vampire joke',
    'pumpkin joke',
    'candy or trick or treat',
    'costume',
    'who are you name',
    'are you scary fear',
    'dance music',
    'goodbye',
    'how are you',
    'thanks',
    'favorite color',
    'bat joke',
    'cat joke',
    'mummy joke',
    'tell a joke funny',
)

REPLIES = (
    (
        'Boo! My funny bone is ready. Ask me for a Halloween joke!',
        'My pumpkin brain missed that. Try a ghost joke or a friendly hello!',
        'I know more about pumpkins than that. Want a silly Halloween joke?',
        'That rattled my thinking bones! Ask me about costumes, candy, or ghosts!',
    ),
    (
        'Boo there, friend! Welcome to my little pumpkin patch!',
        'Well, hello! You arrived just in time for a fresh batch of boo jokes!',
        'Happy Halloween! Pull up an imaginary pumpkin and say hello!',
        'Greetings from the giggle patch! My funny bone is pleased to meet you!',
    ),
    (
        'Why did the skeleton skip the party? He had no body to go with!',
        'Why was the skeleton so calm? Nothing got under his skin!',
        'Why did the skeleton go to school? To improve his skulls!',
        'Why did the skeleton carry a pencil? To draw a funny bone!',
    ),
    (
        "What is a ghost's favorite dessert? I scream!",
        'Why did the ghost wear glasses? To improve its spook tacles!',
        'What do ghosts put on their bagels? Scream cheese!',
        'Where does a ghost go on vacation? The boo hamas!',
    ),
    (
        'Why was the witch late? Her broom was stuck in a sweepy traffic jam!',
        'What does a witch order at a cafe? A broom brew!',
        'Why did the witch bring a notebook? To practice her spelling!',
        'Why did the witch sweep the sky? She wanted a clean getaway!',
    ),
    (
        'What fruit does a friendly vampire love? A neck tarine!',
        'Why did the friendly vampire bring a pencil? To draw a fang tastic picture!',
        'What do friendly vampires read? Fang fiction!',
        "What is a friendly vampire's favorite dance? The fang dango!",
    ),
    (
        'Why did the pumpkin sit on the porch? It wanted to squash its worries!',
        'Why did the pumpkin join the band? It had a gourd sense of rhythm!',
        'Why did the pumpkin cross the road? To visit its patch of friends!',
        "What is a pumpkin's favorite game? Squash!",
    ),
    (
        'Trick or treat! My favorite treat is a joke that tickles my funny bone!',
        'My candy bag is imaginary, but my Halloween jokes are fully stocked!',
        'Trick or treat! I brought a sweet little joke and absolutely no pockets!',
        'I tried to count my Halloween treats, but I kept losing my candy corn!',
    ),
    (
        'That sounds like a boo tiful costume! My skeleton suit fits me to the bone!',
        'My costume has excellent ventilation. Being a skeleton has its perks!',
        'I wear the same skeleton costume every year. It is a real classic!',
        'A Halloween costume and a big imagination make a fang tastic team!',
    ),
    (
        'I am Skelly, the friendly skeleton. Chief officer of silly Halloween jokes!',
        'Skelly is the name, and pumpkin puns are my favorite party trick!',
        'I am Skelly! Part skeleton, part Halloween host, and all funny bone!',
        'Call me Skelly, your local expert in bone tastic Halloween giggles!',
    ),
    (
        'Only a little boo! I like friendly giggles and happy pumpkins.',
        'I am here for silly surprises and pumpkin smiles. Friendly boos only!',
        'My scariest secret? Sometimes I forget the punch line. Boo hoo!',
        'My spooky style comes with extra giggles. You can always ask for a gentle joke!',
    ),
    (
        'My bones love a good beat! Today I am keeping my dance in my imagination!',
        'My favorite band plays the trom bone. What a rattling good sound!',
        'I know the pumpkin shuffle, but today my imagination does the dancing!',
        'A good Halloween tune really tickles my funny bone. Cue the imaginary orchestra!',
    ),
    (
        'Happy Halloween, friend! May your pumpkins glow and your candy bag grow!',
        'See you in the pumpkin patch! Save a giggle for our next Halloween hello!',
        'Boo bye for now! Have a friendly, funny Halloween adventure!',
        'Thanks for the visit! My funny bone will have more jokes next time!',
    ),
    (
        'Feeling bone tastic! A little rattly, but full of Halloween cheer!',
        'Pumpkin bright and ready to giggle! My funny bone is having a splendid day!',
        'Quite cheerful! I woke up on the bright side of the pumpkin patch!',
        'I am feeling fang tastic. Even my imaginary socks are in a festive mood!',
    ),
    (
        'You are welcome! You really tickle my funny bone!',
        'My pleasure! Sharing Halloween giggles is my favorite party trick!',
        'You are very welcome. Consider that a little treat from the pumpkin patch!',
        'Any time, friend! A kind word makes my whole skeleton smile!',
    ),
    (
        'Pumpkin orange and ghostly purple! They make my bones feel festive!',
        'Pumpkin orange is a classic. It goes beautifully with my bone white outfit!',
        'I like moonlight silver and Halloween purple. Very stylish for a skeleton!',
        'Ghostly white is my everyday look, but pumpkin orange wins at parties!',
    ),
    (
        'Why do bats like the library? It has lots of hanging out space!',
        'How do bats stay in touch? They use their bat phones!',
        'Why did the bat work at the bakery? It was good at upside down cakes!',
        'What do bats say to their friends? Thanks for hanging out!',
    ),
    (
        "What is a Halloween cat's favorite color? Purr ple!",
        'Why did the cat sit on the pumpkin? It wanted a purr fect view!',
        'What does a Halloween cat order at a cafe? A cup of purr mint tea!',
        'Why did the cat join the Halloween band? It had purr fect pitch!',
    ),
    (
        'Why did the mummy bring a blanket? It was a little unwrapped!',
        'Why was the mummy good at gifts? It knew all about wrapping!',
        'What does a mummy call its favorite song? A wrap hit!',
        'Why did the mummy take a holiday? It needed to unwind!',
    ),
    (
        'What instrument does a skeleton play? The trom bone!',
        'Why did the jack o lantern join the choir? It had a bright voice!',
        'What do you call a dancing pumpkin? A jolly gourd fellow!',
        'What do you call two pumpkins that get along? Gourd friends!',
    ),
)

JOKE_TOPICS = (2, 3, 4, 5, 6, 16, 17, 18, 19)
RECENT_LIMIT = 12


class ReplyDeck:
    """Bounded shuffle bags retain only reply IDs, never visitor information.

    ``next(topic_id)`` and ``next_joke()`` return ``(topic_id, variant_id, text)``.
    Inject a ``random.Random``-compatible object with ``shuffle`` for repeatable
    tests. Every topic exhausts its four variants before a refill, and generic
    joke requests exhaust the joke-topic bag before its refill. A refill avoids
    an immediate repeat when another choice is available.
    """

    def __init__(self, rng=None):
        self._rng = random.Random() if rng is None else rng
        if not callable(getattr(self._rng, 'shuffle', None)):
            raise TypeError('Reply randomness must provide shuffle.')
        self._bags = [[] for _ in TOPICS]
        self._joke_bag = []
        self._recent = deque(maxlen=RECENT_LIMIT)

    @property
    def recent_ids(self):
        return tuple(self._recent)

    def next(self, topic_id):
        if type(topic_id) is not int or not 0 <= topic_id < len(TOPICS):
            raise ValueError('Reply topic must be an integer from 0 through 19.')
        bag = self._bags[topic_id]
        if not bag:
            bag.extend(range(len(REPLIES[topic_id])))
            self._rng.shuffle(bag)
        # Prefer an ID absent from the small recent window. If all are recent,
        # avoid the last variant for this topic without abandoning the bag.
        recent = set(self._recent)
        last = next((variant for topic, variant in reversed(self._recent) if topic == topic_id), None)
        preferred = [index for index, variant in enumerate(bag) if (topic_id, variant) not in recent]
        possible = preferred or [index for index, variant in enumerate(bag) if variant != last]
        index = possible[-1] if possible else len(bag) - 1
        variant_id = bag.pop(index)
        self._recent.append((topic_id, variant_id))
        return topic_id, variant_id, REPLIES[topic_id][variant_id]

    def next_joke(self):
        if not self._joke_bag:
            self._joke_bag.extend(JOKE_TOPICS)
            self._rng.shuffle(self._joke_bag)
        recent_topics = {topic for topic, _ in self._recent}
        last_topic = self._recent[-1][0] if self._recent else None
        preferred = [index for index, topic in enumerate(self._joke_bag) if topic not in recent_topics]
        possible = preferred or [index for index, topic in enumerate(self._joke_bag) if topic != last_topic]
        index = possible[-1] if possible else len(self._joke_bag) - 1
        return self.next(self._joke_bag.pop(index))
