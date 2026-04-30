import sys

def main():
    with open('frontend/src/api.ts', 'r') as f:
        content = f.read()

    insert_str = "  createVehicle: (data: any) => request('/v1/vehicles', { method: 'POST', body: JSON.stringify(data) }),\n"

    if "createVehicle" not in content:
        idx = content.find("getVehicles: () => request('/v1/vehicles'),")
        idx = content.find("\n", idx) + 1
        content = content[:idx] + insert_str + content[idx:]

        with open('frontend/src/api.ts', 'w') as f:
            f.write(content)
        print("Updated frontend/src/api.ts")
if __name__ == '__main__':
    main()
