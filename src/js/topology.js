/* ============================================================
   TOPOLOGY BUILDER
   ============================================================ */

let bNodes = [];
let bEdges = [];
let nodeCounter = 0;
let connectMode = false;
let connectFirst = null;
let pickMode = null;
let senderId = null;
let receiverId = null;
let draggingNode = null;
let dragOffset = { x: 0, y: 0 };
let templateInsertCount = 0;

const svgNS = "http://www.w3.org/2000/svg";

function newNodeId() { return 'n' + (nodeCounter++); }

function deviceLabel(type) {
  const names = { pc: 'PC', laptop: 'Laptop', server: 'Server', router: 'Router', switch: 'Switch', hub: 'Hub', ap: 'AP', firewall: 'Firewall', cloud: 'Cloud' };
  const n = (names[type] || type);
  const count = bNodes.filter(x => x.type === type).length + 1;
  return `${n}-${count}`;
}

function addNode(type, x, y) {
  const n = { id: newNodeId(), type, label: deviceLabel(type), ip: randIp(), x, y };
  bNodes.push(n);
  renderCanvas();
  return n;
}

function removeNode(id) {
  bNodes = bNodes.filter(n => n.id !== id);
  bEdges = bEdges.filter(e => e.a !== id && e.b !== id);
  if (senderId === id) senderId = null;
  if (receiverId === id) receiverId = null;
  renderCanvas();
}

function addEdge(a, b, type) {
  if (a === b) return;
  if (bEdges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
  bEdges.push({ id: 'e' + a + '_' + b, a, b, type, failed: false });
  renderCanvas();
}

function removeEdge(id) {
  bEdges = bEdges.filter(e => e.id !== id);
  renderCanvas();
}

function renderCanvas() {
  const canvas = document.getElementById('builderCanvas');
  canvas.querySelectorAll('.device-node').forEach(el => el.remove());
  const svg = document.getElementById('edgeSvg');
  const rect = canvas.getBoundingClientRect();
  svg.setAttribute('width', rect.width);
  svg.setAttribute('height', rect.height);
  const g = document.getElementById('edgeGroup');
  g.innerHTML = '';

  bEdges.forEach(e => {
    const a = bNodes.find(n => n.id === e.a);
    const b = bNodes.find(n => n.id === e.b);
    if (!a || !b) return;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('class', 'edge-line ' + e.type + (e.failed ? ' failed' : ''));
    line.addEventListener('click', (ev) => { ev.stopPropagation();
      removeEdge(e.id); });
    line.dataset.id = e.id;
    g.appendChild(line);
  });

  bNodes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'device-node';
    if (n.id === senderId) el.classList.add('role-sender');
    if (n.id === receiverId) el.classList.add('role-receiver');
    if (pickMode) el.classList.add('picking');
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.dataset.id = n.id;
    el.innerHTML = `
      <div class="dn-circle">${DEVICE_ICON[n.type]}
        <div class="dn-del" data-del="${n.id}">✕</div>
        ${n.id === senderId ? '<div class="dn-role-badge src">SRC</div>' : ''}
        ${n.id === receiverId ? '<div class="dn-role-badge dst">DST</div>' : ''}
      </div>
      <div class="dn-label">${esc(n.label)}</div>
      <div class="dn-ip" data-ip="${n.id}">${n.ip}</div>`;
    canvas.appendChild(el);

    el.querySelector('.dn-del').addEventListener('click', (ev) => { ev.stopPropagation();
      removeNode(n.id); });
    el.querySelector('.dn-ip').addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      const val = prompt('Set IP address for ' + n.label, n.ip);
      if (val) { n.ip = val;
        renderCanvas(); }
    });
    el.addEventListener('mousedown', (ev) => {
      if (ev.target.closest('.dn-del') || ev.target.closest('.dn-ip')) return;
      draggingNode = n;
      const r = canvas.getBoundingClientRect();
      dragOffset = { x: ev.clientX - r.left + canvas.scrollLeft - n.x, y: ev.clientY - r.top + canvas.scrollTop - n.y };
      ev.preventDefault();
    });
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (connectMode) {
        if (!connectFirst) {
          connectFirst = n.id;
          el.querySelector('.dn-circle').style.outline = '3px solid var(--accent)';
        } else if (connectFirst !== n.id) {
          addEdge(connectFirst, n.id, document.getElementById('linkTypeSelect').value);
          connectFirst = null;
        }
        return;
      }
      if (pickMode === 'sender') {
        senderId = n.id;
        if (receiverId === n.id) receiverId = null;
        pickMode = null;
        document.getElementById('setSenderBtn').classList.remove('primary');
        renderCanvas();
        updateStartBtn();
        return;
      }
      if (pickMode === 'receiver') {
        receiverId = n.id;
        if (senderId === n.id) senderId = null;
        pickMode = null;
        document.getElementById('setReceiverBtn').classList.remove('primary');
        renderCanvas();
        updateStartBtn();
        return;
      }
      if (el.classList.contains('active-hop') && builderCtl) {
        builderCtl.openInspector();
      }
    });
  });

  document.getElementById('canvasStatus').textContent = `${bNodes.length} devices · ${bEdges.length} links`;
  updateStartBtn();
}

function updateStartBtn() {
  document.getElementById('startBuilderSimBtn').disabled = !(senderId && receiverId);
}

function growCanvasToFit() {
  const canvas = document.getElementById('builderCanvas');
  let maxX = 800,
    maxY = 520;
  bNodes.forEach(n => { maxX = Math.max(maxX, n.x + 120);
    maxY = Math.max(maxY, n.y + 100); });
  canvas.style.minWidth = maxX + 'px';
  canvas.style.minHeight = maxY + 'px';
}

function clearCanvas() {
  bNodes = [];
  bEdges = [];
  senderId = null;
  receiverId = null;
  nodeCounter = 0;
  templateInsertCount = 0;
  renderCanvas();
  hideBuilderSim();
  const canvas = document.getElementById('builderCanvas');
  if (canvas) { canvas.style.minWidth = '';
    canvas.style.minHeight = ''; }
}

function genTemplate(kind) {
  const W = document.getElementById('builderCanvas').clientWidth || 800;
  const H = 500;
  const col = templateInsertCount % 3;
  const row = Math.floor(templateInsertCount / 3);
  const baseX = col * 540 + 20;
  const baseY = row * 460 + 20;
  templateInsertCount++;
  const cx = baseX + 260;
  const cy = baseY + 230;

  if (kind === 'star') {
    const hub = addNode('switch', cx, cy);
    const types = ['pc', 'pc', 'laptop', 'server', 'router'];
    types.forEach((t, i) => {
      const a = (i / types.length) * Math.PI * 2;
      const n = addNode(t, cx + Math.cos(a) * 200, cy + Math.sin(a) * 170);
      addEdge(hub.id, n.id, 'ethernet');
    });
  } else if (kind === 'bus') {
    const n = 5;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const t = i === 0 ? 'server' : (i === n - 1 ? 'router' : 'pc');
      nodes.push(addNode(t, baseX + 40 + i * 110, cy));
    }
    for (let i = 0; i < n - 1; i++) addEdge(nodes[i].id, nodes[i + 1].id, 'ethernet');
  } else if (kind === 'ring') {
    const n = 6;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      nodes.push(addNode(i % 2 === 0 ? 'switch' : 'pc', cx + Math.cos(a) * 210, cy + Math.sin(a) * 170));
    }
    for (let i = 0; i < n; i++) addEdge(nodes[i].id, nodes[(i + 1) % n].id, 'fiber');
  } else if (kind === 'mesh') {
    const n = 5;
    const nodes = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      nodes.push(addNode('router', cx + Math.cos(a) * 190, cy + Math.sin(a) * 160));
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) addEdge(nodes[i].id, nodes[j].id, 'fiber');
    }
  } else if (kind === 'tree') {
    const root = addNode('router', cx, baseY + 60);
    const s1 = addNode('switch', cx - 160, baseY + 200);
    const s2 = addNode('switch', cx + 160, baseY + 200);
    addEdge(root.id, s1.id, 'ethernet');
    addEdge(root.id, s2.id, 'ethernet');
    [-1, 1].forEach(sign => {
      const s = sign < 0 ? s1 : s2;
      const leaf1 = addNode('pc', s.x - 70, baseY + 360);
      const leaf2 = addNode('pc', s.x + 70, baseY + 360);
      addEdge(s.id, leaf1.id, 'ethernet');
      addEdge(s.id, leaf2.id, 'ethernet');
    });
  } else if (kind === 'hybrid') {
    const backbone = addNode('router', cx, cy);
    const s1 = addNode('switch', cx - 220, cy - 120);
    const s2 = addNode('switch', cx + 220, cy - 120);
    addEdge(backbone.id, s1.id, 'fiber');
    addEdge(backbone.id, s2.id, 'fiber');
    const a1 = addNode('pc', cx - 320, cy - 40);
    const a2 = addNode('laptop', cx - 220, cy + 80);
    addEdge(s1.id, a1.id, 'ethernet');
    addEdge(s1.id, a2.id, 'wireless');
    const b1 = addNode('server', cx + 320, cy - 40);
    const b2 = addNode('pc', cx + 220, cy + 80);
    addEdge(s2.id, b1.id, 'ethernet');
    addEdge(s2.id, b2.id, 'ethernet');
    const cloud = addNode('cloud', cx, cy - 200);
    addEdge(backbone.id, cloud.id, 'fiber');
  }
  growCanvasToFit();
}