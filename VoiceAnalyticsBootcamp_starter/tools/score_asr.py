"""Reference offline WER/CER scorer for human-approved reference text.
No audio, no PII logs, no model invocation. Usage:
 python tools/score_asr.py --reference-file gold.txt --hypothesis-file predicted.txt
"""
import argparse
from pathlib import Path
import json
import re

def edit_distance(a, b):
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        nxt = [i]
        for j, cb in enumerate(b, 1):
            nxt.append(min(nxt[-1] + 1, row[j] + 1, row[j-1] + (ca != cb)))
        row = nxt
    return row[-1]

def score(reference, hypothesis):
    ref = re.sub(r"\s+", " ", reference.casefold()).strip()
    hyp = re.sub(r"\s+", " ", hypothesis.casefold()).strip()
    if not ref:
        raise ValueError("Empty reference text; use a separate no-speech test")
    rwords = ref.split(); hwords = hyp.split()
    return {"wer": round(edit_distance(rwords, hwords) / len(rwords), 5),
            "cer": round(edit_distance(ref, hyp) / len(ref), 5),
            "reference_words": len(rwords), "predicted_words": len(hwords)}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--reference-file',required=True);ap.add_argument('--hypothesis-file',required=True)
    a=ap.parse_args(); print(json.dumps(score(Path(a.reference_file).read_text(encoding='utf-8'),Path(a.hypothesis_file).read_text(encoding='utf-8')),indent=2))
if __name__=='__main__':main()
