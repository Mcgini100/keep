"""Local yt-dlp contract test; requires yt-dlp on Python's import path.

Uses a synthetic byte fixture, not a real YouTube/Instagram video. Verifies
metadata reuse, header retention and final-path reporting, not media playback.
"""
import http.server
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest


class DownloadContract(unittest.TestCase):
    def test_metadata_reuse_and_final_path(self):
        requests = []
        payload = b'keep-download-contract-fixture' * 100

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append((self.path, self.headers.get('X-Keep-Test')))
                self.send_response(200)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args):
                pass

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                info = root / 'info.json'
                output = root / 'output-path.txt'
                info.write_text(json.dumps({
                    'id': 'fixture', 'title': 'Keep fixture', 'ext': 'mp4',
                    'extractor': 'generic', 'extractor_key': 'Generic',
                    'webpage_url': 'https://invalid.example/must-not-be-extracted',
                    'url': f'http://127.0.0.1:{server.server_port}/media.mp4',
                    'http_headers': {'X-Keep-Test': 'retained'},
                    'format_id': 'http', 'vcodec': 'avc1', 'acodec': 'mp4a',
                }))
                result = subprocess.run([
                    sys.executable, '-m', 'yt_dlp', '--ignore-config',
                    '--load-info-json', str(info), '--no-playlist',
                    '--print-to-file', 'after_move:filepath', str(output),
                    '-f', 'bv*+ba/b', '-S', 'vcodec:h264,acodec:m4a',
                    '--restrict-filenames', '--merge-output-format', 'mp4',
                    '--remux-video', 'mp4', '--fixup', 'never',
                    '-o', str(root / '%(title).80B [%(id)s].%(ext)s'),
                ], capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
                media = Path(output.read_text().strip())
                self.assertEqual(media.parent, root)
                self.assertEqual(media.read_bytes(), payload)
                self.assertEqual(requests, [('/media.mp4', 'retained')])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
