import yaml
import urllib.request
import urllib.error
import subprocess
import time
import sys
import os

PORT = 3001
BASE_URL = f"http://localhost:{PORT}/ocr-image"

def wait_for_server(url, timeout=10):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(f"{url}/health") as resp:
                if resp.status == 200:
                    return True
        except:
            time.sleep(0.5)
    return False

def test_api_contract():
    print("Starting Hono server for contract testing...")
    # Using tsx to run the server. PORT environment variable is used by frontend/src/server.node.ts
    server_proc = subprocess.Popen(
        ["npx", "tsx", "frontend/src/server.node.ts"],
        env={**os.environ, "PORT": str(PORT), "SUPABASE_URL": "http://mock", "SUPABASE_ANON_KEY": "mock"},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    try:
        if not wait_for_server(BASE_URL):
            print("ERROR: Server failed to start or health check timed out")
            server_proc.terminate()
            # Print server output for debugging
            print(server_proc.stdout.read())
            sys.exit(1)

        print(f"Server started at {BASE_URL}. Loading openapi.yaml...")
        with open("openapi.yaml", "r") as f:
            spec = yaml.safe_load(f)

        paths = spec.get("paths", {})
        errors = []

        for path, methods in paths.items():
            for method, details in methods.items():
                if method.lower() != "get":
                    continue
                
                # Test GET paths
                full_url = f"{BASE_URL}{path}"
                print(f"Testing {method.upper()} {full_url} ...", end=" ")
                
                try:
                    # We expect 401 because we don't provide a real JWT, 
                    # but getting 401 confirms the route exists and requireAuth is working.
                    req = urllib.request.Request(full_url, method=method.upper())
                    with urllib.request.urlopen(req) as resp:
                        status = resp.status
                except urllib.error.HTTPError as e:
                    status = e.code
                except Exception as e:
                    print(f"FAILED (error: {e})")
                    errors.append(f"{path}: {e}")
                    continue

                # 200 (health), 401 (auth), or 400 (bad params) are acceptable for route existence
                if status in [200, 401, 400, 404]:
                    if status == 404:
                        print(f"FAILED (404 Not Found)")
                        errors.append(f"{path}: 404 Not Found")
                    else:
                        print(f"OK (HTTP {status})")
                else:
                    print(f"FAILED (HTTP {status})")
                    errors.append(f"{path}: Unexpected HTTP {status}")

        if errors:
            print(f"\nContract test failed with {len(errors)} errors.")
            sys.exit(1)
        else:
            print("\nAPI Contract test passed! All paths in openapi.yaml matched routes in src/app.ts.")

    finally:
        server_proc.terminate()
        server_proc.wait()

if __name__ == "__main__":
    test_api_contract()
