/* ============================================================
   PERFORMANCE DASHBOARD
   ============================================================ */

let dashStats = {
  sent: 0,
  delivered: 0,
  dropped: 0,
  retransmitted: 0,
  runs: 0,
  successRuns: 0,
  lastRun: null,
  history: []
};

function recordRunStats(meta, cfg) {
  if (!meta) return;
  dashStats.sent += meta.sent;
  dashStats.delivered += meta.delivered;
  dashStats.dropped += meta.lost + (meta.ttlDropped ? 1 : 0);
  dashStats.retransmitted += meta.retransmitted;
  dashStats.runs += 1;
  if (meta.success) dashStats.successRuns += 1;
  dashStats.lastRun = {
    ...meta,
    protocol: cfg.transport,
    encoding: cfg.encoding,
    ttl: cfg.ttl,
    time: new Date().toLocaleTimeString()
  };
  dashStats.history.unshift(dashStats.lastRun);
  dashStats.history = dashStats.history.slice(0, 12);
  renderDashboard();
}

function renderDashboard() {
  const grid = document.getElementById('dashStatGrid');
  if (!grid) return;
  const successRate = dashStats.runs ? Math.round(100 * dashStats.successRuns / dashStats.runs) : 0;
  const cards = [
    ['Simulation Runs', dashStats.runs],
    ['Segments Sent', dashStats.sent],
    ['Delivered', dashStats.delivered],
    ['Dropped', dashStats.dropped],
    ['Retransmissions', dashStats.retransmitted],
    ['Success Rate', successRate + '%'],
    ['Current Protocol', dashStats.lastRun ? dashStats.lastRun.protocol : '—'],
    ['Current Encoding', dashStats.lastRun ? dashStats.lastRun.encoding : '—'],
  ];
  grid.innerHTML = cards.map(([l, v]) =>
    `<div class="stat-card"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`
  ).join('');

  const bars = document.getElementById('dashBars');
  const total = Math.max(1, dashStats.sent);
  const barsData = [
    ['Delivered', dashStats.delivered, 'var(--ok)'],
    ['Dropped', dashStats.dropped, 'var(--bad)'],
    ['Retransmitted', dashStats.retransmitted, 'var(--warn)']
  ];
  bars.innerHTML = barsData.map(([l, v, c]) =>
    `<div class="bar-row"><div class="bar-label">${l}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, 100 * v / total)}%; background:${c}"></div></div><span class="mono muted" style="width:34px; text-align:right;">${v}</span></div>`
  ).join('');

  const runLog = document.getElementById('dashRunLog');
  runLog.innerHTML = dashStats.history.map(r =>
    `<div class="log-item">[${r.time}] ${r.protocol}/${r.encoding} — sent ${r.sent}, delivered ${r.delivered}, lost ${r.lost}${r.ttlDropped ? ' (TTL expired)' : ''}${r.retransmitted ? `, retransmitted ${r.retransmitted}` : ''} — ${r.success ? '✓ success' : '✕ incomplete'}</div>`
  ).join('') || '<div class="insp-empty">No runs yet — try Demo Simulation or Topology Builder.</div>';
}