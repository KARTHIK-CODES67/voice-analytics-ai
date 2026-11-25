import pandas as pd
from faster_whisper import WhisperModel

df = pd.read_csv("long_calls_to_transcribe.csv")
sample_file = df.iloc[0]["Recording file name"]

print("Testing faster-whisper MEDIUM on:", sample_file)
model = WhisperModel("medium", compute_type="int8")

# initial_prompt gives context so it recognizes Kannada + English insurance words
segments, _ = model.transcribe(
    sample_file,
    language="kn",
    initial_prompt="Namaskara sir, Meghana International Insurance inda call madiddu. Vehicle insurance renewal date, third party, amount."
)

lines = [f"[{s.start:.0f}s] {s.text.strip()}" for s in segments]
output_text = "\n".join(lines)

with open("test_transcript.txt", "w", encoding="utf-8") as f:
    f.write(output_text)

print("Done! Open 'test_transcript.txt' in VS Code to read it clearly.")