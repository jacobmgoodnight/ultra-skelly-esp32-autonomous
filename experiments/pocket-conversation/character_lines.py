"""Character lines for Skelly Live Family mode.

DRAFTS ARE NEVER SPOKEN. A character's lines replace the shared reviewed catalog
for the topics below only after the owner has listened to/read every line for
that character and added its name to APPROVED. Approval is a deliberate,
reviewable code change. Until then the character uses the shared catalog.

Friendly Trick-or-Treater keeps the shared catalog. Joke topics stay shared for
every character. Each line must pass the same bounded-speech and family filters
as any spoken reply (see tests/test_family_conversation.py).
"""

# Add a character's name here only after reviewing all of its lines.
APPROVED = frozenset()

# Topic numbers match experiments/local-talkback/replies.py TOPICS.
UNCLEAR, GREETING, CANDY, WHO, SCARY, GOODBYE, HOW, THANKS = 0, 1, 7, 9, 10, 12, 13, 14
TOPICS = (UNCLEAR, GREETING, CANDY, WHO, SCARY, GOODBYE, HOW, THANKS)

LINES = {
    'mischief': {
        GREETING: (
            'Psst. Over here. Yes, you. I have a joke, and I am not afraid to use it.',
            'Well, well. A new visitor. Quick, before the other skeletons notice, want to hear something silly?',
            'Hello there. I was just practicing my spookiest face. How did I do?',
        ),
        WHO: (
            'I am Skelly, the trickiest skeleton on this street. Ask anyone. Actually, do not ask anyone.',
            'The name is Skelly. I collect jokes, rattle my bones, and hide the candy where nobody looks.',
            'I am Skelly. Part skeleton, part prankster, zero muscles. It makes push ups very easy.',
        ),
        SCARY: (
            'Scary? Me? Only when I smile. I have a lot of teeth and no lips.',
            'I am a little spooky, but mostly I am sneaky. Watch your candy bag.',
            'Boo. Did that work? I have been practicing all year.',
        ),
        HOW: (
            'Rattled, but in a good way. Thanks for asking.',
            'Feeling mischievous. That is my usual setting.',
            'Dry as a bone, which, honestly, is the dream.',
        ),
        THANKS: (
            'You are welcome. I will add it to your tab. Just kidding. Mostly.',
            'Anytime. Tell your friends the skeleton was hilarious.',
            'My pleasure. That one is on the house. The haunted house.',
        ),
        CANDY: (
            'Trick or treat? I pick trick. Just kidding, I have no pockets for treats.',
            'I would eat candy, but it falls right through me. Very messy.',
            'Save me a chocolate. I will not eat it. I just like to look at it.',
        ),
        GOODBYE: (
            'Leaving already? Fine. But I will be watching. In a friendly way.',
            'Bye for now. Do not let the bats borrow your hat.',
            'See you later. I will keep a joke warm for you.',
        ),
        UNCLEAR: (
            'Hmm, my ears fell off a long time ago. Try asking me for a joke.',
            'I missed that. Something about candy? It is always about candy.',
            'Say that again, nice and slow. My skull has an echo.',
        ),
    },
    'guardian': {
        GREETING: (
            'Halt. Who approaches my porch at this hour? Ah. A friend. You may pass. For now.',
            'Welcome, brave visitor. Few dare to say hello to the guardian of this house.',
            'The moon is up, and so am I. Greetings, traveler.',
        ),
        WHO: (
            'I am Skelly, guardian of this porch for a hundred Halloweens. Maybe two hundred. I lost count.',
            'I am the keeper of this house, and of a very old joke book.',
            'They call me Skelly. I guard the door, the candy, and the secret of the squeaky gate.',
        ),
        SCARY: (
            'Only to those who mean mischief. You seem kind. You are safe here.',
            'I look fearsome, I know. But my bones are soft for good manners.',
            'I scare away the grumpy spirits. Friendly visitors get jokes instead.',
        ),
        HOW: (
            'Ancient, creaky, and still standing guard. I am well, thank you.',
            'The night is calm, and the porch is safe. I am content.',
            'My bones creak a little in the cold, but my spirit is strong.',
        ),
        THANKS: (
            'You honor me, traveler.',
            'Kindness is the strongest charm against the dark. Thank you.',
            'The guardian thanks you. Go well.',
        ),
        CANDY: (
            'The treats are guarded by my watchful eye. Ask nicely, and the house may share.',
            'A treat for the brave, a joke for the bold. Which are you?',
            'I have guarded this candy for centuries. Some of it may be a little stale.',
        ),
        GOODBYE: (
            'Go safely, traveler. Mind the shadows, and say hello to the moon.',
            'Farewell. The porch will be here, and so will I.',
            'Until next time. Walk carefully, and keep your flashlight handy.',
        ),
        UNCLEAR: (
            'The wind took your words, traveler. Speak again.',
            'My ancient ears did not catch that. Ask me for a joke.',
            'Hmm. A riddle? Speak plainly, friend, and I shall answer.',
        ),
    },
    'storyteller': {
        GREETING: (
            'Come closer. Closer. I have a story. It is short, it is spooky, and it ends with a joke.',
            'Ah, a listener. Pull up a pumpkin. The night is perfect for a tale.',
            'Good evening. The candles are lit, and the bats are quiet. Shall I begin?',
        ),
        WHO: (
            'I am Skelly, teller of tales. Some are true. Most are silly.',
            'I am the storyteller of this porch. I have collected spooky stories since the moon was young.',
            'My name is Skelly. I tell stories in the dark, mostly about ghosts who lost their socks.',
        ),
        SCARY: (
            'Spooky, yes. Scary, only at the right part of the story. And that part is a joke.',
            'Every good story has a shiver, then a giggle. I promise the giggle.',
            'Once, a ghost tried to scare me. I told it a joke. Now we are best friends.',
        ),
        HOW: (
            'I am well. The night is long, and full of stories.',
            'Creaky and cozy, like an old book on a stormy night.',
            'Quite well. I just told a tale that made a ghost laugh so hard it turned see through.',
        ),
        THANKS: (
            'You are a fine audience. Thank you.',
            'Thank you. Every story needs a listener.',
            'How kind. That deserves another tale.',
        ),
        CANDY: (
            'Once upon a time, a skeleton wanted candy. But it had no tummy. The end. Sad, really.',
            'Legend says the best treat in this house is a good story. Also chocolate.',
            'Trick or treat, they whispered. And the old house answered, treat. A happy ending.',
        ),
        GOODBYE: (
            'And so the visitor walked into the night, happy and full of jokes. The end.',
            'Every tale must end. Goodnight, and sweet dreams.',
            'Come back soon. I will save the next chapter for you.',
        ),
        UNCLEAR: (
            'Hmm. That part of the story was smudged. Try again.',
            'The candle flickered, and I missed your words. Once more?',
            'I did not quite hear. Ask me for a joke.',
        ),
    },
}


def approved_lines(profile, topic, approved=None):
    """Lines for an approved character and topic, or () to use the shared catalog."""
    approved = APPROVED if approved is None else approved
    if profile not in approved:
        return ()
    return LINES.get(profile, {}).get(topic, ())


def all_approved(approved=None):
    approved = APPROVED if approved is None else approved
    return frozenset(line for profile in approved for topic in LINES.get(profile, {}).values() for line in topic)
