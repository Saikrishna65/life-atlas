#!/usr/bin/env python3
"""Exercise the real Atlas CLI with user-supplied GGUFs. No synthetic model responses."""
import argparse
import hashlib
import json
import os
import platform
import queue
import signal
import subprocess
import threading
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cli', required=True)
    parser.add_argument('--model', required=True, action='append', type=Path,
                        help='Repeat with a second different GGUF for sequential switching')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--timeout', type=int, default=600)
    args = parser.parse_args()
    report = {'runtime': 'llama.cpp:a6ac41c757c066941766164439f6876f2deaab04',
              'scope': 'host CPU; not phone performance', 'platform': platform.platform(),
              'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'models': [], 'completed': False}
    config = {'threads': 2, 'context': 1024, 'maxTokens': 64, 'temperature': 0.0, 'seed': 42}
    report['options'] = config
    process = None
    try:
        # Check existence before starting a native process.
        for path in args.model:
            digest = hashlib.sha256()
            with path.open('rb') as source:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(block)
            report['models'].append({'path': path.name, 'sha256': digest.hexdigest(), 'checks': []})
        process = subprocess.Popen([args.cli], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   text=True, encoding='utf-8', bufsize=1)
        events = queue.Queue()
        def read():
            for line in process.stdout:
                try:
                    events.put(json.loads(line))
                except ValueError:
                    events.put({'event': 'error', 'error': 'Invalid CLI protocol'})
            events.put({'event': 'error', 'error': 'CLI process exited'})
        threading.Thread(target=read, daemon=True).start()
        def request(payload, cancel=False):
            started = time.monotonic()
            process.stdin.write(json.dumps(payload) + '\n')
            process.stdin.flush()
            pieces = []
            canceled = False
            while True:
                remaining = args.timeout - (time.monotonic() - started)
                if remaining <= 0:
                    raise TimeoutError('Native operation timed out')
                event = events.get(timeout=remaining)
                if event['event'] == 'error':
                    raise RuntimeError(event['error'])
                if event['event'] == 'token':
                    pieces.append(event['token'])
                    if cancel and not canceled:
                        process.send_signal(signal.SIGINT)
                        canceled = True
                if event['event'] in ('loaded', 'done', 'reset', 'unloaded'):
                    return {'result': event.get('result'), 'streamPieces': len(pieces),
                            'streamText': ''.join(pieces), 'wallMs': (time.monotonic() - started) * 1000}
        for index, path in enumerate(args.model):
            item = report['models'][index]
            item['load'] = request({'op': 'load', 'path': str(path.resolve()), 'options': config})
            messages = [{'role': 'system', 'content': 'You are Atlas. Answer briefly.'},
                        {'role': 'user', 'content': 'Say hello in one sentence.'}]
            first = request({'messages': messages, 'options': config})
            assert first['result']['text'].strip(), 'No generated text'
            assert first['streamPieces'] > 0, 'No streamed text'
            assert first['streamText'] == first['result']['text'], 'Streaming/result mismatch'
            item['first'] = first
            messages += [{'role': 'assistant', 'content': first['result']['text']},
                         {'role': 'user', 'content': 'What did I ask you to say?'}]
            item['multiturn'] = request({'messages': messages, 'options': config})
            item['checks'] += ['load', 'actual-generation', 'streaming', 'multiturn-request']
            request({'op': 'reset'})
            item['checks'].append('context-reset')
            structured = request({'structured': True, 'options': config, 'messages': [
                {'role': 'system', 'content': 'Return only JSON with reply string and action null. No tools exist.'},
                {'role': 'user', 'content': 'Say hello.'}]})
            envelope = json.loads(structured['result']['text'])
            assert isinstance(envelope.get('reply'), str) and envelope.get('action') is None
            item['structured'] = structured
            item['checks'].append('structured-json')
            if os.name != 'nt':
                item['cancellation'] = request({'options': {**config, 'maxTokens': 512},
                    'messages': [{'role': 'user', 'content': 'Count slowly from 1 to 500, one number per line.'}]}, cancel=True)
                assert item['cancellation']['result']['canceled'], 'Cancellation not observed'
                item['checks'].append('mid-generation-cancel')
            else:
                item['cancelStatus'] = 'Use Android instrumentation; Windows console signals not validated'
            request({'op': 'unload'})
            item['checks'].append('unload')
        report['sequentialSwitching'] = 'exercised' if len(args.model) > 1 else 'needs a second distinct model'
        report['completed'] = True
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        if process:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
