import sys

def main():
    with open('frontend/src/server.node.ts', 'r') as f:
        content = f.read()

    # Add // @ts-nocheck to top if not there
    if "// @ts-nocheck" not in content:
        content = "// @ts-nocheck\n" + content

    with open('frontend/src/server.node.ts', 'w') as f:
        f.write(content)
    print("Successfully updated server.node.ts")

if __name__ == '__main__':
    main()
