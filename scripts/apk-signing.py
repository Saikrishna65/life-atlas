#!/usr/bin/env python3
"""Prepare/finalize APK v2 signing without sending the signing key to CI.

CI emits public signed-data bytes. The key stays in the owner's workspace;
only its detached signature returns to CI. apksigner verifies the result.
"""
import argparse, base64, hashlib, json, struct, subprocess, tempfile
from zipfile import ZipFile
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

def attr(name, value):
    remaining=(name+': '+value).encode('utf-8'); lines=[]
    while len(remaining)>72:
        lines.append(remaining[:72]);remaining=b' '+remaining[72:]
    return b'\r\n'.join(lines+[remaining])+b'\r\n'

def signature_entry(name):
    upper=name.upper()
    return upper.startswith('META-INF/') and (upper.endswith(('.RSA','.DSA','.EC','.SF')) or upper=='META-INF/MANIFEST.MF')

def prepare_v1(apk, certificate, manifest_path, sf_path):
    manifest=attr('Manifest-Version','1.0')+attr('Created-By','Atlas Finance')+b'\r\n'; manifest_main=manifest
    records=[]
    with ZipFile(apk) as archive:
        for item in archive.infolist():
            if item.is_dir() or signature_entry(item.filename): continue
            section=attr('Name',item.filename)+attr('SHA-256-Digest',base64.b64encode(hashlib.sha256(archive.read(item.filename)).digest()).decode())+b'\r\n'
            manifest+=section;records.append((item.filename,section))
    sf=attr('Signature-Version','1.0')+attr('Created-By','Atlas Finance')+attr('SHA-256-Digest-Manifest',base64.b64encode(hashlib.sha256(manifest).digest()).decode())+attr('SHA-256-Digest-Manifest-Main-Attributes',base64.b64encode(hashlib.sha256(manifest_main).digest()).decode())+attr('X-Android-APK-Signed','2')+b'\r\n'
    for name,section in records: sf+=attr('Name',name)+attr('SHA-256-Digest',base64.b64encode(hashlib.sha256(section).digest()).decode())+b'\r\n'
    Path(manifest_path).write_bytes(manifest);Path(sf_path).write_bytes(sf)
    cert=subprocess.check_output(['openssl','x509','-in',certificate,'-outform','DER'])
    return {'mode':'v1','apk_sha256':hashlib.sha256(Path(apk).read_bytes()).hexdigest(),'signed_digest':base64.b64encode(hashlib.sha256(sf).digest()).decode(),'certificate_sha256':hashlib.sha256(cert).hexdigest()}

def der(tag,payload):
    length=len(payload); size=bytes([length]) if length<128 else bytes([128+(length.bit_length()+7)//8])+length.to_bytes((length.bit_length()+7)//8,'big')
    return bytes([tag])+size+payload

def read_der(data,position=0):
    start=position;tag=data[position];position+=1;length=data[position];position+=1
    if length&128:
        size=length&127;length=int.from_bytes(data[position:position+size],'big');position+=size
    end=position+length
    return tag,data[position:end],data[start:end],end

def sign_v1(request,certificate,key):
    cert=subprocess.check_output(['openssl','x509','-in',certificate,'-outform','DER'])
    if hashlib.sha256(cert).hexdigest()!=request['certificate_sha256']: raise ValueError('Signing identity changed')
    digest_bytes=base64.b64decode(request['signed_digest'])
    if len(digest_bytes)!=32: raise ValueError('Invalid signing digest')
    rsa=subprocess.run(['openssl','pkeyutl','-sign','-inkey',key,'-pkeyopt','digest:sha256'],input=digest_bytes,check=True,capture_output=True).stdout
    certificate_body=read_der(cert)[1]; tbs=read_der(certificate_body)[1];children=[];position=0
    while position<len(tbs):
        item=read_der(tbs,position);children.append(item);position=item[3]
    first=1 if children[0][0]==0xa0 else 0
    serial=children[first][2];issuer=children[first+2][2]
    sha=bytes.fromhex('300d06096086480165030402010500');rsa_algorithm=bytes.fromhex('300d06092a864886f70d0101010500')
    version=bytes.fromhex('020101');data_oid=bytes.fromhex('06092a864886f70d010701');signed_oid=bytes.fromhex('06092a864886f70d010702')
    signer=der(0x30,version+der(0x30,issuer+serial)+sha+rsa_algorithm+der(4,rsa))
    signed_data=der(0x30,version+der(0x31,sha)+der(0x30,data_oid)+der(0xa0,cert)+der(0x31,signer))
    return base64.b64encode(der(0x30,signed_oid+der(0xa0,signed_data))).decode()

def attach_v1(apk,request,signature,manifest_path,sf_path,output):
    if hashlib.sha256(Path(apk).read_bytes()).hexdigest()!=request['apk_sha256']: raise ValueError('APK changed after signing request')
    sf=Path(sf_path).read_bytes()
    if hashlib.sha256(sf).digest()!=base64.b64decode(request['signed_digest']): raise ValueError('JAR signature file changed')
    rsa=base64.b64decode(signature)
    with tempfile.TemporaryDirectory() as temp:
        signature_path=Path(temp)/'ATLAS.RSA';signature_path.write_bytes(rsa)
        subprocess.run(['openssl','cms','-verify','-binary','-inform','DER','-in',str(signature_path),'-content',sf_path,'-noverify','-out','/dev/null'],check=True)
    with ZipFile(apk) as source,ZipFile(output,'w') as target:
        for item in source.infolist():
            if not signature_entry(item.filename): target.writestr(item,source.read(item.filename))
        target.writestr('META-INF/MANIFEST.MF',Path(manifest_path).read_bytes())
        target.writestr('META-INF/ATLAS.SF',sf)
        target.writestr('META-INF/ATLAS.RSA',rsa)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','finalize','prepare-v1','sign-v1','attach-v1']);parser.add_argument('--apk');parser.add_argument('--certificate');parser.add_argument('--key');parser.add_argument('--manifest');parser.add_argument('--sf');parser.add_argument('--request',required=True);parser.add_argument('--signature');parser.add_argument('--output');args=parser.parse_args()
    if args.mode=='prepare':
        request=prepare(args.apk,args.certificate);request['mode']='v2';Path(args.request).write_text(json.dumps(request))
    elif args.mode=='prepare-v1': Path(args.request).write_text(json.dumps(prepare_v1(args.apk,args.certificate,args.manifest,args.sf)))
    elif args.mode=='sign-v1': Path(args.output).write_text(json.dumps({'mode':'v1','signature':sign_v1(json.loads(Path(args.request).read_text()),args.certificate,args.key)}))
    elif args.mode=='attach-v1': attach_v1(args.apk,json.loads(Path(args.request).read_text()),json.loads(Path(args.signature).read_text())['signature'],args.manifest,args.sf,args.output)
    else: finalize(args.apk,json.loads(Path(args.request).read_text()),json.loads(Path(args.signature).read_text())['signature'],args.output)
