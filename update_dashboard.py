import sys

def main():
    with open('frontend/src/ui/dashboard.ts', 'r') as f:
        content = f.read()

    # 1. Add import
    if "import { renderVehicleManager }" not in content:
        content = "import { renderVehicleManager } from './VehicleManager';\n" + content

    # 2. Add "Manage Vehicles" button
    if 'id="manage-vehicles-btn"' not in content:
        target_html = """        <button id="logout-btn" style="background: none; border: 1px solid #333; color: #888; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Logout</button>"""
        replacement_html = """        <button id="manage-vehicles-btn" style="background: none; border: 1px solid #333; color: #888; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Manage Vehicles</button>
        <button id="logout-btn" style="background: none; border: 1px solid #333; color: #888; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Logout</button>"""
        content = content.replace(target_html, replacement_html)

    # 3. Add event listener
    if "manage-vehicles-btn')?.addEventListener('click'" not in content:
        target_js = """  document.querySelector('#logout-btn')?.addEventListener('click', logout);"""
        replacement_js = """  document.querySelector('#logout-btn')?.addEventListener('click', logout);
  document.querySelector('#manage-vehicles-btn')?.addEventListener('click', () => renderVehicleManager(app, () => renderDashboard(app)));"""
        content = content.replace(target_js, replacement_js)

    with open('frontend/src/ui/dashboard.ts', 'w') as f:
        f.write(content)
    print("Updated dashboard.ts")

if __name__ == '__main__':
    main()
