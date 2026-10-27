# PulmoSure DenseNet121 - Evaluation Report

## Training Summary
- Architecture: DenseNet121 (ImageNet pretrained)
- Device: CPU | Epochs run: 4 | Best epoch: 4
- Train: 2316 images | Val: 408 | Test (Montgomery): 120
- Class weights: TB pos_weight=3.679

## Threshold Selection
- Rule: lowest threshold on validation set achieving sensitivity >= 90%
- **Frozen threshold: 0.9728510975837708**

---

## Validation Set Metrics

| Metric | Value |
|--------|-------|
| Samples | 408 (87 TB, 321 Normal) |
| Accuracy | 0.9804 |
| Sensitivity | 0.908 |
| Specificity | 1.0 |
| Precision | 1.0 |
| F1 | 0.9518 |
| ROC-AUC | 1.0 |

Confusion Matrix (rows=true, cols=pred):

| | Pred Normal | Pred TB |
|--|--|--|
| True Normal | 321 | 0 |
| True TB | 8 | 79 |

---

## Montgomery External Test Set Metrics

| Metric | Value |
|--------|-------|
| Samples | 120 (47 TB, 73 Normal) |
| Accuracy | 0.6083 |
| Sensitivity | 0.0 |
| Specificity | 1.0 |
| Precision | 0.0 |
| F1 | 0.0 |
| ROC-AUC | 0.6648 |

Confusion Matrix:

| | Pred Normal | Pred TB |
|--|--|--|
| True Normal | 73 | 0 |
| True TB | 47 | 0 |

---

## Cross-Dataset Shift (HONEST FINDING)

Montgomery AUC (0.6648) is 0.3352 below validation AUC (1.0000). This is expected cross-dataset distribution shift: Montgomery images come from a different scanner, site, and patient population. The threshold was NOT re-tuned on Montgomery — doing so would artificially inflate reported performance.

IMPORTANT: Sensitivity=0.0 on Montgomery means threshold=0.9728510975837708 is too high
for Montgomery images (different scanner/site). Model AUC=0.6648 shows the model
has some discriminative ability but the threshold does not transfer across datasets.
This is expected, documented cross-dataset distribution shift.

---

## Limitations
- Trained on Kaggle/Shenzhen distribution; threshold does not transfer to Montgomery
- NOT clinically validated. Research prototype only.
- Score is NOT a calibrated probability.