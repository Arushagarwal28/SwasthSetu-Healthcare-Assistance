"""
Train a disease-prediction model from the Training.csv / Testing.csv
symptom-checker dataset, and persist the artifacts the FastAPI service needs.
"""
import json
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import joblib

TRAIN_PATH = "/mnt/user-data/uploads/Training.csv"
TEST_PATH = "/mnt/user-data/uploads/Testing__1_.csv"

# --- Load ---
train_df = pd.read_csv(TRAIN_PATH)
test_df = pd.read_csv(TEST_PATH)

# The training CSV has a trailing empty/unnamed column from a trailing comma — drop it
train_df = train_df.loc[:, ~train_df.columns.str.contains('^Unnamed')]
test_df = test_df.loc[:, ~test_df.columns.str.contains('^Unnamed')]

train_df.columns = [c.strip() for c in train_df.columns]
test_df.columns = [c.strip() for c in test_df.columns]

TARGET = "prognosis"
feature_cols = [c for c in train_df.columns if c != TARGET]

X_train = train_df[feature_cols]
y_train_raw = train_df[TARGET].str.strip()

X_test = test_df[feature_cols]
y_test_raw = test_df[TARGET].str.strip()

# --- Encode labels ---
label_encoder = LabelEncoder()
y_train = label_encoder.fit_transform(y_train_raw)
y_test = label_encoder.transform(y_test_raw)

# --- Train ---
model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_train, y_train)

# --- Evaluate ---
train_acc = accuracy_score(y_train, model.predict(X_train))
test_acc = accuracy_score(y_test, model.predict(X_test))

print(f"Train accuracy: {train_acc:.4f}")
print(f"Test accuracy:  {test_acc:.4f}")
print()
print("Classification report (test set):")
print(classification_report(y_test, model.predict(X_test), target_names=label_encoder.classes_, zero_division=0))

# --- Persist artifacts ---
joblib.dump(model, "/home/claude/ml-service/model.joblib")
joblib.dump(label_encoder, "/home/claude/ml-service/label_encoder.joblib")

with open("/home/claude/ml-service/symptom_list.json", "w") as f:
    json.dump(feature_cols, f, indent=2)

with open("/home/claude/ml-service/disease_list.json", "w") as f:
    json.dump(list(label_encoder.classes_), f, indent=2)

print(f"\nSaved model, label encoder, {len(feature_cols)} symptoms, {len(label_encoder.classes_)} diseases.")
