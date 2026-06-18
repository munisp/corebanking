"""biometric-service — entrypoint."""
import os
from http.server import HTTPServer
from api.main import Handler

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    print(f"[biometric-service] listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
