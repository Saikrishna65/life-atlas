#!/usr/bin/env python3
"""Prepare/finalize APK v2 signing without sending the signing key to CI.

CI emits public signed-data bytes. The key stays in the owner's workspace;
only its detached signature returns to CI. apksigner verifies the result.
"""
import argparse, base64, hashlib, json, struct, subprocess
from pathlib import Path

def lp(value): return struct.pack('<I',len(value))+value

def sections(data):
    end=data.rfind(b'PK\x05\x06')
    if end < 0 or end+22+struct.unpack_from('<H',data,end+20)[0] != len(data): raise ValueError('Invalid APK ZIP end record')
    offset=struct.unpack_from('<I',data,end+16)[0]
    if offset >= end: raise ValueError('Invalid central directory')
    return data[:offset],data[offset:end],data[end:]

def digest(data):
    hashes=[]
    for section in sections(data):
        for start in range(0,len(section),1024*1024):
            chunk=section[start:start+1024*1024]
            hashes.append(hashlib.sha256(b'\xa5'+struct.pack('<I',len(chunk))+chunk).digest())
    return hashlib.sha256(b'\x5a'+struct.pack('<I',len(hashes))+b''.join(hashes)).digest()

def prepare(apk,certificate):
    data=Path(apk).read_bytes()
    cert=subprocess.check_output(['openssl','x509','-in',certificate,'-outform','DER'])
    public=subprocess.check_output(['openssl','x509','-in',certificate,'-pubkey','-noout'])
    publicder=subprocess.run(['openssl','pkey','-pubin','-outform','DER'],input=public,capture_output=True,check=True).stdout
    signed=lp(lp(struct.pack('<I',0x0103)+lp(digest(data))))+lp(lp(cert))+lp(b'')
    return {'apk_sha256':hashlib.sha256(data).hexdigest(),'signed_data':base64.b64encode(signed).decode(),'public_key':base64.b64encode(publicder).decode(),'certificate_sha256':hashlib.sha256(cert).hexdigest()}

def finalize(apk,request,signature,output):
    data=Path(apk).read_bytes()
    if hashlib.sha256(data).hexdigest()!=request['apk_sha256']: raise ValueError('APK changed after signing request')
    signed=base64.b64decode(request['signed_data']);public=base64.b64decode(request['public_key']);sig=base64.b64decode(signature)
    # Verify the detached signature before assembling the APK signing block.
    scratch=Path(output).parent;scratch.mkdir(parents=True,exist_ok=True)
    key=scratch/'verify-public.der';payload=scratch/'verify-signed-data.bin';sigfile=scratch/'verify-signature.bin'
    key.write_bytes(public);payload.write_bytes(signed);sigfile.write_bytes(sig)
    try:
        subprocess.run(['openssl','dgst','-sha256','-keyform','DER','-verify',str(key),'-signature',str(sigfile),str(payload)],check=True)
    finally:
        key.unlink(missing_ok=True);payload.unlink(missing_ok=True);sigfile.unlink(missing_ok=True)
    signatures=lp(lp(struct.pack('<I',0x0103)+lp(sig)))
    signer=lp(signed)+signatures+lp(public)
    value=lp(lp(signer))
    pair=struct.pack('<Q',len(value)+4)+struct.pack('<I',0x7109871a)+value
    size=struct.pack('<Q',len(pair)+24)
    block=size+pair+size+b'APK Sig Block 42'
    before,central,end=sections(data)
    end=bytearray(end);struct.pack_into('<I',end,16,len(before)+len(block))
    Path(output).write_bytes(before+block+central+end)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','finalize']);parser.add_argument('--apk',required=True);parser.add_argument('--certificate');parser.add_argument('--request',required=True);parser.add_argument('--signature');parser.add_argument('--output');args=parser.parse_args()
    if args.mode=='prepare': Path(args.request).write_text(json.dumps(prepare(args.apk,args.certificate)))
    else: finalize(args.apk,json.loads(Path(args.request).read_text()),json.loads(Path(args.signature).read_text())['signature'],args.output)
