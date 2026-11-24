#!/usr/bin/env python3
"""Real JSONL CLI measurements. No synthetic timings or model downloads. Python standard library only."""
import argparse, hashlib, json, os, platform, subprocess, sys, time

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--cli',required=True);p.add_argument('--model',required=True);p.add_argument('--cases',required=True)
    p.add_argument('--output',required=True);p.add_argument('--threads',type=int,default=4);p.add_argument('--context',type=int,default=2048)
    p.add_argument('--tokens',type=int,default=128);p.add_argument('--repetitions',type=int,default=2);p.add_argument('--quick',action='store_true')
    args=p.parse_args()
    if not 1<=args.repetitions<=5: p.error('Choose 1–5 repetitions')
    digest=hashlib.sha256()
    with open(args.model,'rb') as model:
        for block in iter(lambda:model.read(1024*1024),b''):digest.update(block)
    with open(args.cases,encoding='utf-8') as source:cases=json.load(source)
    if args.quick:cases=cases[::10]
    config={'threads':args.threads,'context':args.context,'maxTokens':args.tokens,'thinking':False}
    report={'version':1,'scope':'desktop CPU; never equate these measurements with phone performance','runtime':'llama.cpp:a6ac41c757c066941766164439f6876f2deaab04','platform':platform.platform(),'architecture':platform.machine(),'cpuCount':os.cpu_count(),'modelSha256':digest.hexdigest(),'options':config,'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'rows':[],'completed':False}
    process=subprocess.Popen([args.cli],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,encoding='utf-8',bufsize=1)
    def request(value):
        if process.poll() is not None:raise RuntimeError('Native process exited')
        process.stdin.write(json.dumps(value,ensure_ascii=False)+'\n');process.stdin.flush()
        while True:
            line=process.stdout.readline()
            if not line:raise RuntimeError('Native process exited before completion')
            event=json.loads(line)
            if event.get('event')=='error':raise RuntimeError(event['error'])
            if event.get('event') in ('loaded','done','unloaded'):return event.get('result')
    try:
        report['initialization']=request({'op':'load','path':os.path.abspath(args.model),'options':config})
        # Real warm-up excluded from quality rows.
        report['warmup']=request({'messages':[{'role':'user','content':'Reply briefly: hello.'}],'options':config})['metrics']
        for case in cases:
            for repetition in range(args.repetitions):
                messages=[{'role':'system','content':'You are Atlas. Reply concisely and honestly. No real private data or tools are available.'}]+case.get('history',[])+[{'role':'user','content':case['prompt']}]
                if case.get('structured'):
                    messages[0]['content']='Return exactly {"reply":"short response","action":null or supported action object}. Available synthetic kinds: music.pause, music.resume, music.next, music.previous, trips.list, trips.search(query), music.search(query), reminder.list, navigate(section), finance.summary. Do not execute anything.'
                started=time.monotonic()
                row={'caseId':case['id'],'category':case['category'],'repetition':repetition,'result':request({'messages':messages,'options':config,'structured':case.get('structured',False)}),'wallMs':(time.monotonic()-started)*1000}
                report['rows'].append(row)
                print(f"{case['id']} / {repetition+1}: {row['result']['metrics']['tokensPerSecond']:.2f} tok/s",flush=True)
                with open(args.output,'w',encoding='utf-8') as out:json.dump(report,out,ensure_ascii=False,indent=2)
        report['completed']=True
    finally:
        process.terminate()
        try:process.wait(timeout=5)
        except subprocess.TimeoutExpired:process.kill();process.wait()
        with open(args.output,'w',encoding='utf-8') as out:json.dump(report,out,ensure_ascii=False,indent=2)
    return 0
if __name__=='__main__':sys.exit(main())
