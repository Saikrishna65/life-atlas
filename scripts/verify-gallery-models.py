"""Real model ABI smoke check. Downloads public model weights, uses a synthetic image only.

No phone media, cloud configuration, R2 credentials or APK build is involved.
Run with onnxruntime==1.23.2, numpy==2.2.6, Pillow==12.0.0.
"""
import hashlib
import os
import pathlib
import tempfile
import time
import urllib.request

import numpy as np
import onnxruntime as ort

REVISION = "6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d"
FILES = [
    ("vision_model_quantized.onnx", 89117001, "583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299"),
    ("text_model_quantized.onnx", 64504507, "73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a"),
]


def checked_download(root, name, size, checksum):
    target = root / name
    if target.exists() and target.stat().st_size == size and hashlib.file_digest(target.open("rb"), "sha256").hexdigest() == checksum:
        return str(target)
    request = urllib.request.Request(f"https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/{REVISION}/onnx/{name}")
    digest = hashlib.sha256()
    count = 0
    temporary = target.with_suffix(".part")
    with urllib.request.urlopen(request, timeout=60) as source, temporary.open("wb") as out:
        while block := source.read(65536):
            count += len(block)
            assert count <= size, "Model response larger than pinned size"
            digest.update(block)
            out.write(block)
    assert count == size and digest.hexdigest() == checksum, "Model checksum mismatch"
    os.replace(temporary, target)
    return str(target)


def unit(vector):
    vector = np.asarray(vector, dtype=np.float32)
    assert vector.shape == (1, 512), vector.shape
    assert np.isfinite(vector).all()
    norm = np.linalg.norm(vector, axis=-1, keepdims=True)
    assert norm.min() > 0
    return vector / norm


root = pathlib.Path(tempfile.gettempdir()) / "atlas-gallery-model-validation"
root.mkdir(exist_ok=True)
options = ort.SessionOptions()
options.intra_op_num_threads = 2
options.inter_op_num_threads = 1
start = time.perf_counter()
vision_path, text_path = [checked_download(root, *entry) for entry in FILES]
vision = ort.InferenceSession(vision_path, sess_options=options, providers=["CPUExecutionProvider"])
assert {i.name for i in vision.get_inputs()} == {"pixel_values"}
assert "image_embeds" in {o.name for o in vision.get_outputs()}
# Synthetic RGB red image: same NCHW normalization as GalleryClip.pixels.
mean = np.array([.48145466, .4578275, .40821073], dtype=np.float32)
std = np.array([.26862954, .26130258, .27577711], dtype=np.float32)
pixels = np.broadcast_to(((np.array([1, 0, 0], dtype=np.float32) - mean) / std).reshape(1, 3, 1, 1), (1, 3, 224, 224)).copy()
image = unit(vision.run(["image_embeds"], {"pixel_values": pixels})[0])
del vision
text = ort.InferenceSession(text_path, sess_options=options, providers=["CPUExecutionProvider"])
assert {i.name for i in text.get_inputs()} <= {"input_ids", "attention_mask"}
assert "text_embeds" in {o.name for o in text.get_outputs()}
# Independently generated using OpenAI's reference tokenizer; also covered by native BPE tests.
ids = np.array([[49406, 320, 1125, 539, 14191, 5873, 49407]], dtype=np.int64)
inputs = {"input_ids": ids}
if "attention_mask" in {i.name for i in text.get_inputs()}:
    inputs["attention_mask"] = np.ones_like(ids)
query = unit(text.run(["text_embeds"], inputs)[0])
cosine = float(image @ query.T)
assert -1 <= cosine <= 1
assert abs(float(query @ query.T) - 1) < .0001
print(f"PASS: pinned SHA-256 and sizes, native encoder ABI, finite 512-D image/text embeddings, normalized cosine; {time.perf_counter() - start:.2f}s including download on CI CPU. Not an Android-device benchmark.")
