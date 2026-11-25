import pandas as pd
import librosa
from transformers import pipeline

df = pd.read_csv("long_calls_to_transcribe.csv")
sample_file = df.iloc[0]["Recording file name"]

# Load ONLY the first 30 seconds (duration=30) so it runs in ~20 seconds
audio, sr = librosa.load(sample_file, sr=16000, duration=30)

print("Transcribing first 30 seconds...")
asr = pipeline("automatic-speech-recognition", model="vasista22/whisper-kannada-small")
result = asr({"raw": audio, "sampling_rate": 16000})

print("\n--- IISc KANNADA MODEL (FIRST 30 SEC) ---")
print(result["text"])