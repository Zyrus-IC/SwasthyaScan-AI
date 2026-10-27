# PulmoSure TB Model — Evaluation Report

## Combined Dataset
- Total valid images: 7346
- Normal: 4094  TB: 3252
- Split: 70/15/15 stratified

## Training
- Model: EfficientNet-B0 (ImageNet pretrained)
- Best val AUC: 0.9997
- Threshold: 0.1453 (val recall >= 90%)

## Test Set Results
| Metric | Value |
|--------|-------|
| Accuracy | 0.9927 |
| Precision | 0.9898 |
| Recall (TB sensitivity) | 0.9939 |
| F1 | 0.9918 |
| ROC-AUC | 0.9997 |

| | Pred Normal | Pred TB |
|--|--|--|
| True Normal | 609 | 5 |
| True TB | 3 | 485 |