"""
Computes, for each disease, the prevalence (0-1) of each of the 132 symptoms
within that disease's rows in Training.csv. This does NOT retrain the model —
it's a separate statistical summary used only to pick which symptom is most
discriminating between ambiguous candidate diseases during follow-up questions.
"""
import json
import pandas as pd

TRAIN_PATH = "/mnt/user-data/uploads/Training.csv"

df = pd.read_csv(TRAIN_PATH)
df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
df.columns = [c.strip() for c in df.columns]

TARGET = "prognosis"
feature_cols = [c for c in df.columns if c != TARGET]
df[TARGET] = df[TARGET].str.strip()

# Mean presence (0-1) of each symptom, grouped by disease
profile = df.groupby(TARGET)[feature_cols].mean().to_dict(orient="index")

with open("/home/claude/ml-service/disease_symptom_profile.json", "w") as f:
    json.dump(profile, f, indent=2)

print(f"Saved profile for {len(profile)} diseases x {len(feature_cols)} symptoms")
