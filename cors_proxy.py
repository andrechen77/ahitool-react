import http.server
import requests

ALLOWED_ORIGIN = "http://localhost:5173"

class H(http.server.BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Credentials", "true")

    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        url = 'https://app.jobnimbus.com' + self.path

        # forward certain headers
        forward_headers = {}
        if "Authorization" in self.headers:
            forward_headers["Authorization"] = self.headers["Authorization"]

        # forward body
        body = None
        if "content-length" in self.headers:
            length = int(self.headers["content-length"])
            body = self.rfile.read(length)

        response = requests.get(url, headers=forward_headers, data=body)

        self.send_response(response.status_code)
        self._set_cors_headers()
        self.end_headers()

        self.wfile.write(response.content)

http.server.HTTPServer(('127.0.0.1', 8080), H).serve_forever()
