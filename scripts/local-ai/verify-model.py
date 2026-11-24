#!/usr/bin/env python3
"""Verify an already obtained GGUF against the shipped catalogue; never downloads weights."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--id', required=True)
    parser.add_argument('--file', required=True, type=Path)
    args = parser.parse_args()
    catalogue = json.loads((Path(__file__).resolve().parents[2] / 'src/lib/atlas-ai/lab/verified-models.json').read_text())
    model = next((entry for entry in catalogue if entry['id'] == args.id), None)
    if model is None:
        parser.error('Unknown verified model ID')
    if args.file.stat().st_size != model['bytes']:
        parser.error(f"Size mismatch; expected {model['bytes']} bytes")
    digest = hashlib.sha256()
    with args.file.open('rb') as source:
        if source.read(4) != b'GGUF':
            parser.error('Not a GGUF file')
        source.seek(0)
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != model['sha256']:
        parser.error('SHA-256 mismatch; original file has not been modified')
    print(json.dumps({'verified': True, 'model': model['id'], 'sha256': digest.hexdigest(),
                      'bytes': model['bytes'], 'inferenceTested': False}, indent=2))


if __name__ == '__main__':
    main()
