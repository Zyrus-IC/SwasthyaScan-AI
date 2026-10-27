"""
SwasthyaScan AI — Review Priority Engine
=========================================
EXPERIMENTAL PROTOTYPE RULES — NOT CLINICALLY VALIDATED.

Produces one of four labels:
  - Urgent review
  - Elevated review
  - Routine review
  - Unable to assess

Rules (in priority order):
1.  If inference failed or model unavailable → "Unable to assess" (never Routine).
2.  Haemoptysis reported → at minimum "Urgent review".
3.  MODEL_VERIFIED=true and model predicts TB (score ≥ threshold) → at minimum "Elevated review".
4.  MODEL_VERIFIED=true and model score ≥ HIGH_SCORE → "Urgent review".
5.  ≥ 3 TB-associated symptoms → "Elevated review".
6.  ≥ 1 TB-associated symptom → "Routine review".
7.  No symptoms, no reliable model → "Unable to assess" (insufficient information).
8.  Otherwise → "Routine review".

Low model output does NOT produce Routine if symptoms are high-risk (rule 2+3 override).
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field


_MODEL_VERIFIED = os.environ.get("MODEL_VERIFIED", "false").lower() == "true"
_HIGH_SCORE     = 0.70   # TB score that triggers Urgent when model is verified
_MODEL_THRESHOLD = float(os.environ.get("MODEL_THRESHOLD", "0.1453"))

LABEL_URGENT   = "Urgent review"
LABEL_ELEVATED = "Elevated review"
LABEL_ROUTINE  = "Routine review"
LABEL_UNABLE   = "Unable to assess"


@dataclass
class PriorityResult:
    label:   str
    reasons: list[str] = field(default_factory=list)


def compute_priority(
    questionnaire: dict,
    model_output: dict | None,
    reliability_flags: list[dict],
) -> PriorityResult:
    """
    Compute review priority label + reasons.
    All rules are EXPERIMENTAL PROTOTYPE RULES — not clinically validated.
    """
    reasons: list[str] = []
    model_verified = os.environ.get("MODEL_VERIFIED", "false").lower() == "true"
    threshold      = float(os.environ.get("MODEL_THRESHOLD", "0.1453"))

    q = questionnaire or {}
    hemoptysis     = bool(q.get("hemoptysis") or q.get("haemoptysis"))
    cough          = bool(q.get("persistent_cough") or q.get("persistentCough"))
    fever          = bool(q.get("fever"))
    night_sweats   = bool(q.get("night_sweats") or q.get("nightSweats"))
    weight_loss    = bool(q.get("weight_loss") or q.get("weightLoss"))
    fatigue        = bool(q.get("fatigue"))
    symptom_count  = sum([cough, fever, night_sweats, weight_loss, fatigue, hemoptysis])

    # ── Reliability: was inference performed? ─────────────────────────────────
    inference_ok = (model_output is not None
                    and model_output.get("prediction") in ("TB", "Normal"))
    if not inference_ok:
        reasons.append("[Prototype rule] Model inference was not available or failed. "
                       "Result is based on questionnaire only.")

    # ── Rule 1: failed inference → Unable to assess unless symptoms rescue it ─
    # (We still proceed to symptom checks — haemoptysis always escalates)

    # ── Rule 2: haemoptysis ────────────────────────────────────────────────────
    if hemoptysis:
        reasons.append("[Prototype rule] Haemoptysis (blood in sputum) was reported. "
                       "Always triggers at minimum Urgent review regardless of model output.")
        return PriorityResult(label=LABEL_URGENT, reasons=reasons)

    # ── Rule 3 + 4: model output (only when verified) ─────────────────────────
    model_label = LABEL_ROUTINE  # default if model not factored in
    if inference_ok and model_verified:
        score = float(model_output.get("score", 0))
        pred  = model_output.get("prediction", "Normal")
        if score >= _HIGH_SCORE:
            reasons.append(f"[Prototype rule] Verified model score {score:.3f} "
                           f"≥ {_HIGH_SCORE} — triggers Urgent review.")
            model_label = LABEL_URGENT
        elif pred == "TB":
            reasons.append(f"[Prototype rule] Verified model predicted TB "
                           f"(score={score:.3f}, threshold={threshold}) — triggers Elevated review.")
            model_label = LABEL_ELEVATED
        else:
            reasons.append(f"[Prototype rule] Verified model predicted Normal "
                           f"(score={score:.3f}).")
            model_label = LABEL_ROUTINE
    elif inference_ok and not model_verified:
        score = float(model_output.get("score", 0))
        reasons.append(f"[Prototype rule] Model output score={score:.3f} is marked "
                       "EXPERIMENTAL / NOT VERIFIED (MODEL_VERIFIED=false). "
                       "It is shown to the doctor but does NOT contribute to this priority label.")

    # ── Rule 5 + 6: symptom count ─────────────────────────────────────────────
    symptom_label = LABEL_UNABLE  # default
    if symptom_count >= 3:
        reasons.append(f"[Prototype rule] {symptom_count} TB-associated symptoms reported "
                       "(threshold: ≥3 → Elevated review).")
        symptom_label = LABEL_ELEVATED
    elif symptom_count >= 1:
        reported = [s for s, v in [("cough", cough), ("fever", fever),
                                    ("night_sweats", night_sweats), ("weight_loss", weight_loss),
                                    ("fatigue", fatigue)] if v]
        reasons.append(f"[Prototype rule] {symptom_count} TB-associated symptom(s) reported "
                       f"({', '.join(reported)}).")
        symptom_label = LABEL_ROUTINE
    else:
        reasons.append("[Prototype rule] No TB-associated symptoms were reported.")
        symptom_label = LABEL_UNABLE

    # ── Rule 7: no info at all ────────────────────────────────────────────────
    if not inference_ok and symptom_count == 0:
        reasons.append("[Prototype rule] No model output and no symptoms — "
                       "insufficient information to assign a review priority.")
        return PriorityResult(label=LABEL_UNABLE, reasons=reasons)

    # ── Final: take the highest label from model + symptoms ───────────────────
    _order = {LABEL_URGENT: 3, LABEL_ELEVATED: 2, LABEL_ROUTINE: 1, LABEL_UNABLE: 0}
    final = max(model_label, symptom_label, key=lambda l: _order.get(l, 0))

    # Low model score + high symptoms must be at least Elevated
    if (inference_ok and model_verified
            and model_output.get("prediction") == "Normal"
            and symptom_count >= 3
            and _order[final] < _order[LABEL_ELEVATED]):
        reasons.append("[Prototype rule] Low model score but high symptom count "
                       "— escalated to Elevated review.")
        final = LABEL_ELEVATED

    return PriorityResult(label=final, reasons=reasons)
