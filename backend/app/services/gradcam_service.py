"""
PulmoSure — Grad-CAM++ with Annotated Region Detection
=======================================================
Generates a professional medical-AI analysis image:
  1. Original X-ray with Grad-CAM++ heatmap overlay
  2. Auto-detected bounding box around highest-attention region
  3. Labeled annotation: "TB Risk Region" (red) or "Normal" (green)
  4. Score badge in corner
  5. Side-by-side: Clean original | Annotated analysis

Uses pure PIL + numpy — no OpenCV or matplotlib required.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _jet(t):
    """Numpy jet colormap. t: ndarray [0,1] → RGB [0,1]."""
    import numpy as np
    r = np.clip(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0)
    return np.stack([r, g, b], axis=-1)


def _find_hotspot_bbox(cam_np, top_pct=0.20):
    """
    Find bounding box of the top `top_pct` activation region.
    Returns (x1, y1, x2, y2) in pixel coordinates.
    """
    import numpy as np
    threshold = np.percentile(cam_np, (1 - top_pct) * 100)
    mask = cam_np >= threshold
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    y1, y2 = np.where(rows)[0][[0, -1]]
    x1, x2 = np.where(cols)[0][[0, -1]]
    return int(x1), int(y1), int(x2), int(y2)


def generate_gradcam(
    image_bytes: bytes,
    model_instance,
    device,
    config: dict | None = None,
) -> Optional[str]:
    """
    Generate annotated Grad-CAM++ analysis image.
    Returns base64 PNG data URI or None on failure.
    """
    try:
        import base64

        import numpy as np
        import torch
        import torch.nn.functional as F
        import torchvision.transforms as transforms
        from PIL import Image as PILImage, ImageDraw, ImageFont

        # ── Config ────────────────────────────────────────────────────────────
        img_size = int((config or {}).get("img_size", 224))
        mean     = list((config or {}).get("mean", [0.485, 0.456, 0.406]))
        std      = list((config or {}).get("std",  [0.229, 0.224, 0.225]))

        transform = transforms.Compose([
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std),
        ])

        img_pil    = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
        img_tensor = transform(img_pil).unsqueeze(0).to(device)
        orig_resized = img_pil.resize((img_size, img_size), PILImage.BILINEAR)
        orig_np    = np.array(orig_resized) / 255.0  # (H,W,3)

        # ── Target layer: features[6] → 14×14, fine spatial detail ───────────
        if not hasattr(model_instance, "features"):
            return None
        try:
            target_layer = model_instance.features[6]
        except (IndexError, KeyError):
            target_layer = model_instance.features[-1]

        captured = {"act": None}

        def fwd_hook(module, inp, out):
            captured["act"] = out
            out.retain_grad()

        hook = target_layer.register_forward_hook(fwd_hook)

        model_instance.eval()
        model_instance.zero_grad()
        with torch.enable_grad():
            logit     = model_instance(img_tensor)
            score_val = float(torch.sigmoid(logit).item())
            logit.backward()

        hook.remove()

        act = captured["act"]
        if act is None:
            return None

        # ── Grad-CAM++ weights ────────────────────────────────────────────────
        if act.grad is not None:
            grad  = act.grad.detach()
            act_d = act.detach()
            grad2 = grad ** 2
            grad3 = grad ** 3
            act_sum   = act_d.sum(dim=(2, 3), keepdim=True)
            alpha     = grad2 / (2.0 * grad2 + act_sum * grad3 + 1e-7)
            alpha     = alpha * F.relu(grad)
            weights   = alpha.sum(dim=(2, 3), keepdim=True)
        else:
            act_d   = act.detach()
            weights = act_d.mean(dim=(2, 3), keepdim=True)

        cam = F.relu((weights * act_d).sum(dim=1, keepdim=True))

        c_min, c_max = cam.min(), cam.max()
        if (c_max - c_min).item() < 1e-8:
            return None
        cam = (cam - c_min) / (c_max - c_min + 1e-8)

        cam_up = F.interpolate(cam, size=(img_size, img_size),
                               mode="bilinear", align_corners=False)
        cam_np = cam_up.squeeze().cpu().numpy().astype(np.float32)

        # ── Threshold top 30% for overlay ─────────────────────────────────────
        thr = np.percentile(cam_np, 70)
        cam_thresh = np.where(cam_np >= thr, cam_np, 0.0)
        if cam_thresh.max() > 1e-8:
            cam_thresh = (cam_thresh - cam_thresh.min()) / (cam_thresh.max() - cam_thresh.min() + 1e-8)

        # ── Alpha blend ───────────────────────────────────────────────────────
        heatmap_rgb = _jet(cam_thresh)
        alpha_map   = (cam_thresh ** 0.6)[..., np.newaxis]
        blended     = np.clip((1 - alpha_map) * orig_np + alpha_map * heatmap_rgb, 0, 1)

        # ── Detect hotspot bounding box ───────────────────────────────────────
        is_tb   = score_val >= float((config or {}).get("threshold", 0.1453))
        has_hot = cam_np.max() > 0.3  # only draw box if there's meaningful activation

        bbox = None
        if has_hot:
            try:
                bbox = _find_hotspot_bbox(cam_np, top_pct=0.15)
            except Exception:
                bbox = None

        # ── Build final annotated image ───────────────────────────────────────
        PANEL_W = img_size
        PANEL_H = img_size
        HEADER  = 32   # dark header bar height
        FOOTER  = 26   # score bar

        total_w = PANEL_W * 2 + 4   # left panel + gap + right panel
        total_h = PANEL_H + HEADER + FOOTER

        canvas = np.zeros((total_h, total_w, 3), dtype=np.uint8)

        # Header background (dark)
        canvas[:HEADER, :, :] = 15

        # Footer background
        canvas[HEADER + PANEL_H:, :, :] = 12

        # Left panel: original (grayscale-ish for contrast)
        orig_uint8 = (orig_np * 255).astype(np.uint8)
        canvas[HEADER:HEADER + PANEL_H, :PANEL_W, :] = orig_uint8

        # Separator
        canvas[HEADER:HEADER + PANEL_H, PANEL_W:PANEL_W + 4, :] = 30

        # Right panel: heatmap overlay
        blend_uint8 = (blended * 255).astype(np.uint8)
        canvas[HEADER:HEADER + PANEL_H, PANEL_W + 4:, :] = blend_uint8

        result = PILImage.fromarray(canvas, "RGB")
        draw   = ImageDraw.Draw(result)

        # ── Load font ─────────────────────────────────────────────────────────
        try:
            font_lg = ImageFont.truetype("arial.ttf", 13)
            font_sm = ImageFont.truetype("arial.ttf", 10)
            font_bd = ImageFont.truetype("arialbd.ttf", 12)
        except Exception:
            font_lg = ImageFont.load_default()
            font_sm = font_lg
            font_bd = font_lg

        # ── Header labels ─────────────────────────────────────────────────────
        draw.text((6, 9),              "Original X-Ray",          fill=(160, 160, 160), font=font_sm)
        draw.text((PANEL_W + 10, 9),   "AI Analysis — Grad-CAM++", fill=(255, 160, 60),  font=font_sm)

        # ── Draw annotated bounding box on RIGHT panel ────────────────────────
        if bbox:
            x1, y1, x2, y2 = bbox
            rx1 = PANEL_W + 4 + x1
            ry1 = HEADER  + y1
            rx2 = PANEL_W + 4 + x2
            ry2 = HEADER  + y2

            # Pad box slightly
            pad = 6
            rx1 = max(PANEL_W + 4, rx1 - pad)
            ry1 = max(HEADER,       ry1 - pad)
            rx2 = min(total_w - 1,  rx2 + pad)
            ry2 = min(HEADER + PANEL_H - 1, ry2 + pad)

            box_color    = (239, 68, 68)   if is_tb else (34, 197, 94)
            box_color_dim = (180, 40, 40)  if is_tb else (20, 140, 60)

            # Outer glow (thick dim rectangle)
            for off in range(3, 0, -1):
                draw.rectangle(
                    [rx1 - off, ry1 - off, rx2 + off, ry2 + off],
                    outline=(*box_color_dim, 0), width=1,
                )

            # Main box (solid)
            draw.rectangle([rx1, ry1, rx2, ry2], outline=box_color, width=2)

            # Corner ticks
            tick = 10
            for (cx, cy, dx, dy) in [
                (rx1, ry1,  1,  1),
                (rx2, ry1, -1,  1),
                (rx1, ry2,  1, -1),
                (rx2, ry2, -1, -1),
            ]:
                draw.line([(cx, cy), (cx + dx * tick, cy)], fill=box_color, width=2)
                draw.line([(cx, cy), (cx, cy + dy * tick)], fill=box_color, width=2)

            # Label tag above box
            label_text = "⚠ TB Risk Region" if is_tb else "✓ Normal Region"
            tag_x  = rx1
            tag_y  = max(HEADER + 2, ry1 - 18)
            tag_w  = 120 if is_tb else 100
            tag_h  = 16

            draw.rectangle([tag_x, tag_y, tag_x + tag_w, tag_y + tag_h],
                           fill=box_color, outline=box_color)
            draw.text((tag_x + 4, tag_y + 2), label_text,
                      fill=(255, 255, 255), font=font_sm)

        # ── Score badge (top-right of analysis panel) ──────────────────────────
        score_pct  = f"{score_val * 100:.1f}%"
        badge_text = f"TB Score: {score_pct}"
        badge_color = (239, 68, 68) if is_tb else (34, 197, 94)
        bx = total_w - 120
        by = HEADER + 6
        draw.rectangle([bx - 4, by - 2, bx + 108, by + 14],
                       fill=(0, 0, 0, 0), outline=badge_color)
        draw.text((bx, by), badge_text, fill=badge_color, font=font_sm)

        # ── Footer: colorbar ───────────────────────────────────────────────────
        bar_y  = HEADER + PANEL_H + 6
        bar_x1 = PANEL_W + 4
        bar_x2 = total_w - 1
        bar_w  = bar_x2 - bar_x1
        for px in range(bar_w):
            t   = px / bar_w
            rgb = tuple(int(c * 255) for c in _jet(np.array([t]))[0])
            draw.line([(bar_x1 + px, bar_y), (bar_x1 + px, bar_y + 8)], fill=rgb)
        draw.text((bar_x1,          bar_y + 10), "Low",  fill=(100, 100, 100), font=font_sm)
        draw.text((bar_x1 + bar_w - 24, bar_y + 10), "High", fill=(239, 68, 68),   font=font_sm)
        draw.text((bar_x1 + bar_w // 2 - 30, bar_y + 10),
                  "Model Attention", fill=(130, 130, 130), font=font_sm)

        # ── Footer left: prediction label ──────────────────────────────────────
        pred_text  = "RESULT: TB INDICATORS DETECTED" if is_tb else "RESULT: NO TB INDICATORS"
        pred_color = (239, 68, 68) if is_tb else (34, 197, 94)
        draw.text((6, bar_y + 2), pred_text, fill=pred_color, font=font_bd)

        # ── Encode ────────────────────────────────────────────────────────────
        buf = io.BytesIO()
        result.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode("utf-8")

        logger.info("Grad-CAM++ annotated image: score=%.4f is_tb=%s bbox=%s",
                    score_val, is_tb, bbox)
        return f"data:image/png;base64,{encoded}"

    except Exception as exc:
        logger.error("Grad-CAM++ failed: %s", exc, exc_info=True)
        return None
