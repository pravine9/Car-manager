"""Vercel Python function for the Car Tools plate reader (/tools).

POST /api/ocr with the image bytes as the body -> {"lines": [{"text", "confidence"}], "engine": "paddle", "ms"}
Reads the photo with the PaddleOCR models through RapidOCR (ONNX). Apple Vision is only in the
local Mac server (vehicle-score-app/server.py), so the engine query parameter is ignored here.
"""
import io
import json
import time
from http.server import BaseHTTPRequestHandler

import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

MAX_BYTES = 4_500_000  # Vercel request body limit
MAX_SIDE = 2000

# Load the models once per instance; Fluid Compute reuses warm instances
engine = RapidOCR()


def read_paddle(image):
    results, _ = engine(np.array(image))
    return [{"text": text, "confidence": round(float(conf), 2)} for _box, text, conf in (results or [])]


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        if not 0 < length <= MAX_BYTES:
            self.send_json(413 if length else 400, {"error": "Send one image of at most 4.5 MB"})
            return
        try:
            started = time.time()
            image = Image.open(io.BytesIO(self.rfile.read(length)))
            image.load()
            image = image.convert("RGB")
            if max(image.size) > MAX_SIDE:
                image.thumbnail((MAX_SIDE, MAX_SIDE))
            lines = read_paddle(image)
            self.send_json(200, {"lines": lines, "engine": "paddle", "ms": round((time.time() - started) * 1000)})
        except Exception as err:  # bad or unsupported image
            self.send_json(400, {"error": str(err)})
