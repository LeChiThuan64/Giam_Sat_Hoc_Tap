#!/usr/bin/env python3
"""Simple HTTP Server for FocusAI - Run this to start the app"""

import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🚀 FocusAI v1.1 Server started!")
        print(f"📍 Open browser: http://localhost:{PORT}")
        print(f"📁 Serving from: {DIRECTORY}")
        print(f"⏹️  Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n✅ Server stopped.")
            sys.exit(0)

if __name__ == "__main__":
    run_server()
