"""Stage and approve exact local WAVs after complete human listening review."""
import argparse
import html
import json
from pathlib import Path

from recordings import Library, catalog_text, digest
from voice import MAX_REPLY_WAV, validate_reply_wave

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LIBRARY = ROOT / '.skelly-build' / 'reviewed-voice'
# A deliberately varied starter set; every ID in the catalog may be added.
STARTER = ((1, 0), (1, 1), (2, 0), (2, 1), (3, 0), (3, 1), (4, 0), (5, 0),
           (6, 0), (7, 0), (8, 0), (9, 0), (10, 0), (11, 0), (16, 0), (19, 0))


def stage(library, topic, variant, source, voice, delivery):
    text = catalog_text(topic, variant)
    source = Path(source)
    if source.stat().st_size > MAX_REPLY_WAV:
        raise ValueError('Candidate exceeds the audio limit.')
    data = source.read_bytes()
    validate_reply_wave(data)
    if not voice.strip() or len(voice) > 80 or not delivery.strip() or len(delivery) > 120:
        raise ValueError('Provide a short voice name and delivery description.')
    entries = library.entries()
    entries = [e for e in entries if not (e.get('topic') == topic and e.get('variant') == variant)]
    library.directory.mkdir(parents=True, exist_ok=True)
    name = f'{topic}-{variant}.wav'
    (library.directory / name).write_bytes(data)
    entry = {'topic': topic, 'variant': variant, 'text': text, 'text_sha256': digest(text.encode('utf-8')),
             'file': name, 'audio_sha256': digest(data), 'review_status': 'unreviewed',
             'voice': voice, 'delivery': delivery}
    entries.append(entry)
    library.save(entries)
    return entry


def approve(library, topic, variant, audio_hash):
    entries = library.entries()
    matches = [e for e in entries if e.get('topic') == topic and e.get('variant') == variant]
    if len(matches) != 1 or matches[0].get('review_status') != 'unreviewed':
        raise ValueError('Exactly one unreviewed candidate is required.')
    entry = matches[0]
    if entry.get('audio_sha256') != audio_hash:
        raise ValueError('The supplied listening-review hash does not match the candidate.')
    entry['review_status'] = 'approved'
    # Validate every binding before saving approval, including a fresh disk read.
    class Pending(Library):
        def entries(self): return entries
    if Pending(library.directory).lookup(topic, variant, catalog_text(topic, variant)) is None:
        raise ValueError('Candidate changed or is incompatible; stage and listen again.')
    library.save(entries)


def review_page(library):
    """Write a local, playback-only comparison page; it never grants approval."""
    rows = []
    for entry in library.entries():
        if not isinstance(entry, dict):
            raise ValueError('Invalid candidate entry.')
        topic, variant = entry.get('topic'), entry.get('variant')
        expected = catalog_text(topic, variant)
        if entry.get('text') != expected or entry.get('file') != f'{topic}-{variant}.wav':
            raise ValueError('Candidate identity or text has changed; restage it.')
        path = library.directory / entry['file']
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_REPLY_WAV:
            raise ValueError('A candidate file is missing or incompatible.')
        data = path.read_bytes(); validate_reply_wave(data)
        if entry.get('audio_sha256') != digest(data) or entry.get('text_sha256') != digest(expected.encode('utf-8')):
            raise ValueError('A candidate has changed; restage it before listening.')
        esc = lambda value: html.escape(str(value), quote=True)
        rows.append(f'<section><h2>Reply {topic} / {variant} · {esc(entry.get("voice", ""))}</h2>'
                    f'<p>{esc(entry.get("delivery", ""))} · {esc(entry.get("review_status", ""))}</p>'
                    f'<audio controls preload="none" src="{topic}-{variant}.wav"></audio>'
                    f'<p>Expected: {esc(expected)}</p><p>SHA-256: <code>{esc(entry["audio_sha256"])}</code></p></section>')
    page = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            '<title>Skelly candidate review</title><style>body{font:18px system-ui;background:#181323;color:#fff;'
            'max-width:55rem;margin:auto;padding:1.5rem}section{margin:2rem 0}audio{display:block;width:min(100%,34rem)}'
            'code{overflow-wrap:anywhere}</style><h1>Listen to every complete performance</h1>'
            '<p>Start at low volume. Check every spoken word, beginning and ending, character, and timing against '
            'the expected text. This page does not approve recordings. Regenerate it after changing the library.</p>'
            + ''.join(rows) + '</html>')
    library.directory.mkdir(parents=True, exist_ok=True)
    output = library.directory / 'review.html'
    output.write_text(page, encoding='utf-8')
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', type=Path, default=DEFAULT_LIBRARY)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('starter')
    add = sub.add_parser('stage')
    add.add_argument('topic', type=int); add.add_argument('variant', type=int); add.add_argument('wave', type=Path)
    add.add_argument('--voice', required=True); add.add_argument('--delivery', required=True)
    ok = sub.add_parser('approve')
    ok.add_argument('topic', type=int); ok.add_argument('variant', type=int); ok.add_argument('audio_sha256')
    sub.add_parser('list')
    sub.add_parser('review-page')
    args = parser.parse_args()
    library = Library(args.library)
    if args.command == 'starter':
        print(json.dumps([{'topic': t, 'variant': v, 'text': catalog_text(t, v)} for t, v in STARTER], indent=2))
    elif args.command == 'stage':
        print(json.dumps(stage(library, args.topic, args.variant, args.wave, args.voice, args.delivery), indent=2))
    elif args.command == 'approve':
        approve(library, args.topic, args.variant, args.audio_sha256)
        print('Approved exact candidate. Listen again and restage if it changes.')
    elif args.command == 'review-page':
        print('Open this local page to listen: ' + str(review_page(library)))
    else:
        print(json.dumps(library.entries(), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
