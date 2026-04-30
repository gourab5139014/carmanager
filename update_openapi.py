import sys

def main():
    with open('openapi.yaml', 'r') as f:
        content = f.read()

    post_vehicle = """    post:
      summary: Create vehicle
      description: Create a new vehicle for the authenticated user.
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name: { type: string }
                make: { type: string }
                model: { type: string }
                year: { type: integer }
                active: { type: boolean, default: true }
      responses:
        '200':
          description: Successfully created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Vehicle'
"""

    if 'summary: Create vehicle' not in content:
        # insert before /v1/refuelings
        target = "  /v1/refuelings:"
        idx = content.find(target)
        content = content[:idx] + post_vehicle + "\n" + content[idx:]
        with open('openapi.yaml', 'w') as f:
            f.write(content)
        print("Updated openapi.yaml")
if __name__ == '__main__':
    main()
