/* ============================================================
   MAIN APPLICATION - WIRES UP ALL VIEWS
   ============================================================ */

const ALL_TABS = ['home', 'demo', 'builder', 'encoding', 'framing', 'errordetect', 'errorcorrect', 'dashboard', 'reports', 'help'];
const TAB_VIEW_ID = {
  home: 'viewHome',
  demo: 'viewDemo',
  builder: 'viewBuilder',
  encoding: 'viewEncoding',
  framing: 'viewFraming',
  errordetect: 'viewErrorDetect',
  errorcorrect: 'viewErrorCorrect',
  dashboard: 'viewDashboard',
  reports: 'viewReports',
  help: 'viewHelp'
};

let demoCtl, builderCtl;

// ---- Theme ----
function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  document.getElementById('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('sim-theme', t);
}

// ---- Tab switching ----
function switchTab(tab) {
  document.querySelectorAll('#mainTabs button').forEach(x => x.classList.toggle('active', x.dataset.val === tab));
  ALL_TABS.forEach(t => document.getElementById(TAB_VIEW_ID[t]).classList.toggle('hidden', t !== tab));
  const heroStrip = document.getElementById('heroStrip');
  heroStrip.classList.toggle('hidden', !(tab === 'demo' || tab === 'builder'));
  if (tab === 'demo') {
    document.getElementById('heroTitle').textContent = 'Demo Simulation';
    document.getElementById('heroSub').textContent = 'A fixed two-PC network so you can see every layer, hop and bit without building anything first.';
  }
  if (tab === 'builder') {
    document.getElementById('heroTitle').textContent = 'Topology Builder';
    document.getElementById('heroSub').textContent = 'Design your own network, pick a sender and receiver, and watch the same packet-level simulation run across it.';
    // Reinitialize minimap when switching to builder tab
    setTimeout(() => {
      if (typeof initMinimap === 'function') {
        initMinimap();
      }
    }, 200);
  }
  if (tab === 'dashboard') renderDashboard();
}
window.switchTab = switchTab;

// ---- Model toggle ----
document.querySelectorAll('#modelToggle button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#modelToggle button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentModel = b.dataset.val;
    document.getElementById('chipModel').textContent = currentModel === 'OSI' ? 'OSI (7 Layers)' : 'TCP/IP (5 Layers)';
    if (demoCtl) {
      demoCtl.buildLayerRail();
      demoCtl.render();
    }
    if (builderCtl) {
      builderCtl.buildLayerRail();
      builderCtl.render();
    }
  });
});

// ---- Demo Simulation ----
const DEMO_NODES = [
  { id: 'pc1', label: 'PC-A (Sender)', sub: '192.168.1.10', x: 60, y: 75, type: 'pc' },
  { id: 'sw1', label: 'Switch', sub: 'L2', x: 250, y: 75, type: 'switch' },
  { id: 'r1', label: 'Router 1', sub: 'TTL -1', x: 440, y: 75, type: 'router' },
  { id: 'r2', label: 'Router 2', sub: 'TTL -1', x: 630, y: 75, type: 'router' },
  { id: 'r3', label: 'Router 3', sub: 'TTL -1', x: 820, y: 75, type: 'router' },
  { id: 'pc2', label: 'PC-B (Receiver)', sub: '192.168.2.20', x: 960, y: 75, type: 'pc' },
];

let demoPacketMarker;

function buildDemoTopoSvg() {
  const svg = document.getElementById('topoSvg');
  if (!svg) return;
  svg.innerHTML = '';
  for (let i = 0; i < DEMO_NODES.length - 1; i++) {
    const a = DEMO_NODES[i],
      b = DEMO_NODES[i + 1];
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('stroke', 'var(--line)');
    line.setAttribute('stroke-width', '3');
    line.id = 'demo-edge-' + i;
    svg.appendChild(line);
  }
  DEMO_NODES.forEach(n => {
    const g = document.createElementNS(svgNS, 'g');
    const shape = document.createElementNS(svgNS, 'circle');
    shape.setAttribute('cx', n.x);
    shape.setAttribute('cy', n.y);
    shape.setAttribute('r', 22);
    shape.setAttribute('fill', 'var(--panel)');
    shape.setAttribute('stroke', 'var(--line)');
    shape.setAttribute('stroke-width', '2');
    shape.id = 'demo-nodecircle-' + n.id;
    g.appendChild(shape);
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', n.x);
    txt.setAttribute('y', n.y + 6);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '18');
    txt.textContent = DEVICE_ICON[n.type] || '📡';
    g.appendChild(txt);
    const lbl = document.createElementNS(svgNS, 'text');
    lbl.setAttribute('class', 'node-label');
    lbl.setAttribute('x', n.x);
    lbl.setAttribute('y', n.y + 40);
    lbl.textContent = n.label;
    g.appendChild(lbl);
    const sub = document.createElementNS(svgNS, 'text');
    sub.setAttribute('class', 'node-sub');
    sub.setAttribute('x', n.x);
    sub.setAttribute('y', n.y + 52);
    sub.textContent = n.sub;
    sub.id = 'demo-nodesub-' + n.id;
    g.appendChild(sub);
    svg.appendChild(g);
  });
  demoPacketMarker = document.createElementNS(svgNS, 'circle');
  demoPacketMarker.setAttribute('r', '7');
  demoPacketMarker.setAttribute('fill', 'var(--accent)');
  demoPacketMarker.setAttribute('class', 'marker');
  demoPacketMarker.setAttribute('cx', DEMO_NODES[0].x);
  demoPacketMarker.setAttribute('cy', DEMO_NODES[0].y - 32);
  demoPacketMarker.style.cursor = 'pointer';
  demoPacketMarker.style.filter = 'drop-shadow(0 0 6px var(--accent))';
  demoPacketMarker.style.opacity = '0';
  demoPacketMarker.addEventListener('click', () => {
    if (demoCtl) demoCtl.openInspector();
  });
  svg.appendChild(demoPacketMarker);
}

function demoMoveMarker(nodeId, step) {
  const n = DEMO_NODES.find(x => x.id === nodeId);
  if (!n) return;
  
  // Check if this step has error info
  if (step && step.errorInfo) {
    if (step.errorInfo.hasErrors) {
      demoPacketMarker.setAttribute('fill', 'var(--bad)');
      demoPacketMarker.setAttribute('r', '10');
      demoPacketMarker.className = 'marker packet-lost';
      // Add status label
      const svg = document.getElementById('topoSvg');
      // Remove old label
      const oldLabel = document.getElementById('demo-error-label');
      if (oldLabel) oldLabel.remove();
      
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', n.x);
      label.setAttribute('y', n.y - 50);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--bad)');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'var(--mono)');
      label.setAttribute('font-weight', '700');
      label.textContent = `⚠️ ${step.errorInfo.errorSegments ? step.errorInfo.errorSegments.length : 0} error(s)`;
      label.id = 'demo-error-label';
      svg.appendChild(label);
      
      setTimeout(() => {
        const oldLabel = document.getElementById('demo-error-label');
        if (oldLabel) oldLabel.remove();
        demoPacketMarker.setAttribute('r', '7');
        demoPacketMarker.className = 'marker';
        demoPacketMarker.setAttribute('fill', 'var(--accent)');
      }, 3000);
    } else if (step.errorInfo.retransSegments && step.errorInfo.retransSegments.length > 0) {
      demoPacketMarker.setAttribute('fill', 'var(--warn)');
      demoPacketMarker.setAttribute('r', '9');
      demoPacketMarker.className = 'marker packet-retransmit';
      const svg = document.getElementById('topoSvg');
      // Remove old label
      const oldLabel = document.getElementById('demo-retrans-label');
      if (oldLabel) oldLabel.remove();
      
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', n.x);
      label.setAttribute('y', n.y - 50);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--warn)');
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'var(--mono)');
      label.setAttribute('font-weight', '700');
      label.textContent = `🔄 ${step.errorInfo.retransSegments.length} retransmitted`;
      label.id = 'demo-retrans-label';
      svg.appendChild(label);
      
      setTimeout(() => {
        const oldLabel = document.getElementById('demo-retrans-label');
        if (oldLabel) oldLabel.remove();
        demoPacketMarker.setAttribute('r', '7');
        demoPacketMarker.className = 'marker';
        demoPacketMarker.setAttribute('fill', 'var(--accent)');
      }, 3000);
    }
  }
  
  demoPacketMarker.setAttribute('cx', n.x);
  demoPacketMarker.setAttribute('cy', n.y - 32);
  demoPacketMarker.style.opacity = '1';
  
  for (let i = 0; i < DEMO_NODES.length - 1; i++) {
    const edge = document.getElementById('demo-edge-' + i);
    if (!edge) continue;
    const passed = DEMO_NODES.findIndex(x => x.id === nodeId) > i;
    const isCurrentEdge = DEMO_NODES.findIndex(x => x.id === nodeId) === i + 1;
    edge.setAttribute('stroke', (passed || isCurrentEdge) ? 'var(--accent)' : 'var(--line)');
    edge.setAttribute('stroke-width', (passed || isCurrentEdge) ? '4' : '3');
  }
  if (step && step.ttlUpdate) {
    const el = document.getElementById('demo-nodesub-' + step.ttlUpdate.node);
    if (el) el.textContent = 'TTL=' + step.ttlUpdate.ttl;
  }
  const c = document.getElementById('demo-nodecircle-' + nodeId);
  if (step && step.fatal) {
    if (c) c.setAttribute('stroke', 'var(--bad)');
    demoPacketMarker.setAttribute('fill', 'var(--bad)');
  } else {
    demoPacketMarker.setAttribute('fill', 'var(--accent)');
  }
}

function resetDemoTopo() {
  DEMO_NODES.forEach(n => {
    if (n.type === 'router') {
      const el = document.getElementById('demo-nodesub-' + n.id);
      if (el) el.textContent = 'TTL -1';
      const c = document.getElementById('demo-nodecircle-' + n.id);
      if (c) c.setAttribute('stroke', 'var(--line)');
    }
  });
  for (let i = 0; i < DEMO_NODES.length - 1; i++) {
    const edge = document.getElementById('demo-edge-' + i);
    if (edge) { edge.setAttribute('stroke', 'var(--line)');
      edge.setAttribute('stroke-width', '3'); }
  }
  if (demoPacketMarker) {
    demoPacketMarker.style.opacity = '0';
    demoPacketMarker.setAttribute('cx', DEMO_NODES[0].x);
    demoPacketMarker.setAttribute('cy', DEMO_NODES[0].y - 32);
    demoPacketMarker.className = 'marker';
    demoPacketMarker.setAttribute('fill', 'var(--accent)');
    demoPacketMarker.setAttribute('r', '7');
  }
  // Remove error labels
  const labels = document.querySelectorAll('#demo-error-label, #demo-retrans-label');
  labels.forEach(el => el.remove());
}

function demoCfg() {
  return {
    message: document.getElementById('msgInput').value || 'Hello',
    proto: document.getElementById('protoSelect').value,
    transport: document.getElementById('transportSelect').value,
    encoding: document.getElementById('encodingSelect').value,
    medium: document.getElementById('mediumSelect').value,
    loss: +document.getElementById('lossSlider').value,
    latency: +document.getElementById('latSlider').value,
    ber: +document.getElementById('berSlider').value,
    ttl: +document.getElementById('ttlSlider').value
  };
}

function initDemo() {
  buildDemoTopoSvg();
  demoCtl = makeSimController('', demoMoveMarker, resetDemoTopo, {
    getCfg: demoCfg,
    readyTitle: 'Type a message and hit Send',
    readyDesc: "The simulator pauses at every layer and hop so you can see exactly what's happening to your data."
  });
  demoCtl.buildLayerRail();
  demoCtl.render();

  document.getElementById('lossSlider').addEventListener('input', e => { document.getElementById('lossVal').textContent = e.target.value + '%'; });
  document.getElementById('latSlider').addEventListener('input', e => { document.getElementById('latVal').textContent = e.target.value + 'ms'; });
  document.getElementById('berSlider').addEventListener('input', e => { document.getElementById('berVal').textContent = e.target.value + '%'; });
  document.getElementById('ttlSlider').addEventListener('input', e => { document.getElementById('ttlVal').textContent = e.target.value; });
  document.getElementById('transportSelect').addEventListener('change', e => { document.getElementById('chipTransport').textContent = e.target.value; });

  document.getElementById('sendBtn').addEventListener('click', () => {
    resetDemoTopo();
    const c = demoCfg();
    const steps = buildStepsGeneric(c, DEMO_NODES, null, {});
    demoCtl.buildLayerRail();
    demoCtl.loadSteps(steps);
    recordRunStats(steps.meta, c);
  });
}

// ---- Builder Simulation ----
function bCfg() {
  return {
    message: document.getElementById('msgInput') ? document.getElementById('msgInput').value : 'Hello ChatGPT',
    proto: document.getElementById('protoSelect') ? document.getElementById('protoSelect').value : 'HTTP',
    transport: document.getElementById('transportSelectB').value,
    encoding: document.getElementById('encodingSelect') ? document.getElementById('encodingSelect').value : 'NRZ-L',
    medium: document.getElementById('mediumSelect') ? document.getElementById('mediumSelect').value : 'copper',
    loss: +document.getElementById('lossSliderB').value,
    latency: 40,
    ber: +document.getElementById('berSliderB').value,
    ttl: +document.getElementById('ttlSliderB').value
  };
}

function showBuilderSim() {
  document.getElementById('builderSimGrid').style.display = 'grid';
  document.getElementById('builderControls').style.display = 'block';
}

function hideBuilderSim() {
  document.getElementById('builderSimGrid').style.display = 'none';
  document.getElementById('builderControls').style.display = 'none';
}

function bMoveMarker(nodeId, step) {
  document.querySelectorAll('.device-node').forEach(el => el.classList.remove('active-hop'));
  const el = document.querySelector(`.device-node[data-id="${nodeId}"]`);
  if (el) el.classList.add('active-hop');
  
  // Update minimap
  if (typeof updateMinimapActive === 'function') {
    updateMinimapActive(nodeId);
  }
  
  // Show packet status on edge if there are errors
  if (step && step.errorInfo) {
    showPacketStatus(step.errorInfo);
  }
}

// Show packet status overlay
function showPacketStatus(errorInfo) {
  // Remove existing status labels
  document.querySelectorAll('.packet-status-overlay').forEach(el => el.remove());
  
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'packet-status-overlay';
  
  // Find the current edge position
  const activeNode = document.querySelector('.device-node.active-hop');
  if (activeNode) {
    const rect = activeNode.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const x = rect.left - canvasRect.left + rect.width/2;
    const y = rect.top - canvasRect.top - 20;
    
    const label = document.createElement('div');
    label.className = 'packet-status-label';
    label.style.left = x + 'px';
    label.style.top = y + 'px';
    
    if (errorInfo.hasErrors) {
      label.className += ' lost';
      label.textContent = `⚠️ ${errorInfo.errorSegments ? errorInfo.errorSegments.length : 0} bit error(s)`;
    } else if (errorInfo.retransSegments && errorInfo.retransSegments.length > 0) {
      label.className += ' retrans';
      label.textContent = `🔄 ${errorInfo.retransSegments.length} retransmitted`;
    } else {
      label.className += ' ok';
      label.textContent = '✓ OK';
    }
    overlay.appendChild(label);
  }
  
  canvas.appendChild(overlay);
  
  // Remove overlay after 3 seconds
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 3000);
}

function bResetTopo() {
  document.querySelectorAll('.device-node').forEach(el => el.classList.remove('active-hop'));
  document.querySelectorAll('.edge-line').forEach(l => l.classList.remove('on-path', 'dimmed'));
  document.querySelectorAll('.packet-status-overlay').forEach(el => el.remove());
  // Update minimap
  if (typeof updateMinimapActive === 'function') {
    updateMinimapActive(null);
  }
}

// Helper function for path finding
function findSimplePaths(nodes, edges, srcId, dstId, maxPaths = 3, maxDepth = 7) {
  const adj = {};
  nodes.forEach(n => adj[n.id] = []);
  edges.forEach(e => {
    if (!e.failed) {
      adj[e.a].push({ to: e.b, edge: e });
      adj[e.b].push({ to: e.a, edge: e });
    }
  });
  const results = [];

  function dfs(node, visited, path, edgePath) {
    if (results.length >= maxPaths) return;
    if (node === dstId) {
      results.push({ nodes: [...path], edges: [...edgePath] });
      return;
    }
    if (path.length > maxDepth) return;
    for (const { to, edge } of (adj[node] || [])) {
      if (visited.has(to)) continue;
      visited.add(to);
      path.push(to);
      edgePath.push(edge);
      dfs(to, visited, path, edgePath);
      path.pop();
      edgePath.pop();
      visited.delete(to);
      if (results.length >= maxPaths) return;
    }
  }

  dfs(srcId, new Set([srcId]), [srcId], []);
  return results;
}

function initBuilder() {
  document.getElementById('lossSliderB').addEventListener('input', e => document.getElementById('lossValB').textContent = e.target.value + '%');
  document.getElementById('berSliderB').addEventListener('input', e => document.getElementById('berValB').textContent = e.target.value + '%');
  document.getElementById('ttlSliderB').addEventListener('input', e => document.getElementById('ttlValB').textContent = e.target.value);

  // Toolbar events
  document.getElementById('connectModeBtn').addEventListener('click', (e) => {
    connectMode = !connectMode;
    connectFirst = null;
    e.target.textContent = '🔌 Connect Mode: ' + (connectMode ? 'On' : 'Off');
    e.target.classList.toggle('primary', connectMode);
    renderCanvas();
  });

  document.getElementById('setSenderBtn').addEventListener('click', (e) => {
    pickMode = pickMode === 'sender' ? null : 'sender';
    e.target.classList.toggle('primary', pickMode === 'sender');
    document.getElementById('setReceiverBtn').classList.remove('primary');
    renderCanvas();
  });

  document.getElementById('setReceiverBtn').addEventListener('click', (e) => {
    pickMode = pickMode === 'receiver' ? null : 'receiver';
    e.target.classList.toggle('primary', pickMode === 'receiver');
    document.getElementById('setSenderBtn').classList.remove('primary');
    renderCanvas();
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', () => {
    clearCanvas();
    // Update minimap
    if (typeof initMinimap === 'function') {
      setTimeout(() => initMinimap(), 100);
    }
  });

  document.querySelectorAll('.tpl-btn').forEach(b => {
    b.addEventListener('click', () => {
      genTemplate(b.dataset.tpl);
      // Update minimap
      if (typeof initMinimap === 'function') {
        setTimeout(() => initMinimap(), 100);
      }
    });
  });

  // Palette drag & drop
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', item.dataset.type); });
  });
  document.getElementById('builderCanvas').addEventListener('dragover', ev => ev.preventDefault());
  document.getElementById('builderCanvas').addEventListener('drop', (ev) => {
    ev.preventDefault();
    const type = ev.dataTransfer.getData('text/plain');
    if (!type) return;
    const canvas = document.getElementById('builderCanvas');
    const r = canvas.getBoundingClientRect();
    addNode(type, ev.clientX - r.left + canvas.scrollLeft, ev.clientY - r.top + canvas.scrollTop);
    growCanvasToFit();
    // Update minimap
    if (typeof initMinimap === 'function') {
      setTimeout(() => initMinimap(), 100);
    }
  });

  // Start simulation - FIXED VERSION
  document.getElementById('startBuilderSimBtn').addEventListener('click', function() {
    if (!senderId || !receiverId) {
      alert('Please select both a Sender and a Receiver device first.');
      return;
    }

    // Check if there's a path between sender and receiver
    const candidatePaths = findSimplePaths(bNodes, bEdges, senderId, receiverId, 3, 8);
    if (!candidatePaths.length) {
      alert('No path exists between the selected Sender and Receiver. Add a connection first.');
      return;
    }

    const costs = candidatePaths.map(p => pathCost(p, EDGE_TYPE_COST));
    const bestIdx = costs.indexOf(Math.min(...costs));
    const chosen = candidatePaths[bestIdx];
    const altPath = candidatePaths.find((p, i) => i !== bestIdx);
    const pathNodeObjs = chosen.nodes.map(id => bNodes.find(n => n.id === id));

    // Highlight chosen path on canvas
    document.querySelectorAll('.edge-line').forEach(l => l.classList.add('dimmed'));
    for (let i = 0; i < chosen.nodes.length - 1; i++) {
      const a = chosen.nodes[i];
      const b = chosen.nodes[i + 1];
      const line = [...document.querySelectorAll('.edge-line')].find(l => {
        const e = bEdges.find(e2 => e2.id === l.dataset.id);
        return e && ((e.a === a && e.b === b) || (e.a === b && e.b === a));
      });
      if (line) {
        line.classList.remove('dimmed');
        line.classList.add('on-path');
      }
    }

    showBuilderSim();
    if (!builderCtl) {
      builderCtl = makeSimControllerB(bMoveMarker, bResetTopo, { getCfg: bCfg });
    }
    builderCtl.buildLayerRail();
    const steps = buildStepsGeneric(bCfg(), pathNodeObjs, null, {
      candidatePaths,
      simulateFailure: document.getElementById('failLinkChk').checked,
      altPath
    });
    builderCtl.loadSteps(steps);
    recordRunStats(steps.meta, bCfg());
  });

  // Mouse move for dragging
  document.addEventListener('mousemove', (ev) => {
    if (!draggingNode) return;
    const canvas = document.getElementById('builderCanvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    let x = ev.clientX - r.left + canvas.scrollLeft - dragOffset.x;
    let y = ev.clientY - r.top + canvas.scrollTop - dragOffset.y;
    x = Math.max(20, x);
    y = Math.max(20, y);
    draggingNode.x = x;
    draggingNode.y = y;
    const el = canvas.querySelector(`.device-node[data-id="${draggingNode.id}"]`);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
    bEdges.forEach(e => {
      if (e.a === draggingNode.id || e.b === draggingNode.id) {
        const line = document.querySelector(`.edge-line[data-id="${e.id}"]`);
        if (line) {
          const a = bNodes.find(n => n.id === e.a);
          const b = bNodes.find(n => n.id === e.b);
          line.setAttribute('x1', a.x);
          line.setAttribute('y1', a.y);
          line.setAttribute('x2', b.x);
          line.setAttribute('y2', b.y);
        }
      }
    });
  });
  document.addEventListener('mouseup', () => {
    if (draggingNode) growCanvasToFit();
    draggingNode = null;
  });

  renderCanvas();
  
  // Initialize minimap
  setTimeout(() => {
    if (typeof initMinimap === 'function') {
      initMinimap();
    }
  }, 200);
}

// ---- Encoding Lab ----
let encActiveScheme = 'nrzl';

function initEncodingLab() {
  const list = document.getElementById('encSchemeList');
  if (!list) return;
  list.innerHTML = Object.keys(ENCODING_INFO).map(k =>
    `<div class="lab-scheme-item ${k === encActiveScheme ? 'active' : ''}" data-scheme="${k}"><span>${ENCODING_INFO[k].name}</span><span class="muted" style="margin-left:auto; font-size:10px;">${ENCODING_INFO[k].cat}</span></div>`
  ).join('');
  list.querySelectorAll('.lab-scheme-item').forEach(el => {
    el.addEventListener('click', () => {
      encActiveScheme = el.dataset.scheme;
      renderEncodingSingle();
    });
  });
  document.getElementById('encApplyBtn').addEventListener('click', renderEncodingSingle);
  document.getElementById('encCompareBtn').addEventListener('click', toggleEncodingCompare);
  renderEncodingSingle();
  buildEncodingCompareChecks();
}

function renderEncodingSingle() {
  document.querySelectorAll('#encSchemeList .lab-scheme-item').forEach(el =>
    el.classList.toggle('active', el.dataset.scheme === encActiveScheme)
  );
  const bits = cleanBits(document.getElementById('encBits').value) || '1101';
  document.getElementById('encActiveTitle').textContent = ENCODING_INFO[encActiveScheme].name;
  document.getElementById('encWaveBox').innerHTML = renderEncodingWaveform(bits, encActiveScheme);
  document.getElementById('encInfoBox').innerHTML = renderEncodingInfo(encActiveScheme);
}

function toggleEncodingCompare() {
  const cmp = document.getElementById('encCompareView');
  const single = document.getElementById('encSingleView');
  if (!cmp || !single) return;
  const showingCompare = cmp.classList.contains('hidden');
  cmp.classList.toggle('hidden', !showingCompare);
  single.classList.toggle('hidden', showingCompare);
  document.getElementById('encCompareBtn').textContent = showingCompare ? '🔙 Single Scheme View' : '🔍 Comparison Mode';
  if (showingCompare) renderEncodingCompare();
}

function buildEncodingCompareChecks() {
  const wrap = document.getElementById('encCompareChecks');
  if (!wrap) return;
  const defaults = ['nrzl', 'manchester', 'diffmanchester', 'mlt3', 'hdb3'];
  wrap.innerHTML = Object.keys(ENCODING_INFO).filter(k => !ENCODING_INFO[k].noWave).map(k =>
    `<label class="lab-scheme-item" style="cursor:pointer;"><input type="checkbox" value="${k}" ${defaults.includes(k) ? 'checked' : ''}> ${ENCODING_INFO[k].name}</label>`
  ).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', renderEncodingCompare));
}

function renderEncodingCompare() {
  const bits = cleanBits(document.getElementById('encBits').value) || '1101';
  const selected = [...document.querySelectorAll('#encCompareChecks input:checked')].map(c => c.value);
  const wavesEl = document.getElementById('encCompareWaves');
  if (!wavesEl) return;
  wavesEl.innerHTML = selected.map(k =>
    `<div class="compare-wave-row"><div class="compare-wave-label">${ENCODING_INFO[k].name}</div>${renderEncodingWaveform(bits, k)}</div>`
  ).join('') || '<div class="muted" style="padding:14px;">Select at least one scheme above.</div>';

  const rows = [
    ['Bandwidth', k => ['manchester', 'diffmanchester', 'rz'].includes(k) ? 'High (2× bit rate)' : ['twob1q', 'mlt3', 'fourb5b'].includes(k) ? 'Reduced (multi-bit/symbol)' : 'Moderate'],
    ['DC Component', k => ['nrzl', 'nrzi', 'unipolar', 'rz'].includes(k) ? 'Present' : 'None / minimal'],
    ['Clock Recovery', k => ENCODING_INFO[k].sync],
    ['Error Detection', k => ['ami', 'pseudoternary', 'b8zs', 'hdb3'].includes(k) ? 'Bipolar-violation based' : 'None inherent'],
    ['Complexity', k => ['b8zs', 'hdb3', 'fourb5b'].includes(k) ? 'High' : (['manchester', 'diffmanchester', 'twob1q', 'mlt3'].includes(k) ? 'Medium' : 'Low')],
    ['Typical Use', k => ENCODING_INFO[k].apps[0]],
  ];
  const table = document.getElementById('encCompareTable');
  if (!table) return;
  table.innerHTML = `<tr><th>Property</th>${selected.map(k => `<th>${ENCODING_INFO[k].name}</th>`).join('')}</tr>` +
    rows.map(([label, fn]) =>
      `<tr><td style="color:var(--text); font-weight:700;">${label}</td>${selected.map(k => `<td>${fn(k)}</td>`).join('')}</tr>`
    ).join('');
}

// ---- Framing Lab ----
function initFramingLab() {
  document.querySelectorAll('#framingModeToggle button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#framingModeToggle button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('byteFramingPanel').classList.toggle('hidden', b.dataset.val !== 'byte');
      document.getElementById('bitFramingPanel').classList.toggle('hidden', b.dataset.val !== 'bit');
      document.getElementById('framingResult').innerHTML = '';
    });
  });
  document.getElementById('frameByteBtn').addEventListener('click', runByteStuffing);
  document.getElementById('frameBitBtn').addEventListener('click', runBitStuffing);
}

// ---- Error Detection Lab (Parity / Checksum / CRC share one tab) ----
function initErrorDetectLab() {
  const panels = { parity: 'parityPanel', checksum: 'checksumPanel', crc: 'crcPanel' };
  const results = { parity: 'parityResult', checksum: 'checksumResult', crc: 'crcResult' };
  document.querySelectorAll('#errorDetectMethodToggle button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#errorDetectMethodToggle button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      Object.keys(panels).forEach(k => {
        document.getElementById(panels[k]).classList.toggle('hidden', k !== b.dataset.val);
        document.getElementById(results[k]).classList.toggle('hidden', k !== b.dataset.val);
      });
    });
  });
  document.getElementById('parityRunBtn').addEventListener('click', runParity);
  document.getElementById('parityInjectBtn').addEventListener('click', injectParityError);
  document.getElementById('checksumRunBtn').addEventListener('click', runChecksum);
  document.getElementById('checksumInjectBtn').addEventListener('click', injectChecksumError);
  document.getElementById('crcRunBtn').addEventListener('click', runCrc);
  document.getElementById('crcInjectBtn').addEventListener('click', injectCrcError);
  // Seed the first panel (Parity) with a result on first visit, like the other labs do.
  runParity();
}

// ---- Hamming Lab ----
function initHammingLab() {
  document.getElementById('hamEncodeBtn').addEventListener('click', runHammingEncode);
  document.getElementById('hamInjectBtn').addEventListener('click', runHammingInject);
  document.getElementById('hamCorrectBtn').addEventListener('click', runHammingCorrect);
}

// ---- Dashboard ----
function initDashboard() { renderDashboard(); }

// ---- Reports ----
function initReports() {
  document.getElementById('repGenBtn').addEventListener('click', generateReport);
}

// ---- Make minimap functions globally accessible ----
window.initMinimap = initMinimap;
window.updateMinimap = updateMinimap;
window.updateMinimapActive = updateMinimapActive;

// ---- INIT ----
(function() {
  const savedTheme = localStorage.getItem('sim-theme') || 'light';
  setTheme(savedTheme);
  document.getElementById('themeBtn').addEventListener('click', () => {
    setTheme(document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
  document.querySelectorAll('#mainTabs button').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.val));
  });
  document.getElementById('netTypeSelect').addEventListener('change', (e) => {
    const map = {
      lan_small: 'Latency and hop counts reflect a small home/office LAN.',
      lan_office: 'Simulating a typical office LAN with a switch and a router.',
      campus: 'Simulating a larger campus network with multiple routing hops.',
      wan: 'Simulating a WAN link — expect higher latency and more hops.',
      internet: 'Simulating a full Internet path across multiple autonomous systems.',
    };
    document.getElementById('heroSub').textContent = map[e.target.value] || '';
  });

  // Home tab buttons - handle feature card clicks
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => {
      const tab = card.getAttribute('onclick');
      if (tab) {
        // Extract the tab name from the onclick string
        const match = tab.match(/switchTab\('([^']+)'\)/);
        if (match) {
          switchTab(match[1]);
        }
      }
    });
  });

  // Initialize all labs
  initDemo();
  initBuilder();
  initEncodingLab();
  initFramingLab();
  initErrorDetectLab();
  initHammingLab();
  initDashboard();
  initReports();

  // Show home by default
  switchTab('home');
})();