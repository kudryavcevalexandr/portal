import http.server
import json
import socketserver
import subprocess
import threading

# Путь к логам Nginx (поправьте, если у вас другой)
NGINX_LOG = "/var/log/nginx/access.log"
LISTEN_PORT = 9999


class DebugHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            error_data = json.loads(post_data or b"{}")
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        print(f"\n[JS ERROR] {error_data.get('type')}: {error_data.get('msg')}")
        print(f"Location: {error_data.get('url')}")

        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        return  # Отключаем лишний мусор в консоли


def tail_nginx():
    print(f"--- Мониторинг логов Nginx: {NGINX_LOG} ---")

    proc = subprocess.Popen(["tail", "-f", NGINX_LOG], stdout=subprocess.PIPE)
    if not proc.stdout:
        return

    for line in iter(proc.stdout.readline, b""):
        decoded_line = line.decode("utf-8", errors="replace")
        if " 404 " in decoded_line or " 500 " in decoded_line:
            print(f"[SERVER ERROR] {decoded_line.strip()}")


if __name__ == "__main__":
    # Запускаем чтение логов Nginx в отдельном потоке
    threading.Thread(target=tail_nginx, daemon=True).start()

    # Запускаем сервер для приема ошибок из JS
    print(f"--- Запуск приемника логов JS на порту {LISTEN_PORT} ---")
    with socketserver.TCPServer(("", LISTEN_PORT), DebugHandler) as httpd:
        httpd.serve_forever()
