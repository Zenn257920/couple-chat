#!/usr/bin/env python3
"""Fetch the pooled Neon connection URI for kaung-portfolio and run
scripts/setup-chat-db.mjs with it.

The password is never printed or written to a file. It is passed only
in the environment of the child Node process. Same pattern as
~/workspace/neon-seed/seed.py.
"""
import os
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

BASE = "https://console.neon.tech/api/v2"
PROJECT_ID = "green-wind-56000506"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise RuntimeError("redirect refused")


def call(method, path, body=None):
    import json

    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.neon", allowed_hosts=["console.neon.tech"])
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=60) as resp:
        return read_json_response(resp)


def main():
    uri = None
    last_err = None
    for attempt in range(12):
        try:
            result = call(
                "GET",
                f"/projects/{PROJECT_ID}/connection_uri?database_name=neondb&role_name=neondb_owner&pooled=true",
            )
            uri = result.get("uri")
            if uri:
                break
        except Exception as e:
            last_err = e
            print(f"attempt {attempt + 1}: connection not ready yet ({e})", flush=True)
        time.sleep(10)
    if not uri:
        print(f"FAILED to get connection URI: {last_err}", file=sys.stderr)
        sys.exit(1)
    print("Got connection URI (password not shown). Creating chat tables...", flush=True)
    env = dict(os.environ)
    env["DATABASE_URL"] = uri
    proc = subprocess.run(
        ["node", "scripts/setup-chat-db.mjs"],
        cwd=os.path.expanduser("~/workspace/couple-chat"),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    print(proc.stdout, flush=True)
    if proc.returncode != 0:
        print(proc.stderr[:1000], file=sys.stderr, flush=True)
        sys.exit(1)
    print("SETUP OK", flush=True)


if __name__ == "__main__":
    main()
