import requests, base64, sys
from pathlib import Path

# Test with one TB image
tb_img = list(Path('E:/PROJECT/PulmoSure/Dataset of Tuberculosis Chest X-rays Images/TB Chest X-rays').glob('*.jpg'))[0]
print(f'Testing with: {tb_img.name}')

with open(tb_img, 'rb') as f:
    r = requests.post('http://localhost:8000/api/screening/analyze',
        files={'image': (tb_img.name, f, 'image/jpeg')},
        data={'symptoms': '{}'})

data = r.json()
pred  = data.get('model_output', {}).get('prediction', 'N/A')
score = data.get('model_output', {}).get('score', 0)
heatmap = data.get('gradcam_heatmap')
print(f'Prediction: {pred}  Score: {score:.4f}')

if heatmap:
    b64 = heatmap.split(',')[1]
    out = Path('E:/PROJECT/PulmoSure/gradcam_test_tb.png')
    out.write_bytes(base64.b64decode(b64))
    print(f'GRAD-CAM OK — saved {out}  ({len(heatmap)} chars)')
else:
    print('GRAD-CAM MISSING')

# Also test with Normal
norm_img = list(Path('E:/PROJECT/PulmoSure/Dataset of Tuberculosis Chest X-rays Images/Normal Chest X-rays').glob('*.jpg'))[0]
with open(norm_img, 'rb') as f:
    r2 = requests.post('http://localhost:8000/api/screening/analyze',
        files={'image': (norm_img.name, f, 'image/jpeg')},
        data={'symptoms': '{}'})
data2  = r2.json()
pred2  = data2.get('model_output', {}).get('prediction', 'N/A')
score2 = data2.get('model_output', {}).get('score', 0)
h2     = data2.get('gradcam_heatmap')
print(f'Normal test: {pred2}  Score: {score2:.4f}  GradCAM: {"YES" if h2 else "NO"}')
if h2:
    out2 = Path('E:/PROJECT/PulmoSure/gradcam_test_normal.png')
    out2.write_bytes(base64.b64decode(h2.split(',')[1]))
    print(f'Saved {out2}')
