/* ============================================================
   SIMULATION CONTROLLERS
   ============================================================ */

function makeSimController(prefix, moveMarkerFn, resetTopoFn, extra) {
  extra = extra || {};
  const ctl = { steps: [], idx: -1, playing: false, timer: null, inspectorPinned: false };
  const $ = id => document.getElementById(prefix + id);

  function render() {
    if (ctl.idx < 0 || !ctl.steps[ctl.idx]) {
      $('stepBadge').textContent = 'READY';
      $('stepTitle').textContent = extra.readyTitle || 'Ready';
      $('stepDesc').textContent = extra.readyDesc || '';
      $('visualBox').innerHTML = '';
      setActiveLayer(null);
      if (resetTopoFn) resetTopoFn();
      updateProgress();
      // Clear status badges
      const badge = $('stepBadge');
      if (badge) {
        badge.querySelectorAll('.status-badge').forEach(el => el.remove());
      }
      return;
    }
    const s = ctl.steps[ctl.idx];
    $('stepBadge').textContent = s.badge;
    $('stepBadge').style.setProperty('--lc', s.layer ? getLayerColorVar(s.layer) : 'var(--accent)');
    $('stepTitle').textContent = s.title;
    $('stepDesc').textContent = s.desc;
    $('visualBox').innerHTML = s.render();
    
    // Check for error info and display indicators
    if (s.errorInfo) {
      const box = $('visualBox');
      
      // Remove any existing indicators
      box.querySelectorAll('.bit-error-indicator, .retransmit-indicator').forEach(el => el.remove());
      
      if (s.errorInfo.hasErrors) {
        // Add error indicator
        const indicator = document.createElement('div');
        indicator.className = 'bit-error-indicator';
        indicator.textContent = '⚠️';
        indicator.title = `Bit errors in segments: ${s.errorInfo.errorSegments ? s.errorInfo.errorSegments.join(', ') : 'unknown'}`;
        box.appendChild(indicator);
        
        // Add status badge to step badge
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge lost';
          statusSpan.textContent = '⚠️ ERROR';
          badge.appendChild(statusSpan);
        }
      } else if (s.errorInfo.retransSegments && s.errorInfo.retransSegments.length > 0) {
        // Add retransmit indicator
        const indicator = document.createElement('div');
        indicator.className = 'retransmit-indicator';
        indicator.textContent = '🔄';
        indicator.title = `Retransmitted segments: ${s.errorInfo.retransSegments.join(', ')}`;
        box.appendChild(indicator);
        
        // Add status badge to step badge
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge retrans';
          statusSpan.textContent = '🔄 RETRANS';
          badge.appendChild(statusSpan);
        }
      } else {
        // Everything is OK
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge ok';
          statusSpan.textContent = '✅ OK';
          badge.appendChild(statusSpan);
        }
      }
      
      // Show lost segments info if any
      if (s.errorInfo.lostSegments && s.errorInfo.lostSegments.length > 0) {
        const badge = $('stepBadge');
        if (badge) {
          const lostSpan = document.createElement('span');
          lostSpan.className = 'status-badge lost';
          lostSpan.textContent = `💀 ${s.errorInfo.lostSegments.length} lost`;
          lostSpan.style.marginLeft = '4px';
          badge.appendChild(lostSpan);
        }
      }
    } else {
      // No error info, just show OK
      const badge = $('stepBadge');
      if (badge) {
        badge.querySelectorAll('.status-badge').forEach(el => el.remove());
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-badge ok';
        statusSpan.textContent = '✅ OK';
        badge.appendChild(statusSpan);
      }
    }
    
    setActiveLayer(s.layer);
    if (s.topo && moveMarkerFn) moveMarkerFn(s.topo, s);
    updateLog();
    updateProgress();
    if (ctl.inspectorPinned) renderInspector(s);
  }

  function setActiveLayer(layerKey) {
    const mapped = layerKey ? mapLayerKey(layerKey) : null;
    activeLayers().forEach(l => {
      const row = document.getElementById(prefix + 'layer-' + l.key);
      if (!row) return;
      row.classList.remove('active');
      if (mapped && l.key === mapped) row.classList.add('active');
      if (mapped) {
        const li = activeLayers().findIndex(x => x.key === mapped);
        const ti = activeLayers().findIndex(x => x.key === l.key);
        if (ti < li) row.classList.add('done');
        else if (!(l.key === mapped)) row.classList.remove('done');
      } else row.classList.remove('done');
    });
  }

  function updateLog() {
    const list = $('logList');
    list.innerHTML = '';
    for (let i = 0; i <= ctl.idx; i++) {
      const item = document.createElement('div');
      item.className = 'log-item' + (i === ctl.idx ? ' now' : '');
      
      // Add error indicators to log items
      const step = ctl.steps[i];
      let logText = `[${String(i + 1).padStart(2, '0')}] ${step.log}`;
      
      if (step.errorInfo) {
        if (step.errorInfo.hasErrors) {
          logText = '⚠️ ' + logText;
          item.style.borderLeftColor = 'var(--bad)';
        } else if (step.errorInfo.retransSegments && step.errorInfo.retransSegments.length > 0) {
          logText = '🔄 ' + logText;
          item.style.borderLeftColor = 'var(--warn)';
        }
      }
      
      item.textContent = logText;
      list.appendChild(item);
    }
    list.scrollTop = list.scrollHeight;
  }

  function updateProgress() {
    const total = ctl.steps.length,
      cur = ctl.idx + 1;
    $('stepCounter').textContent = `Step ${Math.max(cur, 0)} / ${total}`;
    $('progressFill').style.width = total ? `${(Math.max(cur, 0) / total) * 100}%` : '0%';
    $('btnBack').disabled = ctl.idx <= 0;
    $('btnFwd').disabled = ctl.idx >= ctl.steps.length - 1 || ctl.steps.length === 0;
  }

  function renderInspector(s) {
    const box = $('inspector');
    const c = extra.getCfg();
    const hex = strToHex(c.message);
    const bin = strToBin(c.message);
    
    // Build header info with error details if available
    let errorHtml = '';
    if (s.errorInfo) {
      errorHtml = `<div class="insp-section-title" style="--lc:var(--bad);">Error Status</div>`;
      if (s.errorInfo.hasErrors) {
        errorHtml += `<div class="insp-field"><span>Bit Errors</span><span style="color:var(--bad);">⚠️ ${s.errorInfo.errorSegments ? s.errorInfo.errorSegments.length : 0} segment(s)</span></div>`;
      }
      if (s.errorInfo.retransSegments && s.errorInfo.retransSegments.length > 0) {
        errorHtml += `<div class="insp-field"><span>Retransmissions</span><span style="color:var(--warn);">🔄 ${s.errorInfo.retransSegments.length} segment(s)</span></div>`;
      }
      if (s.errorInfo.lostSegments && s.errorInfo.lostSegments.length > 0) {
        errorHtml += `<div class="insp-field"><span>Lost Segments</span><span style="color:var(--bad);">💀 ${s.errorInfo.lostSegments.length} segment(s)</span></div>`;
      }
      if (s.errorInfo.transport) {
        errorHtml += `<div class="insp-field"><span>Transport</span><span>${s.errorInfo.transport}</span></div>`;
      }
      if (s.errorInfo.recoveryMethod) {
        errorHtml += `<div class="insp-field"><span>Recovery</span><span>${s.errorInfo.recoveryMethod}</span></div>`;
      }
    }
    
    let headerHtml = (s.headers && s.headers.length) ?
      s.headers.map(h => `<div class="insp-field"><span>${h.label} header</span><span style="color:${h.color}">attached</span></div>`).join('') :
      `<div class="insp-field"><span>Headers</span><span class="muted">none at this stage</span></div>`;
      
    box.innerHTML = `<div class="insp-section-title" style="--lc:${s.layer ? getLayerColorVar(s.layer) : 'var(--accent)'}">Current Layer</div>
      <div class="insp-field"><span>Stage</span><span>${s.badge}</span></div>
      ${headerHtml}
      ${errorHtml}
      <div class="insp-section-title">Payload</div>
      <div class="insp-field"><span>Text</span><span>${esc(c.message)}</span></div>
      <div class="insp-field"><span>Protocol</span><span>${c.proto} / ${c.transport}</span></div>
      <div class="insp-field"><span>TTL start</span><span>${c.ttl}</span></div>
      ${s.errorInfo && s.errorInfo.finalMessage ? `<div class="insp-field"><span>Received</span><span style="color:${s.errorInfo.messageComplete ? 'var(--ok)' : 'var(--bad)'}">${esc(s.errorInfo.finalMessage)}</span></div>` : ''}
      <div class="insp-hex">HEX&#10;${hex}</div><div class="insp-hex">BIN&#10;${bin}</div>`;
  }

  function goto(i) { ctl.idx = Math.max(-1, Math.min(ctl.steps.length - 1, i));
    render(); }

  function stepForward() { if (ctl.idx < ctl.steps.length - 1) goto(ctl.idx + 1);
    else pause(); }

  function stepBack() { if (ctl.idx > 0) goto(ctl.idx - 1); }

  function play() {
    if (ctl.steps.length === 0) return;
    ctl.playing = true;
    $('btnPlay').textContent = '⏸ Pause';
    const speed = parseFloat($('speedSlider').value);
    clearInterval(ctl.timer);
    ctl.timer = setInterval(() => { if (ctl.idx >= ctl.steps.length - 1) { pause(); return; } stepForward(); }, 1400 / speed);
  }

  function pause() { ctl.playing = false;
    $('btnPlay').textContent = '▶ Play';
    clearInterval(ctl.timer); }

  function replay() { pause();
    goto(0); }

  function openInspector() { if (ctl.idx < 0 || !ctl.steps[ctl.idx]) return;
    ctl.inspectorPinned = true;
    renderInspector(ctl.steps[ctl.idx]); }

  function loadSteps(newSteps) {
    ctl.steps = newSteps;
    ctl.idx = -1;
    ctl.inspectorPinned = false;
    $('inspector').innerHTML = '<div class="insp-empty">Click the moving packet at any point to see its full header stack in hex &amp; binary.</div>';
    pause();
    goto(0);
    play();
  }

  function buildLayerRail() {
    const rail = document.getElementById(prefix + 'layerRail');
    if (!rail) return;
    rail.innerHTML = '';
    activeLayers().forEach(l => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.id = prefix + 'layer-' + l.key;
      row.style.setProperty('--lc', l.color);
      row.innerHTML = `<span class="layer-dot"></span><span class="layer-name">${l.name}</span>`;
      rail.appendChild(row);
    });
  }

  $('btnPlay').addEventListener('click', () => ctl.playing ? pause() : play());
  $('btnFwd').addEventListener('click', () => { pause();
    stepForward(); });
  $('btnBack').addEventListener('click', () => { pause();
    stepBack(); });
  $('btnReplay').addEventListener('click', replay);
  $('speedSlider').addEventListener('input', e => {
    $('speedLabel').textContent = parseFloat(e.target.value).toFixed(2) + '×';
    if (ctl.playing) play();
  });

  return { ctl, render, loadSteps, openInspector, pause, buildLayerRail };
}

function makeSimControllerB(moveMarkerFn, resetTopoFn, extra) {
  extra = extra || {};
  const ctl = { steps: [], idx: -1, playing: false, timer: null, inspectorPinned: false };
  const ids = {
    stepBadge: 'stepBadgeB',
    stepTitle: 'stepTitleB',
    stepDesc: 'stepDescB',
    visualBox: 'visualBoxB',
    logList: 'logListB',
    inspector: 'inspectorB',
    progressFill: 'progressFillB',
    stepCounter: 'stepCounterB',
    btnPlay: 'btnPlayB',
    btnFwd: 'btnFwdB',
    btnBack: 'btnBackB',
    btnReplay: 'btnReplayB',
    speedSlider: 'speedSliderB',
    speedLabel: 'speedLabelB'
  };
  const $ = key => document.getElementById(ids[key]);

  function render() {
    if (ctl.idx < 0 || !ctl.steps[ctl.idx]) {
      $('stepBadge').textContent = 'READY';
      $('stepTitle').textContent = 'Ready';
      $('stepDesc').textContent = '';
      $('visualBox').innerHTML = '';
      setActiveLayer(null);
      if (resetTopoFn) resetTopoFn();
      updateProgress();
      // Clear status badges
      const badge = $('stepBadge');
      if (badge) {
        badge.querySelectorAll('.status-badge').forEach(el => el.remove());
      }
      return;
    }
    const s = ctl.steps[ctl.idx];
    $('stepBadge').textContent = s.badge;
    $('stepBadge').style.setProperty('--lc', s.layer ? getLayerColorVar(s.layer) : 'var(--accent)');
    $('stepTitle').textContent = s.title;
    $('stepDesc').textContent = s.desc;
    $('visualBox').innerHTML = s.render();
    
    // Check for error info and display indicators
    if (s.errorInfo) {
      const box = $('visualBox');
      
      // Remove any existing indicators
      box.querySelectorAll('.bit-error-indicator, .retransmit-indicator').forEach(el => el.remove());
      
      if (s.errorInfo.hasErrors) {
        // Add error indicator
        const indicator = document.createElement('div');
        indicator.className = 'bit-error-indicator';
        indicator.textContent = '⚠️';
        indicator.title = `Bit errors in segments: ${s.errorInfo.errorSegments ? s.errorInfo.errorSegments.join(', ') : 'unknown'}`;
        box.appendChild(indicator);
        
        // Add status badge to step badge
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge lost';
          statusSpan.textContent = '⚠️ ERROR';
          badge.appendChild(statusSpan);
        }
      } else if (s.errorInfo.retransSegments && s.errorInfo.retransSegments.length > 0) {
        // Add retransmit indicator
        const indicator = document.createElement('div');
        indicator.className = 'retransmit-indicator';
        indicator.textContent = '🔄';
        indicator.title = `Retransmitted segments: ${s.errorInfo.retransSegments.join(', ')}`;
        box.appendChild(indicator);
        
        // Add status badge to step badge
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge retrans';
          statusSpan.textContent = '🔄 RETRANS';
          badge.appendChild(statusSpan);
        }
      } else {
        // Everything is OK
        const badge = $('stepBadge');
        if (badge) {
          badge.querySelectorAll('.status-badge').forEach(el => el.remove());
          const statusSpan = document.createElement('span');
          statusSpan.className = 'status-badge ok';
          statusSpan.textContent = '✅ OK';
          badge.appendChild(statusSpan);
        }
      }
      
      // Show lost segments info if any
      if (s.errorInfo.lostSegments && s.errorInfo.lostSegments.length > 0) {
        const badge = $('stepBadge');
        if (badge) {
          const lostSpan = document.createElement('span');
          lostSpan.className = 'status-badge lost';
          lostSpan.textContent = `💀 ${s.errorInfo.lostSegments.length} lost`;
          lostSpan.style.marginLeft = '4px';
          badge.appendChild(lostSpan);
        }
      }
    } else {
      // No error info, just show OK
      const badge = $('stepBadge');
      if (badge) {
        badge.querySelectorAll('.status-badge').forEach(el => el.remove());
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-badge ok';
        statusSpan.textContent = '✅ OK';
        badge.appendChild(statusSpan);
      }
    }
    
    setActiveLayer(s.layer);
    if (s.topo && moveMarkerFn) moveMarkerFn(s.topo, s);
    updateLog();
    updateProgress();
    if (ctl.inspectorPinned) renderInspector(s);
  }

  function setActiveLayer(layerKey) {
    const mapped = layerKey ? mapLayerKey(layerKey) : null;
    activeLayers().forEach(l => {
      const row = document.getElementById('layer-B-' + l.key);
      if (!row) return;
      row.classList.remove('active');
      if (mapped && l.key === mapped) row.classList.add('active');
      if (mapped) {
        const li = activeLayers().findIndex(x => x.key === mapped);
        const ti = activeLayers().findIndex(x => x.key === l.key);
        if (ti < li) row.classList.add('done');
        else if (!(l.key === mapped)) row.classList.remove('done');
      } else row.classList.remove('done');
    });
  }

  function updateLog() {
    const list = $('logList');
    list.innerHTML = '';
    for (let i = 0; i <= ctl.idx; i++) {
      const item = document.createElement('div');
      item.className = 'log-item' + (i === ctl.idx ? ' now' : '');
      
      // Add error indicators to log items
      const step = ctl.steps[i];
      let logText = `[${String(i + 1).padStart(2, '0')}] ${step.log}`;
      
      if (step.errorInfo) {
        if (step.errorInfo.hasErrors) {
          logText = '⚠️ ' + logText;
          item.style.borderLeftColor = 'var(--bad)';
        } else if (step.errorInfo.retransSegments && step.errorInfo.retransSegments.length > 0) {
          logText = '🔄 ' + logText;
          item.style.borderLeftColor = 'var(--warn)';
        }
      }
      
      item.textContent = logText;
      list.appendChild(item);
    }
    list.scrollTop = list.scrollHeight;
  }

  function updateProgress() {
    const total = ctl.steps.length,
      cur = ctl.idx + 1;
    $('stepCounter').textContent = `Step ${Math.max(cur, 0)} / ${total}`;
    $('progressFill').style.width = total ? `${(Math.max(cur, 0) / total) * 100}%` : '0%';
    $('btnBack').disabled = ctl.idx <= 0;
    $('btnFwd').disabled = ctl.idx >= ctl.steps.length - 1 || ctl.steps.length === 0;
  }

  function renderInspector(s) {
    const box = $('inspector');
    const c = extra.getCfg();
    const hex = strToHex(c.message);
    const bin = strToBin(c.message);
    
    // Build header info with error details if available
    let errorHtml = '';
    if (s.errorInfo) {
      errorHtml = `<div class="insp-section-title" style="--lc:var(--bad);">Error Status</div>`;
      if (s.errorInfo.hasErrors) {
        errorHtml += `<div class="insp-field"><span>Bit Errors</span><span style="color:var(--bad);">⚠️ ${s.errorInfo.errorSegments ? s.errorInfo.errorSegments.length : 0} segment(s)</span></div>`;
      }
      if (s.errorInfo.retransSegments && s.errorInfo.retransSegments.length > 0) {
        errorHtml += `<div class="insp-field"><span>Retransmissions</span><span style="color:var(--warn);">🔄 ${s.errorInfo.retransSegments.length} segment(s)</span></div>`;
      }
      if (s.errorInfo.lostSegments && s.errorInfo.lostSegments.length > 0) {
        errorHtml += `<div class="insp-field"><span>Lost Segments</span><span style="color:var(--bad);">💀 ${s.errorInfo.lostSegments.length} segment(s)</span></div>`;
      }
      if (s.errorInfo.transport) {
        errorHtml += `<div class="insp-field"><span>Transport</span><span>${s.errorInfo.transport}</span></div>`;
      }
      if (s.errorInfo.recoveryMethod) {
        errorHtml += `<div class="insp-field"><span>Recovery</span><span>${s.errorInfo.recoveryMethod}</span></div>`;
      }
    }
    
    let headerHtml = (s.headers && s.headers.length) ?
      s.headers.map(h => `<div class="insp-field"><span>${h.label} header</span><span style="color:${h.color}">attached</span></div>`).join('') :
      `<div class="insp-field"><span>Headers</span><span class="muted">none at this stage</span></div>`;
      
    box.innerHTML = `<div class="insp-section-title" style="--lc:${s.layer ? getLayerColorVar(s.layer) : 'var(--accent)'}">Current Layer</div>
      <div class="insp-field"><span>Stage</span><span>${s.badge}</span></div>
      ${headerHtml}
      ${errorHtml}
      <div class="insp-section-title">Payload</div>
      <div class="insp-field"><span>Text</span><span>${esc(c.message)}</span></div>
      <div class="insp-field"><span>Protocol</span><span>${c.proto} / ${c.transport}</span></div>
      <div class="insp-field"><span>TTL start</span><span>${c.ttl}</span></div>
      ${s.errorInfo && s.errorInfo.finalMessage ? `<div class="insp-field"><span>Received</span><span style="color:${s.errorInfo.messageComplete ? 'var(--ok)' : 'var(--bad)'}">${esc(s.errorInfo.finalMessage)}</span></div>` : ''}
      <div class="insp-hex">HEX&#10;${hex}</div><div class="insp-hex">BIN&#10;${bin}</div>`;
  }

  function goto(i) { ctl.idx = Math.max(-1, Math.min(ctl.steps.length - 1, i));
    render(); }

  function stepForward() { if (ctl.idx < ctl.steps.length - 1) goto(ctl.idx + 1);
    else pause(); }

  function stepBack() { if (ctl.idx > 0) goto(ctl.idx - 1); }

  function play() {
    if (ctl.steps.length === 0) return;
    ctl.playing = true;
    $('btnPlay').textContent = '⏸ Pause';
    const speed = parseFloat($('speedSlider').value);
    clearInterval(ctl.timer);
    ctl.timer = setInterval(() => { if (ctl.idx >= ctl.steps.length - 1) { pause(); return; } stepForward(); }, 1400 / speed);
  }

  function pause() { ctl.playing = false;
    $('btnPlay').textContent = '▶ Play';
    clearInterval(ctl.timer); }

  function replay() { pause();
    goto(0); }

  function openInspector() { if (ctl.idx < 0 || !ctl.steps[ctl.idx]) return;
    ctl.inspectorPinned = true;
    renderInspector(ctl.steps[ctl.idx]); }

  function loadSteps(newSteps) {
    ctl.steps = newSteps;
    ctl.idx = -1;
    ctl.inspectorPinned = false;
    $('inspector').innerHTML = '<div class="insp-empty">Click the moving packet to inspect its headers.</div>';
    pause();
    goto(0);
    play();
  }

  function buildLayerRail() {
    const rail = document.getElementById('layerRailB');
    if (!rail) return;
    rail.innerHTML = '';
    activeLayers().forEach(l => {
      const row = document.createElement('div');
      row.className = 'layer-row';
      row.id = 'layer-B-' + l.key;
      row.style.setProperty('--lc', l.color);
      row.innerHTML = `<span class="layer-dot"></span><span class="layer-name">${l.name}</span>`;
      rail.appendChild(row);
    });
  }

  $('btnPlay').addEventListener('click', () => ctl.playing ? pause() : play());
  $('btnFwd').addEventListener('click', () => { pause();
    stepForward(); });
  $('btnBack').addEventListener('click', () => { pause();
    stepBack(); });
  $('btnReplay').addEventListener('click', replay);
  $('speedSlider').addEventListener('input', e => {
    $('speedLabel').textContent = parseFloat(e.target.value).toFixed(2) + '×';
    if (ctl.playing) play();
  });

  return { ctl, render, loadSteps, openInspector, pause, buildLayerRail };
}