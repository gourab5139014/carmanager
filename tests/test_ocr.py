"""
tests/test_ocr.py — integration tests for the ocr-image edge function.

These tests make real HTTP calls to the deployed Supabase edge function.
Run: pytest tests/test_ocr.py -v
     make test-ocr
"""

import base64
import json
import os
import subprocess
import tempfile
import urllib.request

import pytest

EDGE_URL  = "https://cofmlyvqhxjkmyzbtrsy.supabase.co/functions/v1/ocr-image"
ANON_KEY  = "sb_publishable_JcHelObDdSWA9axEj0ttew_pJbWuz9_"
HEIF_PATH = os.path.expanduser("~/Downloads/IMG_2337.heif")


# ── Helpers ───────────────────────────────────────────────────────────────────

def heif_to_jpeg_base64(path: str) -> str:
    """Convert a HEIF/HEIC file to JPEG base64 using macOS sips (no extra deps)."""
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92",
             path, "--out", tmp_path],
            check=True, capture_output=True,
        )
        with open(tmp_path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    finally:
        os.unlink(tmp_path)


def call_ocr(image_b64: str, ocr_type: str) -> dict:
    """POST base64 JPEG to the edge function, return parsed JSON."""
    payload = json.dumps({
        "image": image_b64,
        "mediaType": "image/jpeg",
        "type": ocr_type,
    }).encode()
    req = urllib.request.Request(
        EDGE_URL,
        data=payload,
        headers={
            "Content-Type":  "application/json",
            "Authorization": f"Bearer {ANON_KEY}",
            "apikey":        ANON_KEY,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def odometer_jpeg_b64():
    if not os.path.exists(HEIF_PATH):
        pytest.skip(f"Test image not found: {HEIF_PATH}")
    return heif_to_jpeg_base64(HEIF_PATH)


# ── Tests: HEIF conversion ────────────────────────────────────────────────────

def test_heif_converts_to_nonempty_jpeg(odometer_jpeg_b64):
    raw = base64.b64decode(odometer_jpeg_b64)
    # JPEG magic bytes: FF D8 FF
    assert raw[:3] == b"\xff\xd8\xff", "Output is not a valid JPEG"
    assert len(raw) > 10_000, "JPEG is suspiciously small"


# ── Tests: OCR edge function ─────────────────────────────────────────────────

def test_odometer_returns_json(odometer_jpeg_b64):
    result = call_ocr(odometer_jpeg_b64, "odometer")
    assert isinstance(result, dict), f"Expected dict, got: {result}"


def test_odometer_reading_extracted(odometer_jpeg_b64):
    result = call_ocr(odometer_jpeg_b64, "odometer")
    assert "odometer" in result, f"Missing 'odometer' key in: {result}"
    assert result["odometer"] is not None, \
        f"Odometer was null. error={result.get('error')}"


def test_odometer_is_plausible(odometer_jpeg_b64):
    result = call_ocr(odometer_jpeg_b64, "odometer")
    odo = result.get("odometer")
    assert isinstance(odo, (int, float)), f"Odometer not a number: {odo}"
    # Car has ~220k miles; allow a wide range for OCR tolerance
    assert 100_000 < odo < 500_000, f"Odometer out of plausible range: {odo}"


def test_invalid_image_returns_null_not_crash():
    """1×1 white PNG — too small to read, should return null gracefully (not 500)."""
    tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    payload = json.dumps({
        "image": tiny_png,
        "mediaType": "image/png",   # must match actual bytes
        "type": "odometer",
    }).encode()
    req = urllib.request.Request(
        EDGE_URL, data=payload,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {ANON_KEY}", "apikey": ANON_KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
    assert isinstance(result, dict)
    assert result.get("odometer") is None
