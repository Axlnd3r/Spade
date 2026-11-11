#!/usr/bin/env bash
# Wasm-level check of the enclave's wasi:http client against a local server.
# Native FakeHttp tests cannot see host limits such as wasmtime's 4096-byte cap
# per blocking-write-and-flush (review S3, Critical-1). Run in WSL from
# enclave/appraiser; needs wasmtime and python3. Exit 0 = pass.
set -euo pipefail
cd "$(dirname "$0")/.."
target="${CARGO_TARGET_DIR:-target}"
cargo build -q --release --target wasm32-wasip2 --example http_probe
probe="$target/wasm32-wasip2/release/examples/http_probe.wasm"

port=18080
python3 - "$port" <<'PY' &
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.headers.get("Content-Length"):
            n = len(self.rfile.read(int(self.headers["Content-Length"])))
        else:  # chunked
            n = 0
            while (size := int(self.rfile.readline().strip(), 16)) > 0:
                n += len(self.rfile.read(size))
                self.rfile.readline()
            self.rfile.readline()
        self.reply(f"got {n}")
    def do_GET(self):
        self.reply("ok " + "y" * 200000)
    def reply(self, text):
        b = text.encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def log_message(self, *a):
        pass
HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
PY
server=$!
trap 'kill $server' EXIT
sleep 1

fail=0
for size in 100 4096 4097 12000 70000; do
  out=$(wasmtime run -S http "$probe" "http://127.0.0.1:$port/" "$size" 2>&1 || true)
  post=$(grep '^post ' <<<"$out" || echo "post <no output>")
  get=$(grep '^get ' <<<"$out" | cut -c1-30 || echo "get <no output>")
  if [[ "$post" == "post status=200 body=got $size" && "$get" == "get status=200 body=ok yyyyyy"* ]]; then
    echo "ok   size=$size"
  else
    echo "FAIL size=$size: $(cut -c1-80 <<<"$post") | $(cut -c1-40 <<<"$get") | $(tail -1 <<<"$out" | cut -c1-120)"
    fail=1
  fi
done
exit $fail
