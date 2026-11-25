import json
import os
from typing import List, Optional

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="SwasthSetu Disease Prediction Service")

CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.7"))
FOLLOWUP_CANDIDATE_POOL = 3  # how many top diseases to compare when picking a discriminating symptom

# --- Load artifacts once at startup ---
model = joblib.load("model.joblib")
label_encoder = joblib.load("label_encoder.joblib")

with open("symptom_list.json") as f:
    SYMPTOM_LIST: List[str] = json.load(f)

SYMPTOM_SET = set(SYMPTOM_LIST)

with open("disease_symptom_profile.json") as f:
    DISEASE_SYMPTOM_PROFILE: dict = json.load(f)
# DISEASE_SYMPTOM_PROFILE[disease_name][symptom_key] = prevalence (0-1) of that
# symptom among training rows for that disease. Built once from Training.csv —
# see generate_profile.py. Not part of the trained model itself.


class PredictRequest(BaseModel):
    symptoms: List[str] = Field(..., min_items=1, description="List of symptom keys, e.g. ['high_fever', 'cough']")


class PredictionItem(BaseModel):
    disease: str
    probability: float


class PredictResponse(BaseModel):
    predicted_disease: str
    confidence: float
    top_predictions: List[PredictionItem]
    unrecognized_symptoms: List[str]


class NextQuestionRequest(BaseModel):
    symptoms: List[str] = Field(..., description="Symptom keys already confirmed present")
    excluded_symptoms: List[str] = Field(
        default_factory=list,
        description="Symptom keys already asked about in this assessment (answered yes or no) — never re-asked",
    )
    confidence_threshold: Optional[float] = Field(
        default=None,
        description="Overrides the default CONFIDENCE_THRESHOLD for this call — lets the caller stage thresholds across rounds",
    )


class NextQuestionResponse(BaseModel):
    needs_followup: bool
    predicted_disease: str
    confidence: float
    top_predictions: List[PredictionItem]
    next_symptom_key: Optional[str] = None


def _run_prediction(symptom_keys: List[str]):
    recognized = [s for s in symptom_keys if s in SYMPTOM_SET]
    input_vector = [[1 if symptom in recognized else 0 for symptom in SYMPTOM_LIST]]
    probabilities = model.predict_proba(input_vector)[0]
    top_indices = probabilities.argsort()[::-1][:FOLLOWUP_CANDIDATE_POOL]
    top = [
        (label_encoder.inverse_transform([i])[0], float(probabilities[i]))
        for i in top_indices
    ]
    return top


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/next-question", response_model=NextQuestionResponse)
def next_question(req: NextQuestionRequest):
    """
    Runs the existing model on the currently-known symptoms. If the top
    prediction is already confident (>= CONFIDENCE_THRESHOLD), no follow-up
    is needed. Otherwise, picks the unselected symptom whose prevalence
    varies most across the current top candidate diseases (computed from
    Training.csv, not hardcoded) and asks about that one.
    """
    top = _run_prediction(req.symptoms)
    top_predictions = [PredictionItem(disease=d, probability=round(p, 4)) for d, p in top]
    predicted_disease, confidence = top[0]

    threshold = req.confidence_threshold if req.confidence_threshold is not None else CONFIDENCE_THRESHOLD

    if confidence >= threshold:
        return NextQuestionResponse(
            needs_followup=False,
            predicted_disease=predicted_disease,
            confidence=round(confidence, 4),
            top_predictions=top_predictions,
            next_symptom_key=None,
        )

    known = set(req.symptoms) | set(req.excluded_symptoms)
    candidate_diseases = [d for d, _ in top]

    best_symptom = None
    best_spread = -1.0
    for symptom in SYMPTOM_LIST:
        if symptom in known:
            continue
        values = [
            DISEASE_SYMPTOM_PROFILE.get(disease, {}).get(symptom, 0.0)
            for disease in candidate_diseases
        ]
        spread = max(values) - min(values)
        if spread > best_spread:
            best_spread = spread
            best_symptom = symptom

    # No usable discriminating symptom left (exhausted) — fall back to current best guess
    if best_symptom is None or best_spread <= 0:
        return NextQuestionResponse(
            needs_followup=False,
            predicted_disease=predicted_disease,
            confidence=round(confidence, 4),
            top_predictions=top_predictions,
            next_symptom_key=None,
        )

    return NextQuestionResponse(
        needs_followup=True,
        predicted_disease=predicted_disease,
        confidence=round(confidence, 4),
        top_predictions=top_predictions,
        next_symptom_key=best_symptom,
    )


@app.get("/symptoms")
def get_symptoms():
    return {"symptoms": SYMPTOM_LIST, "count": len(SYMPTOM_LIST)}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    unrecognized = [s for s in req.symptoms if s not in SYMPTOM_SET]
    recognized = [s for s in req.symptoms if s in SYMPTOM_SET]

    if not recognized:
        raise HTTPException(
            status_code=400,
            detail=f"None of the provided symptoms are recognized. Unrecognized: {unrecognized}",
        )

    # Build the 0/1 feature vector in the exact column order the model expects
    input_vector = [[1 if symptom in recognized else 0 for symptom in SYMPTOM_LIST]]

    probabilities = model.predict_proba(input_vector)[0]
    top_indices = probabilities.argsort()[::-1][:3]

    top_predictions = [
        PredictionItem(
            disease=label_encoder.inverse_transform([i])[0],
            probability=round(float(probabilities[i]), 4),
        )
        for i in top_indices
    ]

    return PredictResponse(
        predicted_disease=top_predictions[0].disease,
        confidence=top_predictions[0].probability,
        top_predictions=top_predictions,
        unrecognized_symptoms=unrecognized,
    )
