"""Optional actual ASR via downloaded Whisper checkpoint and faster-whisper runtime."""
from pathlib import Path

def transcribe_wav(path: Path, model_name: str = "small", language: str | None = None) -> tuple[list[dict], dict]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise RuntimeError("Install project requirements before using --input-audio") from e
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments_iter, info = model.transcribe(str(path), language=language, beam_size=5, vad_filter=False)
    segments = [{"id": f"s{i:04d}", "start": round(s.start, 2), "end": round(s.end, 2),
                 "text": s.text.strip()} for i, s in enumerate(segments_iter, 1) if s.text.strip()]
    if not segments:
        raise ValueError("No speech segments detected; do not invent a transcript")
    return segments, {"detected_language": info.language, "language_probability": round(info.language_probability, 3),
                      "asr_model": model_name, "asr_runtime": "faster-whisper", "device": "cpu", "compute_type": "int8"}
