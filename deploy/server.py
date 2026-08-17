#!/usr/bin/env python3
"""
Simple HTTP server for testing Lace wallet connection.
Must be served from http://localhost for browser extensions to work.
"""

import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    print(f"🌙 Serving Lace wallet test server at http://localhost:{PORT}")
    print(f"📁 Directory: {DIRECTORY}")
    print("\nAvailable test pages:")
    print("1. http://localhost:8080/test-exact-api.html - Exact API test")
    print("2. http://localhost:8080/test-minimal.html - Minimal test")
    print("3. http://localhost:8080/diagnose.html - Full diagnostic")
    print("4. http://localhost:8080/index.html - Deployment UI")
    print("\n⚠️ IMPORTANT: Browser extensions often require http://localhost origin")
    print("   file:// URLs may not have access to Lace wallet extension")
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"\n✅ Server started. Press Ctrl+C to stop.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print(f"Port {PORT} might be in use. Try a different port:")
        print("  python server.py 8081")
        sys.exit(1)