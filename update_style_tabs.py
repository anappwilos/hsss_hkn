import sys

file_path = 'src/style.css'
with open(file_path, 'r') as f:
    content = f.read()

sidebar_styles_marker = '/* =========================================================\n   27. NUEVO DISEÑO ADMIN (SIDEBAR + DASHBOARD)\n========================================================= */'

if sidebar_styles_marker in content:
    # Find the position of the marker and truncate everything after it
    # (assuming it was at the end of the file as per my previous cat >>)
    content = content.split(sidebar_styles_marker)[0]

# Add the new tab-based styles
new_tabs_css = '''
/* =========================================================
   27. DISEÑO ADMIN (PESTAÑAS)
========================================================= */

.admin-lotes-view .admin-panel-tabs {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0 0 32px;
  box-shadow: none;
}

.admin-lotes-view .admin-panel-tabs .chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  color: #546e7a;
  font-weight: 700;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.admin-lotes-view .admin-panel-tabs .chip .nav-icon {
  font-size: 1.1rem;
}

.admin-lotes-view .admin-panel-tabs .chip:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
}

.admin-lotes-view .admin-panel-tabs .chip.is-active {
  background: #e0f7fa; /* Light cyan */
  color: #00838f; /* Dark cyan */
  border-color: #b2ebf2;
  box-shadow: 0 4px 12px rgba(0, 131, 143, 0.1);
}

.admin-lotes-view .admin-panel-tabs .chip.is-active .nav-icon {
  color: #00838f;
}

.admin-topbar {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.admin-lotes-view .screen-content {
  max-width: 1200px;
  width: 100%;
}

@media (max-width: 768px) {
  .admin-lotes-view .admin-panel-tabs {
    flex-wrap: wrap;
  }
  .admin-lotes-view .admin-panel-tabs .chip {
    flex: 1 1 calc(50% - 8px);
    justify-content: center;
    padding: 0 10px;
    font-size: 0.85rem;
  }
}
'''

content += new_tabs_css

with open(file_path, 'w') as f:
    f.write(content)
print("Successfully updated src/style.css with tabbed styles")
