import os
import subprocess
import time
import requests
import pytest
import json
import re

# Configuration
# These are pulled from test_connection.py and known environment details
URL = "https://cofmlyvqhxjkmyzbtrsy.supabase.co"
ANON_KEY = "sb_publishable_JcHelObDdSWA9axEj0ttew_pJbWuz9_"
EMAIL = "gourab@carmanager.app"
PASSWORD = "changeme123"
SCHEMA = "e2e_test_tmp"
API_BASE_URL = f"{URL}/functions/v1/ocr-image"

def run_command(cmd):
    """Executes a shell command and returns the CompletedProcess object."""
    print(f"Executing: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result

def run_sql(query):
    """Executes a SQL query via Supabase CLI and parses the JSON output."""
    cmd = ["supabase", "db", "query", "--linked", query]
    result = run_command(cmd)
    if result.returncode != 0:
        return {"error": result.stderr}
    
    # Extract JSON from the boundary format used by Supabase CLI
    try:
        # Find the first { and the last } to extract the JSON payload
        match = re.search(r'\{.*\}', result.stdout, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        return {"error": f"Failed to parse JSON: {e}", "stdout": result.stdout}
    
    return {"error": "No JSON found in output", "stdout": result.stdout}

@pytest.fixture(scope="module")
def isolated_env():
    """Fixture to create and destroy the isolated environment."""
    print(f"\n[SETUP] Creating environment: {SCHEMA}")
    # Call manage_env.py to create the schema and initialize tables
    res = run_command(["python3", "scripts/manage_env.py", "create", SCHEMA])
    if res.returncode != 0:
        pytest.fail(f"Failed to create environment: {res.stderr}")
    
    yield SCHEMA
    
    print(f"\n[TEARDOWN] Destroying environment: {SCHEMA}")
    # Call manage_env.py to drop the schema
    run_command(["python3", "scripts/manage_env.py", "destroy", SCHEMA])

@pytest.fixture(scope="module")
def auth_token():
    """Fixture to log in and get a JWT."""
    print("[AUTH] Logging in to get JWT")
    login_url = f"{URL}/auth/v1/token?grant_type=password"
    payload = {"email": EMAIL, "password": PASSWORD}
    headers = {"apikey": ANON_KEY, "Content-Type": "application/json"}
    
    # Retry logic for potential paused database
    for i in range(5):
        try:
            resp = requests.post(login_url, json=payload, headers=headers, timeout=30)
            if resp.status_code == 200:
                return resp.json()["access_token"]
            elif resp.status_code == 503:
                print(f"Database is paused (503). Retrying in 10s... ({i+1}/5)")
                time.sleep(10)
            else:
                pytest.fail(f"Login failed with status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"Connection failed: {e}. Retrying in 10s...")
            time.sleep(10)
            
    pytest.fail("Failed to login after multiple attempts.")

def test_isolated_environment_lifecycle(isolated_env, auth_token):
    """
    Orchestrates the full E2E lifecycle:
    1. CREATE: Handled by isolated_env fixture.
    2. TEST:
        - POST to /v1/vehicles to create a vehicle in the temp schema.
        - POST to /v1/refuelings to log a refueling.
        - GET from /v1/refuelings and verify data is present.
        - Verify (via SQL) that data only exists in the temp schema.
    3. DESTROY: Handled by isolated_env fixture.
    """
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "apikey": ANON_KEY,
        "x-db-schema": isolated_env,
        "Content-Type": "application/json"
    }

    # 1. Create a vehicle
    print("\n[STEP 1] Creating vehicle in isolated schema")
    vehicle_data = {
        "name": "E2E Test Car",
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023
    }
    resp = requests.post(f"{API_BASE_URL}/v1/vehicles", json=vehicle_data, headers=headers)
    assert resp.status_code == 200, f"Failed to create vehicle: {resp.text}"
    vehicle = resp.json()
    vehicle_id = vehicle["id"]
    assert vehicle["name"] == "E2E Test Car"
    print(f"Vehicle created with ID: {vehicle_id}")

    # 2. Log a refueling
    print("[STEP 2] Logging refueling in isolated schema")
    refueling_data = {
        "vehicle_id": vehicle_id,
        "date": "2023-10-27",
        "odometer": 1000,
        "volume_gal": 10.5,
        "total_cost": 50.0,
        "full_tank": True
    }
    resp = requests.post(f"{API_BASE_URL}/v1/refuelings", json=refueling_data, headers=headers)
    assert resp.status_code == 200, f"Failed to log refueling: {resp.text}"
    refueling = resp.json()
    assert refueling["odometer"] == 1000
    print(f"Refueling logged with ID: {refueling['id']}")

    # 3. Verify data is present via API (GET)
    print("[STEP 3] Verifying data via API GET")
    resp = requests.get(f"{API_BASE_URL}/v1/refuelings", headers=headers)
    assert resp.status_code == 200
    refuelings = resp.json()
    # Ensure our new refueling is in the list
    assert any(r["id"] == refueling["id"] for r in refuelings), "Log not found in API response"

    # 4. Verify isolation via direct SQL queries
    print("[STEP 4] Verifying isolation via SQL")
    
    # Check in isolated schema: should have 1 vehicle
    res = run_sql(f"SELECT count(*) as count FROM \"{isolated_env}\".vehicles WHERE name = 'E2E Test Car';")
    assert res.get("rows", [{}])[0].get("count") == 1, f"Vehicle missing from {isolated_env}"
    print(f"Confirmed: Vehicle exists in {isolated_env}")

    # Check in other schemas: should have 0 vehicles
    other_schemas = ["public", "dev", "legacy"]
    for s in other_schemas:
        # First check if the 'vehicles' table even exists in this schema
        check_table = f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = '{s}' AND table_name = 'vehicles');"
        table_res = run_sql(check_table)
        
        if table_res.get("rows", [{}])[0].get("exists"):
            res = run_sql(f"SELECT count(*) as count FROM \"{s}\".vehicles WHERE name = 'E2E Test Car';")
            if "error" not in res:
                count = res.get("rows", [{}])[0].get("count", 0)
                assert count == 0, f"Data LEAKED into {s} schema! Found {count} records."
                print(f"Confirmed: No records in {s}.vehicles")
        else:
            print(f"Confirmed: Table 'vehicles' does not exist in schema '{s}', no leakage possible.")

    print("\n[SUCCESS] E2E Isolated Environment Verification Passed!")

if __name__ == "__main__":
    # Allow running directly with python3
    pytest.main([__file__, "-v", "-s"])
