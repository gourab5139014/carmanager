#!/usr/bin/env python3
import argparse
import subprocess
import sys
import os

def run_query(query):
    """Executes a SQL query using the Supabase CLI."""
    try:
        result = subprocess.run(
            ["supabase", "db", "query", "--linked", query],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error executing query: {e.stderr}", file=sys.stderr)
        sys.exit(1)

def create_env(name):
    """Creates a new environment (schema) and initializes it with the base schema."""
    print(f"Creating environment: {name}...")
    
    # 1. Create Schema
    run_query(f"CREATE SCHEMA \"{name}\";")
    
    # 2. Grant Usages
    run_query(f"GRANT USAGE ON SCHEMA \"{name}\" TO anon, authenticated, service_role;")
    
    # 3. Execute schema.sql within that schema
    schema_path = "supabase/schema.sql"
    if not os.path.exists(schema_path):
        print(f"Error: {schema_path} not found.", file=sys.stderr)
        sys.exit(1)
        
    with open(schema_path, "r") as f:
        schema_sql = f.read()
        
    combined_query = f"SET search_path TO \"{name}\", public;\n{schema_sql}"
    run_query(combined_query)
    
    print(f"Successfully created and initialized environment: {name}")

def destroy_env(name):
    """Destroys an environment (schema)."""
    print(f"Destroying environment: {name}...")
    run_query(f"DROP SCHEMA \"{name}\" CASCADE;")
    print(f"Successfully destroyed environment: {name}")

def list_envs():
    """Lists all non-system schemas."""
    system_schemas = (
        'information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 
        'pg_toast_temp_1', 'storage', 'auth', 'extensions', 'graphql', 
        'graphql_public', 'realtime', 'vault', 'public'
    )
    query = f"""
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN {system_schemas} 
    ORDER BY schema_name;
    """
    output = run_query(query)
    
    # Supabase CLI output usually includes headers or formatting. 
    # We'll just print the raw output for simplicity as requested.
    print("Available Environments:")
    print(output)

def main():
    parser = argparse.ArgumentParser(description="Supabase Environment Manager CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Create command
    create_parser = subparsers.add_parser("create", help="Create a new environment")
    create_parser.add_argument("name", help="Name of the environment (schema)")

    # Destroy command
    destroy_parser = subparsers.add_parser("destroy", help="Destroy an environment")
    destroy_parser.add_argument("name", help="Name of the environment (schema)")

    # List command
    subparsers.add_parser("list", help="List all environments")

    args = parser.parse_args()

    if args.command == "create":
        create_env(args.name)
    elif args.command == "destroy":
        destroy_env(args.name)
    elif args.command == "list":
        list_envs()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
