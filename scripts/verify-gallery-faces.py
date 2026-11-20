"""Public, pinned face models: tensor contracts and inference on the project's licensed demo.
No user photos, names, credentials, uploads or APK assembly.
"""
import hashlib
import pathlib
import tempfile
import time
import urllib.request
import numpy as np
import onnxruntime as ort
from PIL import Image
from io import BytesIO

REV = "48b10fa505aeb51fbd127fc60a5c660040e823b7"
MODELS = [
 ("face_detection_yunet/face_detection_yunet_2023mar.onnx",232589,"8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
 ("face_recognition_sface/face_recognition_sface_2021dec_int8.onnx",9896933,"2b0e941e6f16cc048c20aee0c8e31f569118f65d702914540f7bfdc14048d78a"),
]
root=pathlib.Path(tempfile.gettempdir())/"atlas-face-validation"
root.mkdir(exist_ok=True)
options=ort.SessionOptions(); options.intra_op_num_threads=2;options.inter_op_num_threads=1
sessions=[]
for path,size,sha in MODELS:
 file=root/path.split('/')[-1]
 if not file.exists():
  with urllib.request.urlopen(f"https://github.com/opencv/opencv_zoo/raw/{REV}/models/{path}",timeout=90) as src, file.open('wb') as out:
   while block:=src.read(65536):out.write(block)
 assert file.stat().st_size==size
 with file.open('rb') as f: assert hashlib.file_digest(f,'sha256').hexdigest()==sha
 s=ort.InferenceSession(str(file),sess_options=options,providers=['CPUExecutionProvider'])
 print(path,[(i.name,i.shape,i.type) for i in s.get_inputs()],[(o.name,o.shape) for o in s.get_outputs()])
 sessions.append(s)
# Exercise detector on a real upstream demo, without identifying anyone.
url=f"https://raw.githubusercontent.com/opencv/opencv_zoo/{REV}/models/face_recognition_sface/example_outputs/demo.jpg"
image=Image.open(BytesIO(urllib.request.urlopen(url).read())).convert('RGB')
image.thumbnail((640,640))
canvas=np.zeros((640,640,3),dtype=np.float32);canvas[:image.height,:image.width]=np.asarray(image)[:,:,::-1]
x=canvas.transpose(2,0,1)[None].copy()
start=time.perf_counter(); detector,recognizer=sessions
out=dict(zip([o.name for o in detector.get_outputs()],detector.run(None,{detector.get_inputs()[0].name:x})))
assert all(np.isfinite(v).all() for v in out.values())
found=[]
for stride in [8,16,32]:
 scores=np.sqrt(np.clip(out[f'cls_{stride}'][0,:,0],0,1)*np.clip(out[f'obj_{stride}'][0,:,0],0,1))
 for i in np.where(scores>=.9)[0]:
  col=i%(640//stride);row=i//(640//stride)
  landmarks=out[f'kps_{stride}'][0,i].reshape(5,2)*stride+np.array([col,row])*stride
  found.append((float(scores[i]),landmarks))
assert found,"Detector must find a face in the official demo"
# Five-point least-squares similarity transform (same construction used in Android).
points=max(found,key=lambda v:v[0])[1]
target=np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]])
a0=points-points.mean(0);b0=target-target.mean(0);den=(a0*a0).sum()
a=(a0*b0).sum()/den;b=(a0[:,0]*b0[:,1]-a0[:,1]*b0[:,0]).sum()/den
matrix=np.array([[a,-b],[b,a]]);translation=target.mean(0)-matrix@points.mean(0)
inverse=np.linalg.inv(matrix);offset=-inverse@translation
aligned=Image.fromarray(canvas[:,:,::-1].astype(np.uint8)).transform((112,112),Image.Transform.AFFINE,tuple(np.column_stack((inverse,offset)).reshape(-1)),resample=Image.Resampling.BILINEAR)
rgb=np.asarray(aligned,dtype=np.float32).transpose(2,0,1)[None].copy()
features=recognizer.run(None,{recognizer.get_inputs()[0].name:rgb})[0]
assert features.shape==(1,128) and np.isfinite(features).all() and np.linalg.norm(features)>0
v=features/np.linalg.norm(features);assert abs(float((v*v).sum())-1)<1e-5
print(f"PASS: pinned model checksums; real YuNet detection and aligned 128-D SFace inference; {time.perf_counter()-start:.3f}s on CI CPU, not a phone benchmark.")
