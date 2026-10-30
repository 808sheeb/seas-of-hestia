#!/usr/bin/env python3
"""
Seas of Hestia local server.
  - serves this folder at http://127.0.0.1:8080 (replaces `python3 -m http.server`)
  - POST /print  {"text": "..."}  ->  prints the poem on the CSN-A2 thermal printer

No extra packages beyond python3-serial (already installed).
Test without a printer:  DRY_RUN=1 python3 server.py
"""
import http.server
import json
import os
import re
import threading
import unicodedata
import textwrap
from functools import partial

# ---------- settings you can edit ----------
PORT        = 8080
SERIAL_PORT = "/dev/serial0"
BAUD        = 19200
WIDTH       = 32      # characters per line (CSN-A2 default font on 58mm paper)
ALIGN       = 1       # 0 = left, 1 = centered (matches the on-screen look), 2 = right
HEADER      = ""      # text printed before the poem, e.g. "SEAS OF HESTIA"
FOOTER      = "minds@lockbearer"  # text printed after the poem
FEED_LINES  = 4       # blank lines at the end so you can tear the paper
# -------------------------------------------

DRY_RUN = os.environ.get("DRY_RUN") == "1"
ROOT = os.path.dirname(os.path.abspath(__file__))
print_lock = threading.Lock()

CHAR_MAP = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-", "\u2026": "...", "\u00a0": " ",
})


def to_ascii(s):
    s = s.translate(CHAR_MAP)
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


def wrap(text):
    text = re.sub(r"\n{3,}", "\n\n", to_ascii(text).replace("\r", "")).strip("\n")
    lines = []
    for line in text.split("\n"):
        line = line.strip()
        lines.extend(textwrap.wrap(line, WIDTH) if line else [""])
    return lines


def build_job(text):
    parts = []
    if HEADER:
        parts += wrap(HEADER) + [""]
    parts += wrap(text)
    if FOOTER:
        parts += [""] + wrap(FOOTER)
    body = "\n".join(parts) + "\n" + "\n" * FEED_LINES
    return b"\x1b@" + b"\x1ba" + bytes([ALIGN]) + body.encode("ascii")


def send_to_printer(data):
    if DRY_RUN:
        print("---- DRY RUN (would print) ----")
        print(data.decode("ascii", "replace"))
        print("-------------------------------")
        return
    import serial
    with print_lock:
        with serial.Serial(SERIAL_PORT, BAUD, timeout=2) as s:
            s.write(data)
            s.flush()


class Handler(http.server.SimpleHTTPRequestHandler):
    def _reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/print":
            return self._reply(404, {"error": "not found"})
        # requiring JSON forces a CORS preflight, so other websites can't trigger prints
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self._reply(415, {"error": "expected application/json"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 20000:
            return self._reply(413, {"error": "bad length"})
        try:
            text = str(json.loads(self.rfile.read(length)).get("text", ""))
            if not text.strip():
                return self._reply(400, {"error": "empty text"})
            send_to_printer(build_job(text))
            self._reply(200, {"ok": True})
        except Exception as e:  # serial missing, permissions, bad JSON...
            print("print failed:", repr(e))
            self._reply(500, {"error": str(e)})


if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), partial(Handler, directory=ROOT))
    print(f"Serving {ROOT} on http://127.0.0.1:{PORT}  (dry run: {DRY_RUN})")
    srv.serve_forever()
