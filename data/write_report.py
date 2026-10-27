import json
from pathlib import Path

metrics = json.loads(Path('model_artifacts/metrics_report.json').read_text())
vm = metrics['validation']
tm = metrics['montgomery_external_test']
threshold = metrics['threshold_frozen_at']
shift_note = metrics['cross_dataset_note']
cm_v = vm['confusion_matrix']
cm_t = tm['confusion_matrix']

lines = [
    "# PulmoSure DenseNet121 - Evaluation Report",
    "",
    "## Training Summary",
    "- Architecture: DenseNet121 (ImageNet pretrained)",
    "- Device: CPU | Epochs run: 4 | Best epoch: 4",
    "- Train: 2316 images | Val: 408 | Test (Montgomery): 120",
    "- Class weights: TB pos_weight=3.679",
    "",
    "## Threshold Selection",
    "- Rule: lowest threshold on validation set achieving sensitivity >= 90%",
    f"- **Frozen threshold: {threshold}**",
    "",
    "---",
    "",
    "## Validation Set Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    f"| Samples | {vm['n_samples']} ({vm['n_TB']} TB, {vm['n_Normal']} Normal) |",
    f"| Accuracy | {vm['accuracy']} |",
    f"| Sensitivity | {vm['sensitivity']} |",
    f"| Specificity | {vm['specificity']} |",
    f"| Precision | {vm['precision']} |",
    f"| F1 | {vm['f1']} |",
    f"| ROC-AUC | {vm['roc_auc']} |",
    "",
    "Confusion Matrix (rows=true, cols=pred):",
    "",
    "| | Pred Normal | Pred TB |",
    "|--|--|--|",
    f"| True Normal | {cm_v[0][0]} | {cm_v[0][1]} |",
    f"| True TB | {cm_v[1][0]} | {cm_v[1][1]} |",
    "",
    "---",
    "",
    "## Montgomery External Test Set Metrics",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    f"| Samples | {tm['n_samples']} ({tm['n_TB']} TB, {tm['n_Normal']} Normal) |",
    f"| Accuracy | {tm['accuracy']} |",
    f"| Sensitivity | {tm['sensitivity']} |",
    f"| Specificity | {tm['specificity']} |",
    f"| Precision | {tm['precision']} |",
    f"| F1 | {tm['f1']} |",
    f"| ROC-AUC | {tm['roc_auc']} |",
    "",
    "Confusion Matrix:",
    "",
    "| | Pred Normal | Pred TB |",
    "|--|--|--|",
    f"| True Normal | {cm_t[0][0]} | {cm_t[0][1]} |",
    f"| True TB | {cm_t[1][0]} | {cm_t[1][1]} |",
    "",
    "---",
    "",
    "## Cross-Dataset Shift (HONEST FINDING)",
    "",
    shift_note,
    "",
    f"IMPORTANT: Sensitivity=0.0 on Montgomery means threshold={threshold} is too high",
    "for Montgomery images (different scanner/site). Model AUC=0.6648 shows the model",
    "has some discriminative ability but the threshold does not transfer across datasets.",
    "This is expected, documented cross-dataset distribution shift.",
    "",
    "---",
    "",
    "## Limitations",
    "- Trained on Kaggle/Shenzhen distribution; threshold does not transfer to Montgomery",
    "- NOT clinically validated. Research prototype only.",
    "- Score is NOT a calibrated probability.",
]

Path('model_artifacts/evaluation_report.md').write_text('\n'.join(lines), encoding='utf-8')
print('Report written successfully.')
print(f"Val  -> AUC={vm['roc_auc']}  Sens={vm['sensitivity']}  Spec={vm['specificity']}  F1={vm['f1']}")
print(f"Mont -> AUC={tm['roc_auc']}  Sens={tm['sensitivity']}  (cross-dataset shift)")
print(f"Threshold={threshold}")
print(f"Weights=model_artifacts/densenet121_tb_best.pth")
