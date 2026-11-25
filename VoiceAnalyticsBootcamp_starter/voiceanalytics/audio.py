"""Read-only audio probing and decode to analysis WAV; do not overwrite original."""
from __future__ import annotations
import json
import shutil
import subprocess
from pathlib import Path


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Missing {name}. Install FFmpeg and verify '{name} -version'.")


def probe(input_path: Path) -> dict:
    require_tool("ffprobe")
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_name,sample_rate,channels,channel_layout",
        "-of", "json", str(input_path)
    ], check=True, capture_output=True, text=True)
    metadata = json.loads(result.stdout)
    if not any(s.get("codec_name") for s in metadata.get("streams", [])):
        raise ValueError("No readable audio stream found")
    return metadata


def convert_to_asr_wav(input_path: Path, output_path: Path) -> None:
    require_tool("ffmpeg")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # A learning baseline only: it DOWNMIXES channels and must not be used for
    # a dual-channel production call until channel/speaker-role strategy is reviewed.
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(input_path), "-vn", "-ar", "16000", "-ac", "1",
        "-c:a", "pcm_s16le", str(output_path)
    ], check=True)
