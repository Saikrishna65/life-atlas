# Model artifact review — 24 November 2026

Eleven artifacts have immutable revisions, exact LFS byte counts and SHA-256 digests, license references, and architectures/quantizations present in the pinned CPU runtime. **None has passed real-weight inference here.** Download readiness means the catalogue can request and verify the artifact; it is not a quality or device-compatibility certification. The managed workspace still rejects Hugging Face weight requests. No gate, proxy, mirror or account restriction was bypassed.

Pinned runtime: `a6ac41c757c066941766164439f6876f2deaab04`. All entries use the GGUF chat template by default. Multimodal sidecars and vision/audio inference are not implemented. Third-party quantizers are identified separately from model publishers.

| Candidate / artifact | Architecture · quantization | Exact bytes | License |
|---|---|---:|---|
| Dolphin 3.0 · 1B | llama · Q4_K_M | 807697440 | Llama 3.2 Community License |
| LFM3 · 1.7B | lfm3 · Q4_K_M | 1099627808 | Liquid AI LFM Open License v1.0 |
| Dolphin 3.0 · 3B | llama · Q4_K_M | 2019382400 | Llama 3.2 Community License |
| Qwen3 · 1.7B | qwen3 · Q8_0 | 1834426016 | Apache License 2.0 |
| LFM2.5 · 1.2B Instruct | lfm2 · Q4_K_M | 730895168 | Liquid AI LFM Open License v1.0 |
| Huihui Qwen3.5 · 2B abliterated | qwen35 · Q4_K_M | 1270809024 | Apache License 2.0 |
| Huihui Qwen3.5 · 4B abliterated | qwen35 · Q4_K_M | 2707514688 | Apache License 2.0 |
| Qwen3.5 · 2B | qwen35 · Q4_K_M | 1280835840 | Apache License 2.0 |
| Gemma 4 · E2B | gemma4 · Q4_K_M | 3106738272 | Apache License 2.0 |
| Bonsai · 4B 1-bit | qwen3 · Q1_0 | 572270624 | Apache License 2.0 |
| Huihui Qwen3.5 · 0.8B abliterated | qwen35 · Q4_K_M | 527503840 | Apache License 2.0 |
| Arcee Lite 1.7B | Unverified identity | — | Not established |

## Exact downloads and integrity

These are publisher/quantizer repository artifacts, reviewed through their LFS pointer and immutable revision metadata. URLs are pinned rather than using `main`. The app checks the entire SHA-256 before installation. License acceptance remains the user’s responsibility.

### Dolphin 3.0 · 1B

- Catalogue ID: `dolphin-3-1b-q4`.
- Publisher: Cognitive Computations / dphn; quantizer: bartowski.
- File: `Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-1B-GGUF/resolve/a1c3b93338d479acf632aa358360263c6735038b/Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-1B-GGUF/blob/a1c3b93338d479acf632aa358360263c6735038b/Dolphin3.0-Llama3.2-1B-Q4_K_M.gguf).
- [License](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/blob/main/LICENSE.txt).
- Revision: `a1c3b93338d479acf632aa358360263c6735038b`.
- SHA-256: `7ed39ee0638e18d3e47bf12e60e917c792ca5332606a72bd1882ab1f62a13a7a`.
- File: 807,697,440 bytes; minimum additional destination free space for app download/import: 874,806,304 bytes. Imported originals need their own space too.

### LFM3 · 1.7B

- Catalogue ID: `lfm3-17b-q4`.
- Publisher: Liquid AI; quantizer: Liquid AI.
- File: `LFM3-1.7B-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/b3f2ae5d73cd3c91bf40e8ba752c648aa05dffdf/LFM3-1.7B-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/blob/b3f2ae5d73cd3c91bf40e8ba752c648aa05dffdf/LFM3-1.7B-Q4_K_M.gguf).
- [License](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/blob/main/LICENSE).
- Revision: `b3f2ae5d73cd3c91bf40e8ba752c648aa05dffdf`.
- SHA-256: `3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4`.
- File: 1,099,627,808 bytes; minimum additional destination free space for app download/import: 1,166,736,672 bytes. Imported originals need their own space too.

### Dolphin 3.0 · 3B

- Catalogue ID: `dolphin-3-3b-q4`.
- Publisher: Cognitive Computations / dphn; quantizer: bartowski.
- File: `Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF/resolve/000e38f4dd75d30f0d579a41cf475d8a53120bd9/Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/bartowski/Dolphin3.0-Llama3.2-3B-GGUF/blob/000e38f4dd75d30f0d579a41cf475d8a53120bd9/Dolphin3.0-Llama3.2-3B-Q4_K_M.gguf).
- [License](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct/blob/main/LICENSE.txt).
- Revision: `000e38f4dd75d30f0d579a41cf475d8a53120bd9`.
- SHA-256: `5d6d02eeefa1ab5dbf23f97afdf5c2c95ad3d946dc3b6e9ab72e6c1637d54177`.
- File: 2,019,382,400 bytes; minimum additional destination free space for app download/import: 2,086,491,264 bytes. Imported originals need their own space too.

### Qwen3 · 1.7B

- Catalogue ID: `qwen3-17b-q8`.
- Publisher: Qwen; quantizer: Qwen.
- File: `Qwen3-1.7B-Q8_0.gguf`.
- [Pinned weight download](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/61cf2fab285ddd4cad3dafa9c69dfef96426ee0b/Qwen3-1.7B-Q8_0.gguf).
- [Source / model card](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/61cf2fab285ddd4cad3dafa9c69dfef96426ee0b/Qwen3-1.7B-Q8_0.gguf).
- [License](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE).
- Revision: `61cf2fab285ddd4cad3dafa9c69dfef96426ee0b`.
- SHA-256: `061b54daade076b5d3362dac252678d17da8c68f07560be70818cace6590cb1a`.
- File: 1,834,426,016 bytes; minimum additional destination free space for app download/import: 1,901,534,880 bytes. Imported originals need their own space too.

### LFM2.5 · 1.2B Instruct

- Catalogue ID: `lfm25-12b-q4`.
- Publisher: Liquid AI; quantizer: Liquid AI.
- File: `LFM2.5-1.2B-Instruct-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/4e7112f1437070cf9f49aeb93ad965b946029f75/LFM2.5-1.2B-Instruct-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/blob/4e7112f1437070cf9f49aeb93ad965b946029f75/LFM2.5-1.2B-Instruct-Q4_K_M.gguf).
- [License](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/blob/4e7112f1437070cf9f49aeb93ad965b946029f75/LICENSE).
- Revision: `4e7112f1437070cf9f49aeb93ad965b946029f75`.
- SHA-256: `b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5`.
- File: 730,895,168 bytes; minimum additional destination free space for app download/import: 798,004,032 bytes. Imported originals need their own space too.

### Huihui Qwen3.5 · 2B abliterated

- Catalogue ID: `huihui-qwen35-2b-q4`.
- Publisher: huihui-ai / Qwen; quantizer: mradermacher.
- File: `Huihui-Qwen3.5-2B-abliterated.Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/mradermacher/Huihui-Qwen3.5-2B-abliterated-GGUF/resolve/fabffdb5bf4b4cffc51a3ffa1fefdafe3584ff64/Huihui-Qwen3.5-2B-abliterated.Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/mradermacher/Huihui-Qwen3.5-2B-abliterated-GGUF/blob/fabffdb5bf4b4cffc51a3ffa1fefdafe3584ff64/Huihui-Qwen3.5-2B-abliterated.Q4_K_M.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `fabffdb5bf4b4cffc51a3ffa1fefdafe3584ff64`.
- SHA-256: `aa25eea787afe56a097268f7ed3460cb623e1901d2e89cd2b654cabb42f80636`.
- File: 1,270,809,024 bytes; minimum additional destination free space for app download/import: 1,337,917,888 bytes. Imported originals need their own space too.

### Huihui Qwen3.5 · 4B abliterated

- Catalogue ID: `huihui-qwen35-4b-q4`.
- Publisher: huihui-ai / Qwen; quantizer: mradermacher.
- File: `Huihui-Qwen3.5-4B-abliterated.Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/mradermacher/Huihui-Qwen3.5-4B-abliterated-GGUF/resolve/7924d5142303ec8acc846af84e663cebd2bfb921/Huihui-Qwen3.5-4B-abliterated.Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/mradermacher/Huihui-Qwen3.5-4B-abliterated-GGUF/blob/7924d5142303ec8acc846af84e663cebd2bfb921/Huihui-Qwen3.5-4B-abliterated.Q4_K_M.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `7924d5142303ec8acc846af84e663cebd2bfb921`.
- SHA-256: `423f10b6ec2d99c3378143d7cd3b80eb4887b3ed92103103ac59173b404f4f7c`.
- File: 2,707,514,688 bytes; minimum additional destination free space for app download/import: 2,774,623,552 bytes. Imported originals need their own space too.

### Qwen3.5 · 2B

- Catalogue ID: `qwen35-2b-q4`.
- Publisher: Qwen; quantizer: Unsloth.
- File: `Qwen3.5-2B-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/802854bfd388ed92748de119df31327962811548/Qwen3.5-2B-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/blob/802854bfd388ed92748de119df31327962811548/Qwen3.5-2B-Q4_K_M.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `802854bfd388ed92748de119df31327962811548`.
- SHA-256: `aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223`.
- File: 1,280,835,840 bytes; minimum additional destination free space for app download/import: 1,347,944,704 bytes. Imported originals need their own space too.

### Gemma 4 · E2B

- Catalogue ID: `gemma4-e2b-q4`.
- Publisher: Google DeepMind; quantizer: Unsloth.
- File: `gemma-4-E2B-it-Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/0314792d7f1f7e229411f620751375812bb9faf2/gemma-4-E2B-it-Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/blob/0314792d7f1f7e229411f620751375812bb9faf2/gemma-4-E2B-it-Q4_K_M.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `0314792d7f1f7e229411f620751375812bb9faf2`.
- SHA-256: `740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8`.
- File: 3,106,738,272 bytes; minimum additional destination free space for app download/import: 3,173,847,136 bytes. Imported originals need their own space too.

### Bonsai · 4B 1-bit

- Catalogue ID: `bonsai-4b-q1`.
- Publisher: Prism ML; quantizer: Prism ML.
- File: `Bonsai-4B.gguf`.
- [Pinned weight download](https://huggingface.co/prism-ml/Bonsai-4B-gguf/resolve/13f0d9d196f252f130041ce1b2897736ac541fe6/Bonsai-4B.gguf).
- [Source / model card](https://huggingface.co/prism-ml/Bonsai-4B-gguf/blob/13f0d9d196f252f130041ce1b2897736ac541fe6/Bonsai-4B.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `13f0d9d196f252f130041ce1b2897736ac541fe6`.
- SHA-256: `4524b3f997f0f06444e568d1f26e2efd69effa3218c7ad3047432fb171e42168`.
- File: 572,270,624 bytes; minimum additional destination free space for app download/import: 639,379,488 bytes. Imported originals need their own space too.

### Huihui Qwen3.5 · 0.8B abliterated

- Catalogue ID: `huihui-qwen35-08b-q4`.
- Publisher: huihui-ai / Qwen; quantizer: mradermacher.
- File: `Huihui-Qwen3.5-0.8B-abliterated.Q4_K_M.gguf`.
- [Pinned weight download](https://huggingface.co/mradermacher/Huihui-Qwen3.5-0.8B-abliterated-GGUF/resolve/9f25fb4459403fd943b6476ebce0aad2da128122/Huihui-Qwen3.5-0.8B-abliterated.Q4_K_M.gguf).
- [Source / model card](https://huggingface.co/mradermacher/Huihui-Qwen3.5-0.8B-abliterated-GGUF/blob/9f25fb4459403fd943b6476ebce0aad2da128122/Huihui-Qwen3.5-0.8B-abliterated.Q4_K_M.gguf).
- [License](https://www.apache.org/licenses/LICENSE-2.0).
- Revision: `9f25fb4459403fd943b6476ebce0aad2da128122`.
- SHA-256: `411e0f945a5d57c63f33bcb5bfa4d5c2711d1ce28cb7635201ac0c311a7dfdf0`.
- File: 527,503,840 bytes; minimum additional destination free space for app download/import: 594,612,704 bytes. Imported originals need their own space too.

## Compatibility qualifications

- LFM2.5 uses the pinned `lfm2` architecture; LFM3 has separate `lfm3` support. Similar branding does not imply an identical template.
- Qwen3.5 artifacts use the runtime’s `qwen35` support. These hybrid models need an actual load/generation test; a matching architecture string alone does not validate every tensor. Abliteration does not grant model tools any extra permissions.
- Gemma 4 E2B is this exact Gemma 4 artifact, not Gemma 2/3. Its publisher card identifies Apache 2.0. Its 3.1 GB file fits the import cap but has a high memory risk on an 8 GB phone; do not begin device testing with it.
- Bonsai’s publisher specifies Q1_0 with group size 128 and a Qwen3 architecture. The pinned upstream has `GGML_TYPE_Q1_0`, `QK1_0=128` and CPU kernels. We use that upstream CPU implementation, not the publisher’s separate GPU fork. Actual weight behavior remains untested.
- Arcee Lite 1.7B: the requested identity could not be tied to a verified primary GGUF artifact with revision, license, bytes and digest. Search references to a 1.7B model are insufficient. It stays disabled; no 4.5B/7B substitute or guessed URL was added. Supply the exact publisher/model URL to resolve it.

## Supply a model without bypassing workspace rules

1. On your own machine, download one exact file above using its normal authorized publisher download. For the smallest first smoke test use Huihui Qwen3.5 0.8B (527,503,840 bytes); LFM2.5 1.2B (730,895,168 bytes) is another small candidate. These are test priorities, not measured quality recommendations.
2. Run `python scripts/local-ai/verify-model.py --id huihui-qwen35-08b-q4 --file "C:\Models\Huihui-Qwen3.5-0.8B-abliterated.Q4_K_M.gguf"`. The script only reads the file.
3. For Android, **Control Room → Intelligence Lab → Import GGUF**. The source remains untouched; only the app-private copy is removed on cancel. Importing does not independently establish publisher trust.
4. To run in this workspace, supply the authorized GGUF as an uploaded file or mounted local file after ensuring enough disk space. No local models or Windows mount were present during this audit. Do not place weights in git.
5. Run `smoke-native.py` against that file; then run the existing quick benchmark before the full suite. See `WINDOWS-TESTS.md`. No real response or model performance should be claimed until those commands complete.
