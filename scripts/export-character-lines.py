"""Write docs/skelly-live-character-lines.md from character_lines.py.

Usage: python scripts/export-character-lines.py [--check]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'experiments/pocket-conversation')]
import character_lines as c  # noqa: E402

OUT = ROOT / 'docs/skelly-live-character-lines.md'
NAMES = {'mischief': 'Mischievous Skeleton', 'guardian': 'Haunted Guardian', 'storyteller': 'Creepy Storyteller'}
TOPICS = {c.GREETING: 'Hello', c.WHO: 'Who are you?', c.SCARY: 'Are you scary?', c.HOW: 'How are you?',
          c.THANKS: 'Thank you', c.CANDY: 'Candy / trick or treat', c.GOODBYE: 'Goodbye',
          c.UNCLEAR: "Didn't understand"}


def render():
    out = ['# Skelly Live character lines (review sheet)', '',
           'Generated from `experiments/pocket-conversation/character_lines.py` by',
           '`python scripts/export-character-lines.py`. Do not edit by hand.', '',
           'Skelly speaks a character\'s lines in Family mode **only after** that character is',
           'added to `APPROVED` in the source file. Until then it uses the shared reviewed',
           'catalog. Friendly Trick-or-Treater keeps the shared catalog, and jokes stay shared',
           'for every character.', '',
           'Approved now: ' + (', '.join(NAMES[p] for p in sorted(c.APPROVED)) or '**none**') + '.', '']
    for profile, title in NAMES.items():
        out += ['## ' + title + (' (approved)' if profile in c.APPROVED else ' (draft)'), '']
        for topic, label in TOPICS.items():
            out.append('**' + label + '**')
            out.append('')
            out += ['- ' + line for line in c.LINES[profile][topic]]
            out.append('')
    return '\n'.join(out).rstrip() + '\n'


if __name__ == '__main__':
    text = render()
    if '--check' in sys.argv[1:]:
        if not OUT.is_file() or OUT.read_text(encoding='utf-8') != text:
            raise SystemExit('docs/skelly-live-character-lines.md is stale. Run python scripts/export-character-lines.py')
        print('Character line review sheet is current.')
    else:
        OUT.write_text(text, encoding='utf-8')
        print('Wrote ' + str(OUT.relative_to(ROOT)))
