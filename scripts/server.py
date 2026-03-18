import http.server
import socketserver
import os

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

Handler = MyHandler

print(f"Starting server at http://localhost:{PORT}")
print("Open this URL in your browser to use your wallet.")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()
