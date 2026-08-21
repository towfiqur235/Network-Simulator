/* ============================================================
   TOPOLOGY MINIMAP - Navigation helper for builder
   ============================================================ */

function initMinimap() {
  const builderContainer = document.querySelector('.builder-layout');
  if (!builderContainer) return;
  
  // Remove existing minimap if any
  const existingMinimap = document.getElementById('builderMinimap');
  if (existingMinimap) existingMinimap.remove();
  
  // Create minimap container
  const minimap = document.createElement('div');
  minimap.className = 'builder-minimap';
  minimap.id = 'builderMinimap';
  
  // Add devices list
  const devicesDiv = document.createElement('div');
  devicesDiv.className = 'minimap-devices';
  devicesDiv.id = 'minimapDevices';
  
  // Add legend
  const legend = document.createElement('div');
  legend.className = 'minimap-legend';
  legend.innerHTML = `
    <span><span class="legend-dot green"></span> Sender</span>
    <span><span class="legend-dot red"></span> Receiver</span>
    <span><span class="legend-dot blue"></span> Active</span>
    <span><span class="legend-dot yellow"></span> Error</span>
  `;
  
  minimap.appendChild(devicesDiv);
  minimap.appendChild(legend);
  
  // Insert minimap at the top of the builder section
  const builderSection = document.getElementById('viewBuilder');
  builderSection.insertBefore(minimap, builderSection.firstChild);
  
  // Add scroll indicator
  const scrollIndicator = document.createElement('div');
  scrollIndicator.className = 'scroll-indicator';
  scrollIndicator.textContent = '⬇ Click to scroll to simulation controls ⬇';
  scrollIndicator.addEventListener('click', () => {
    const controls = document.getElementById('builderControls');
    if (controls) {
      controls.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      document.getElementById('builderSimGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  
  // Insert after minimap
  builderSection.insertBefore(scrollIndicator, minimap.nextSibling);
  
  // Initial render
  updateMinimap();
}

function updateMinimap() {
  const devicesDiv = document.getElementById('minimapDevices');
  if (!devicesDiv) return;
  
  devicesDiv.innerHTML = '';
  
  if (typeof bNodes === 'undefined' || bNodes.length === 0) {
    devicesDiv.innerHTML = '<span style="color:var(--muted2); font-size:10px; font-family:var(--mono);">No devices on canvas</span>';
    return;
  }
  
  bNodes.forEach(node => {
    const el = document.createElement('div');
    el.className = 'minimap-device';
    el.dataset.nodeId = node.id;
    
    if (node.id === senderId) el.classList.add('sender');
    if (node.id === receiverId) el.classList.add('receiver');
    
    // Check if this node is currently active in simulation
    const canvas = document.getElementById('builderCanvas');
    if (canvas) {
      const deviceEl = canvas.querySelector(`.device-node[data-id="${node.id}"].active-hop`);
      if (deviceEl) {
        el.classList.add('active-hop');
      }
    }
    
    el.innerHTML = `
      <span class="md-icon">${DEVICE_ICON[node.type] || '📡'}</span>
      <span class="md-label">${node.label}</span>
    `;
    
    // Click to scroll to device
    el.addEventListener('click', () => {
      const canvas = document.getElementById('builderCanvas');
      if (!canvas) return;
      const deviceEl = canvas.querySelector(`.device-node[data-id="${node.id}"]`);
      if (deviceEl) {
        const rect = deviceEl.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        canvas.scrollTo({
          left: rect.left - canvasRect.left - canvas.clientWidth/2 + rect.width/2,
          top: rect.top - canvasRect.top - canvas.clientHeight/2 + rect.height/2,
          behavior: 'smooth'
        });
        // Flash the device
        const circle = deviceEl.querySelector('.dn-circle');
        if (circle) {
          circle.style.animation = 'pickPulse 0.5s 2';
          setTimeout(() => {
            circle.style.animation = '';
          }, 1000);
        }
      }
    });
    
    devicesDiv.appendChild(el);
  });
}

function updateMinimapActive(nodeId) {
  document.querySelectorAll('#minimapDevices .minimap-device').forEach(el => {
    el.classList.remove('active-hop');
  });
  
  if (nodeId) {
    const el = document.querySelector(`#minimapDevices .minimap-device[data-node-id="${nodeId}"]`);
    if (el) {
      el.classList.add('active-hop');
    }
  }
}

// Make functions globally accessible
window.initMinimap = initMinimap;
window.updateMinimap = updateMinimap; 
window.updateMinimapActive = updateMinimapActive;