import pandas as pd

# Read the index file from the extracted zip
df = pd.read_csv("Call_Recording_Index.csv", index_col=False)

def to_sec(t):
    h, m, s = [int(x) for x in str(t).split(":")]
    return h * 3600 + m * 60 + s

df["seconds"] = df["Length"].apply(to_sec)

print("=== ZIP AUDIO SUMMARY (677 CALLS) ===")
print("Total recordings :", len(df))
print("Under 15 sec     :", (df["seconds"] < 15).sum())
print("15 to 44 sec     :", ((df["seconds"] >= 15) & (df["seconds"] < 45)).sum())
print("45 to 89 sec     :", ((df["seconds"] >= 45) & (df["seconds"] < 90)).sum())
print("90+ sec (Long)   :", (df["seconds"] >= 90).sum())

# Save the 50 longest calls (without phone numbers for privacy)
long_calls = df[df["seconds"] >= 90][["Recording file name", "Date", "Time", "seconds"]]
long_calls.to_csv("long_calls_to_transcribe.csv", index=False)
print("\nSaved 50 long calls to 'long_calls_to_transcribe.csv'!")