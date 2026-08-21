/* ============================================================
   SIMULATION ENGINE - Builds step-by-step packet flow
   ============================================================ */

function buildStepsGeneric(cfg, pathNodes, pathEdges, opts) {
  opts = opts || {};
  const S = [];
  const msg = cfg.message || 'Hello';
  const firstByteBits = charToBits(msg[0] || 'H');
  const segTexts = chunk(msg, 5);
  
  // Generate random values for each segment individually
  const segmentPlan = segTexts.map((t, i) => {
    // Each segment gets its own random chance of being lost
    const lost = rand() * 100 < cfg.loss;
    return { num: i + 1, text: t, lost, retransmitted: false };
  });

  const senderId = pathNodes[0].id;
  const receiverId = pathNodes[pathNodes.length - 1].id;
  const midNodes = pathNodes.slice(1, -1);

  // Intro
  S.push({
    layer: null,
    badge: 'START',
    title: `"${msg}" created at the Application`,
    desc: `The user types a message on ${pathNodes[0].label} and clicks Send. The OS hands the data to the selected application protocol: ${cfg.proto}.`,
    topo: senderId,
    log: `${pathNodes[0].label}: user submits message "${msg}"`,
    render: () => `<div class="capsule"><div class="capsule-core">${esc(msg)}</div></div>`,
    headers: [],
    data: { text: msg }
  });

  // Application
  S.push({
    layer: 'app',
    badge: 'APPLICATION',
    title: `${cfg.proto} header attached`,
    desc: `The application layer wraps the message using ${cfg.proto}.${currentModel === 'TCPIP' ? ' In the TCP/IP model, presentation and session duties (encoding, session tracking) are also handled here.' : ''}`,
    topo: senderId,
    log: `APP: wrapped in ${cfg.proto} request`,
    render: () => `<div class="capsule"><div class="ring-tag" style="background:var(--app)">${cfg.proto}</div><div class="capsule-core">${esc(msg)}</div></div>`,
    headers: [{ k: 'app', label: cfg.proto, color: 'var(--app)' }],
    data: { text: msg }
  });

  // Presentation
  const hexMsg = strToHex(msg);
  const encryptedLabel = (cfg.proto === 'HTTPS') ? 'TLS-Encrypted Payload' : 'Plaintext (no TLS)';
  S.push({
    layer: 'pres',
    badge: 'PRESENTATION',
    title: 'Encoding & formatting',
    desc: `Characters are converted to binary/ASCII, optionally compressed, and — since the protocol is ${cfg.proto} — ${cfg.proto === 'HTTPS' ? 'encrypted with TLS' : 'sent without encryption'}.`,
    topo: senderId,
    log: `PRES: "${msg}" → ${hexMsg.split(' ').slice(0, 3).join(' ')}... (${encryptedLabel})`,
    render: () => `<div class="transform-chain"><div class="tf-box">${esc(msg)}</div><div class="tf-arrow">→</div><div class="tf-box">${hexMsg}</div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--pres); color:var(--pres)">${encryptedLabel}</div></div>`,
    headers: [{ k: 'pres', label: cfg.proto === 'HTTPS' ? 'TLS' : 'ENC', color: 'var(--pres)' }],
    data: { text: msg, hex: hexMsg }
  });

  // Session
  const sessionId = 'SESS-' + Math.floor(rand() * 90000 + 10000);
  S.push({
    layer: 'sess',
    badge: 'SESSION',
    title: 'Session established',
    desc: `A dialogue is opened between ${pathNodes[0].label} and ${pathNodes[pathNodes.length - 1].label}. A session identifier is generated.`,
    topo: senderId,
    log: `SESS: session created — ${sessionId}`,
    render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--sess)">Session Created</div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--sess)">ID: ${sessionId}</div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--sess); color:var(--sess)">Connection Established</div></div>`,
    headers: [{ k: 'sess', label: 'SESS', color: 'var(--sess)' }],
    data: { text: msg }
  });

  // Transport handshake
  if (cfg.transport === 'TCP') {
    const hs = [
      { t: 'SYN', d: `${pathNodes[0].label} asks to open a connection and proposes an initial sequence number.` },
      { t: 'SYN-ACK', d: `${pathNodes[pathNodes.length - 1].label} acknowledges and proposes its own initial sequence number.` },
      { t: 'ACK', d: `${pathNodes[0].label} acknowledges — the three-way handshake is complete.` },
    ];
    hs.forEach((h, i) => {
      S.push({
        layer: 'trans',
        badge: 'TCP HANDSHAKE',
        title: `${h.t} ${i === 1 ? '←' : '→'}`,
        desc: h.d,
        topo: i === 1 ? receiverId : senderId,
        log: `TCP: ${h.t} sent`,
        render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--trans)">${pathNodes[0].label}</div><div class="tf-arrow" style="color:var(--trans); font-weight:700;">${h.t}</div><div class="tf-box" style="border-color:var(--trans)">${pathNodes[pathNodes.length - 1].label}</div></div>`,
        headers: [{ k: 'trans', label: h.t, color: 'var(--trans)' }],
        data: { text: msg }
      });
    });
  } else {
    S.push({
      layer: 'trans',
      badge: 'UDP',
      title: 'No handshake — UDP is connectionless',
      desc: `UDP sends datagrams immediately — no three-way handshake, no acknowledgment, no built-in retransmission.`,
      topo: senderId,
      log: `UDP: connectionless — sending immediately`,
      render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--trans); color:var(--trans)">No SYN</div><div class="tf-box" style="border-color:var(--trans); color:var(--trans)">No ACK</div><div class="tf-box" style="border-color:var(--trans); color:var(--trans)">No Retransmit</div></div>`,
      headers: [{ k: 'trans', label: 'UDP', color: 'var(--trans)' }],
      data: { text: msg }
    });
  }

  // Segmentation
  S.push({
    layer: 'trans',
    badge: 'TRANSPORT',
    title: `Message split into ${segmentPlan.length} segment${segmentPlan.length > 1 ? 's' : ''}`,
    desc: `The transport layer breaks the payload into ${cfg.transport === 'TCP' ? 'segments' : 'datagrams'}, each tagged with ports, sequence numbers and a checksum.`,
    topo: senderId,
    log: `${cfg.transport}: split into ${segmentPlan.length} unit(s)`,
    render: () => `<div class="seg-strip">${segmentPlan.map(s =>
      `<div class="seg-chip"><div class="seg-num">SEG ${s.num}</div><div class="mono" style="font-size:10px;color:var(--muted)">"${esc(s.text)}"</div><div class="seg-status" style="color:var(--muted)">SEQ ${1000 + s.num * 10}</div></div>`
    ).join('')}</div>`,
    headers: [{ k: 'trans', label: `${cfg.transport}:80→443`, color: 'var(--trans)' }],
    data: { text: msg }
  });

  // Network: IP
  S.push({
    layer: 'net',
    badge: 'NETWORK',
    title: 'IP header attached',
    desc: `Each segment is wrapped in an IP packet: source IP, destination IP, TTL (${cfg.ttl}), protocol number, fragment ID.`,
    topo: senderId,
    log: `NET: IP header attached — TTL=${cfg.ttl}`,
    render: () => `<div class="capsule"><div class="ring-tag" style="background:var(--net)">IP</div><div class="ring-tag" style="background:var(--trans)">${cfg.transport}</div><div class="capsule-core">${esc(segmentPlan[0].text)}...</div></div>`,
    headers: [{ k: 'net', label: 'IP', color: 'var(--net)' }],
    data: { text: msg }
  });

  // ARP
  S.push({
    layer: 'link',
    badge: 'ARP',
    title: 'Resolving next-hop MAC address',
    desc: `${pathNodes[0].label} broadcasts an ARP Request for the next hop; the owner replies with its MAC address, which gets cached.`,
    topo: midNodes.length ? midNodes[0].id : receiverId,
    log: `ARP: who-has next hop? → reply AA:BB:CC:${Math.floor(rand() * 90 + 10)}:22:33`,
    render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--link)">ARP Request<br><span class="muted" style="font-size:10px;">broadcast</span></div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--link)">ARP Reply<br><span class="muted" style="font-size:10px;">MAC returned</span></div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--link); color:var(--link)">MAC Learned</div></div>`,
    headers: [{ k: 'link', label: 'ARP', color: 'var(--link)' }],
    data: { text: msg }
  });

  // Data Link
  S.push({
    layer: 'link',
    badge: 'DATA LINK',
    title: 'Frame constructed',
    desc: `The packet becomes a frame: source/destination MAC, an 802.3 header, and a CRC trailer for error detection.`,
    topo: senderId,
    log: `LINK: frame built — CRC attached`,
    render: () => `<div class="capsule"><div class="ring-tag" style="background:var(--link)">MAC</div><div class="ring-tag" style="background:var(--net)">IP</div><div class="ring-tag" style="background:var(--trans)">${cfg.transport}</div><div class="capsule-core">${esc(segmentPlan[0].text)}...</div><div class="ring-tag" style="background:var(--link)">CRC</div></div>`,
    headers: [{ k: 'link', label: 'FRAME', color: 'var(--link)' }],
    data: { text: msg }
  });

  // Routing and hops
  let ttlNow = cfg.ttl;
  let stopped = false;
  let failureTriggered = false;
  const firstL3Index = midNodes.findIndex(n => L3_TYPES.has(n.type));

  midNodes.forEach((node, i) => {
    if (stopped) return;

    if (i === firstL3Index && opts.candidatePaths && opts.candidatePaths.length) {
      const cps = opts.candidatePaths;
      const costs = cps.map(p => pathCost(p, EDGE_TYPE_COST));
      const minCost = Math.min(...costs);
      S.push({
        layer: 'net',
        badge: 'ROUTING',
        title: `${node.label}: choosing the best path`,
        desc: `The router evaluates ${cps.length} candidate route${cps.length > 1 ? 's' : ''} toward ${pathNodes[pathNodes.length - 1].label}. Cost blends hop count, link type and reliability — the lowest-cost path is selected.`,
        topo: node.id,
        log: `ROUTE: ${node.label} evaluating ${cps.length} path(s)`,
        render: () => `<div class="route-table"><div class="route-title">Routing Table — destination ${pathNodes[pathNodes.length - 1].label}</div>${cps.map((p, pi) =>
          `<div class="route-row ${costs[pi] === minCost ? 'chosen' : ''}"><span class="route-name">Path ${String.fromCharCode(65 + pi)}</span><span class="muted">${p.nodes.length - 1} hop${p.nodes.length - 1 > 1 ? 's' : ''}</span><span class="route-cost">cost ${costs[pi]}</span>${costs[pi] === minCost ? '<span class="route-tag">SELECTED</span>' : ''}</div>`
        ).join('')}</div>`,
        headers: [{ k: 'net', label: 'ROUTE', color: 'var(--net)' }],
        data: { text: msg }
      });
    } else if (i === firstL3Index) {
      const routePaths = [{ name: 'Path A', cost: 8 }, { name: 'Path B', cost: 5 }, { name: 'Path C', cost: 12 }];
      const chosen = routePaths.reduce((a, b) => b.cost < a.cost ? b : a);
      S.push({
        layer: 'net',
        badge: 'ROUTING',
        title: `${node.label}: choosing the best path`,
        desc: `The router consults its routing table. Three possible paths exist, each with a different cost. The lowest-cost path is selected.`,
        topo: node.id,
        log: `ROUTE: ${node.label} evaluating ${routePaths.length} paths`,
        render: () => `<div class="route-table"><div class="route-title">Routing Table</div>${routePaths.map(p =>
          `<div class="route-row ${p.name === chosen.name ? 'chosen' : ''}"><span class="route-name">${p.name}</span><span class="route-cost">cost ${p.cost}</span>${p.name === chosen.name ? '<span class="route-tag">SELECTED</span>' : ''}</div>`
        ).join('')}</div>`,
        headers: [{ k: 'net', label: 'ROUTE', color: 'var(--net)' }],
        data: { text: msg }
      });
    }

    if (opts.simulateFailure && !failureTriggered && i === Math.floor(midNodes.length / 2) && opts.altPath) {
      failureTriggered = true;
      S.push({
        layer: 'net',
        badge: 'LINK DOWN',
        title: `Link failure between ${midNodes[i - 1] ? midNodes[i - 1].label : pathNodes[0].label} and ${node.label}`,
        desc: `The active link just went down mid-transmission. The router recalculates using its next-best route.`,
        topo: node.id,
        log: `NET: link failure detected — recalculating route`,
        fail: true,
        render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--bad); color:var(--bad); font-weight:700;">⚡ Link Down</div></div>`,
        headers: [{ k: 'net', label: 'FAIL', color: 'var(--bad)' }],
        data: { text: msg }
      });
      S.push({
        layer: 'net',
        badge: 'REROUTE',
        title: 'Route recalculated',
        desc: `A new path has been selected. The packet resumes its journey via the alternate route.`,
        topo: node.id,
        log: `NET: rerouted via alternate path`,
        render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--ok); color:var(--ok); font-weight:700;">✓ New Route Selected</div></div>`,
        headers: [{ k: 'net', label: 'REROUTE', color: 'var(--ok)' }],
        data: { text: msg }
      });
    }

    if (L3_TYPES.has(node.type)) {
      ttlNow -= 1;
      if (ttlNow <= 0) {
        S.push({
          layer: 'net',
          badge: 'TTL EXPIRED',
          title: `Packet dropped at ${node.label}`,
          desc: `Time-To-Live reached zero before the destination was reached. The device discards the packet and would normally send an ICMP "Time Exceeded" message back.`,
          topo: node.id,
          log: `NET: TTL expired at ${node.label} — packet dropped`,
          render: () => `<div class="transform-chain"><div class="tf-box" style="border-color:var(--bad); color:var(--bad); font-weight:700;">✕ TTL Expired — Packet Dropped</div></div>`,
          headers: [{ k: 'net', label: 'TTL=0', color: 'var(--bad)' }],
          data: { text: msg },
          fatal: true
        });
        stopped = true;
        return;
      }
      S.push({
        layer: 'net',
        badge: 'HOP',
        title: `${node.label}: TTL decremented`,
        desc: `The packet passes through ${node.label}. Its TTL is decremented by 1 to prevent routing loops.`,
        topo: node.id,
        log: `NET: ${node.label} — TTL now ${ttlNow}`,
        render: () => `<div class="capsule"><div class="ring-tag" style="background:var(--link)">MAC</div><div class="ring-tag" style="background:var(--net)">IP · TTL=${ttlNow}</div><div class="capsule-core">${esc(segmentPlan[0].text)}...</div></div>`,
        headers: [{ k: 'net', label: `TTL=${ttlNow}`, color: 'var(--net)' }],
        data: { text: msg }
      });
    } else if (L2_TYPES.has(node.type)) {
      S.push({
        layer: 'link',
        badge: 'FORWARDING',
        title: `${node.label}: frame forwarded`,
        desc: `${node.label} reads the destination MAC address and forwards the frame out the correct port${node.type === 'ap' ? ' over the wireless link' : ''}.`,
        topo: node.id,
        log: `LINK: ${node.label} forwarded frame`,
        render: () => `<div class="capsule"><div class="ring-tag" style="background:var(--link)">${node.label}</div><div class="capsule-core">forwarding…</div></div>`,
        headers: [],
        data: { text: msg }
      });
    }
  });

  if (stopped) {
    S.meta = {
      sent: segmentPlan.length,
      delivered: 0,
      lost: segmentPlan.length,
      retransmitted: 0,
      ttlDropped: true,
      bitError: false,
      success: false,
      protocol: cfg.transport,
      encoding: cfg.encoding
    };
    return S;
  }

  // Physical - Generate bit error per segment
  const bitErrorPerSegment = segmentPlan.map((s, idx) => {
    // Each segment gets its own random chance of bit error
    const hasError = rand() * 100 < cfg.ber;
    if (hasError) {
      const pos = Math.floor(rand() * 8);
      return { hasError: true, position: pos };
    }
    return { hasError: false, position: -1 };
  });

  // Show physical layer for first segment
  const firstSegError = bitErrorPerSegment[0];
  let corruptedBits = firstByteBits;
  if (firstSegError.hasError) {
    const pos = firstSegError.position;
    corruptedBits = firstByteBits.split('');
    corruptedBits[pos] = corruptedBits[pos] === '1' ? '0' : '1';
    corruptedBits = corruptedBits.join('');
  }

  S.push({
    layer: 'phy',
    badge: 'PHYSICAL',
    title: 'Converted to bits',
    desc: `The frame becomes a raw bitstream. Shown below is the encoding of the first byte ('${msg[0]}') using ${cfg.encoding} line coding over ${cfg.medium}.`,
    topo: midNodes.length ? midNodes[midNodes.length - 1].id : senderId,
    log: `PHY: bitstream generated — ${firstByteBits}`,
    render: () => `<div style="text-align:center;"><div class="mono" style="margin-bottom:10px; color:var(--muted); font-size:12px;">'${esc(msg[0])}' → ${firstByteBits}</div>${renderEncodingWaveform(firstByteBits, cfg.encoding)}<div style="margin-top:8px; font-size:11px; color:var(--muted2);">Medium: ${cfg.medium === 'copper' ? '⚡ electrical pulses (copper)' : cfg.medium === 'fiber' ? '💡 light pulses (fiber)' : '📶 radio waves (Wi-Fi)'}</div></div>`,
    headers: [{ k: 'phy', label: cfg.encoding, color: 'var(--phy)' }],
    data: { text: msg }
  });

  // Calculate which segments are actually delivered based on loss AND bit errors
  const segmentsWithErrors = segmentPlan.map((s, idx) => {
    return {
      ...s,
      hasBitError: bitErrorPerSegment[idx].hasError,
      bitErrorPosition: bitErrorPerSegment[idx].position,
      // A segment is lost if either it was marked as lost OR it has a bit error
      effectivelyLost: s.lost || bitErrorPerSegment[idx].hasError
    };
  });

  // For TCP, if a segment has a bit error, it will be retransmitted
  if (cfg.transport === 'TCP') {
    segmentsWithErrors.forEach(s => {
      if (s.hasBitError && !s.lost) {
        s.retransmitted = true;
        s.effectivelyLost = false;
      }
    });
  }

  // Store detailed error info for visualization
  const errorInfo = {
    hasErrors: bitErrorPerSegment.some(e => e.hasError),
    errorSegments: bitErrorPerSegment.map((e, idx) => e.hasError ? idx + 1 : null).filter(e => e !== null),
    retransSegments: segmentsWithErrors.filter(s => s.retransmitted).map(s => s.num),
    lostSegments: segmentsWithErrors.filter(s => s.effectivelyLost && !s.retransmitted).map(s => s.num),
    transport: cfg.transport,
    recoveryMethod: cfg.transport === 'TCP' ? (bitErrorPerSegment.some(e => e.hasError) ? 'TCP Retransmission (Timeout/Duplicate ACK)' : 'No recovery needed') : 'UDP (No recovery)'
  };

  // Show bit error status
  const anyBitError = bitErrorPerSegment.some(e => e.hasError);
  const errorMsg = anyBitError ? 
    `Bit error${bitErrorPerSegment.filter(e => e.hasError).length > 1 ? 's' : ''} detected in ${bitErrorPerSegment.filter(e => e.hasError).length} segment${bitErrorPerSegment.filter(e => e.hasError).length > 1 ? 's' : ''}` : 
    'No bit errors detected';

  const errorStatus = anyBitError ? 
    (cfg.transport === 'TCP' ? 'TCP will retransmit the corrupted segment(s)' : 'UDP has no recovery, corrupted data is lost') :
    'All bits arrived intact';

  S.push({
    layer: 'phy',
    badge: anyBitError ? 'BIT ERROR DETECTED' : 'CRC CHECK',
    title: anyBitError ? `Bit errors detected in transit` : 'CRC check passed',
    desc: anyBitError ? 
      `Noise on the ${cfg.medium} medium flipped bit${bitErrorPerSegment.filter(e => e.hasError).length > 1 ? 's' : ''} in ${bitErrorPerSegment.filter(e => e.hasError).length} segment${bitErrorPerSegment.filter(e => e.hasError).length > 1 ? 's' : ''}. ${cfg.transport === 'TCP' ? 'TCP will detect the corruption via checksum and retransmit the affected segment(s).' : 'UDP has no recovery, so corrupted datagrams are simply discarded.'}` :
      `The receiver recalculates the CRC for all segments and they all match — the frame arrived intact.`,
    topo: receiverId,
    log: `PHY: ${errorMsg} — ${errorStatus}`,
    render: () => {
      // Show bit error status for each segment
      const segStatus = segmentsWithErrors.map((s, idx) => {
        let status = '✓ OK';
        let cls = 'delivered';
        let badge = '';
        if (s.effectivelyLost && !s.retransmitted) {
          status = '✕ Lost';
          cls = 'lost';
          badge = '💀';
        } else if (s.hasBitError && s.retransmitted) {
          status = '🔄 Retransmitted';
          cls = 'retrans';
          badge = '🔄';
        } else if (s.lost && s.retransmitted) {
          status = '🔄 Retransmitted';
          cls = 'retrans';
          badge = '🔄';
        } else if (s.hasBitError) {
          status = '⚠️ Bit Error';
          cls = 'error';
          badge = '⚠️';
        }
        return `<div class="seg-chip ${cls}"><div class="seg-num">SEG ${s.num}</div><div class="seg-status">${status}</div>${badge ? `<div class="seg-error-badge">${badge}</div>` : ''}</div>`;
      }).join('');
      
      return `<div class="seg-strip">${segStatus}</div>
        <div style="margin-top:12px; text-align:center; font-size:12px; color:var(--muted);">
          ${anyBitError ? `⚠️ ${bitErrorPerSegment.filter(e => e.hasError).length} segment(s) had bit errors` : '✅ No bit errors'}
          ${cfg.transport === 'TCP' && anyBitError ? ' — TCP will recover via retransmission' : ''}
          ${errorInfo.retransSegments.length > 0 ? ` — ${errorInfo.retransSegments.length} segment(s) retransmitted` : ''}
        </div>`;
    },
    headers: [{ k: 'phy', label: anyBitError ? 'CRC✕' : 'CRC✓', color: anyBitError ? 'var(--bad)' : 'var(--ok)' }],
    data: { text: msg },
    errorInfo: errorInfo
  });

  // Delivery / loss / retransmit
  const anyLost = segmentsWithErrors.some(s => s.effectivelyLost && !s.retransmitted);
  const anyRetransmitted = segmentsWithErrors.some(s => s.retransmitted);
  
  if (cfg.transport === 'TCP' && (anyLost || anyRetransmitted)) {
    // For TCP, if any segment was lost or had bit errors, show retransmission
    segmentsWithErrors.forEach(s => {
      if ((s.lost || s.hasBitError) && !s.retransmitted) {
        s.retransmitted = true;
        s.effectivelyLost = false;
      }
    });
  }

  // Recalculate final delivery status
  const finalDelivered = segmentsWithErrors.filter(s => !s.effectivelyLost || s.retransmitted).length;
  const finalLost = segmentsWithErrors.filter(s => s.effectivelyLost && !s.retransmitted).length;

  S.push({
    layer: 'trans',
    badge: (anyLost && cfg.transport === 'UDP') ? 'UDP LOSS' : (anyRetransmitted ? 'TCP RETRANSMIT' : 'DELIVERY'),
    title: (anyLost && cfg.transport === 'UDP') ? 'Some segments were lost/discarded' : 
           (anyRetransmitted ? 'Segments recovered via retransmission' : 'All segments delivered'),
    desc: (anyLost && cfg.transport === 'UDP') ? 
      `UDP segments were lost/dropped silently — no acknowledgment or retransmission exists. The application will receive an incomplete message.` :
      (anyRetransmitted ? 
        `The receiver detected missing or corrupted segments via sequence numbers and/or checksums. TCP retransmitted the affected segment(s) and recovery was successful.` :
        `Every segment arrived intact, was acknowledged, and reassembly can begin.`),
    topo: receiverId,
    log: anyLost && cfg.transport === 'UDP' ? 
      `UDP: ${finalLost} segment(s) lost — no recovery` :
      (anyRetransmitted ? 
        `TCP: ${segmentsWithErrors.filter(s => s.retransmitted).length} segment(s) retransmitted — recovery successful` :
        `TRANS: all segments ACKed`),
    render: () => `<div class="seg-strip">${segmentsWithErrors.map(s => {
      let cls = 'delivered';
      let label = 'Delivered ✓ ACK';
      let badge = '';
      if (s.effectivelyLost && !s.retransmitted) {
        cls = 'lost';
        label = 'Lost ✕';
        badge = '💀';
      } else if (s.retransmitted) {
        cls = 'retrans';
        label = 'Retransmitted ✓';
        badge = '🔄';
      }
      return `<div class="seg-chip ${cls}"><div class="seg-num">SEG ${s.num}</div><div class="seg-status">${label}</div>${badge ? `<div class="seg-error-badge">${badge}</div>` : ''}</div>`;
    }).join('')}</div>
    <div style="margin-top:12px; text-align:center; font-size:11px; color:var(--muted);">
      ${cfg.transport === 'TCP' && anyRetransmitted ? '🔄 TCP Recovery: Segments retransmitted due to errors or loss' : ''}
      ${cfg.transport === 'UDP' && anyLost ? '💀 UDP: No recovery — lost segments are gone forever' : ''}
      ${!anyLost && !anyRetransmitted ? '✅ All segments delivered successfully' : ''}
    </div>`,
    headers: [{ k: 'trans', label: (anyLost && cfg.transport === 'UDP') ? 'UDP DROP' : (anyRetransmitted ? 'RETRANSMIT' : 'ACK'), color: (anyLost && cfg.transport === 'UDP') ? 'var(--bad)' : (anyRetransmitted ? 'var(--warn)' : 'var(--ok)') }],
    data: { text: msg },
    errorInfo: {
      ...errorInfo,
      finalDelivered: finalDelivered,
      finalLost: finalLost
    }
  });

  // Decapsulation
  const finalMessage = (cfg.transport === 'TCP') ? msg : 
    segmentsWithErrors.filter(s => !s.effectivelyLost || s.retransmitted).map(s => s.text).join('');
  
  const decapSteps = [
    { from: 'Bits', to: 'Frame', layer: 'link', d: 'The receiver reassembles the raw bitstream into a frame using the agreed line-encoding scheme.' },
    { from: 'Frame', to: 'Packet', layer: 'net', d: 'The Data Link header/trailer (MAC addresses, CRC) is stripped, leaving the IP packet.' },
    { from: 'Packet', to: 'Segment', layer: 'trans', d: 'The IP header is removed, exposing the transport-layer segment(s).' },
    { from: 'Segment', to: 'Original Message', layer: 'app', d: 'Transport headers are stripped and segments are reassembled in order.' },
  ];
  decapSteps.forEach(ds => {
    S.push({
      layer: ds.layer,
      badge: 'DECAPSULATION',
      title: `${ds.from} → ${ds.to}`,
      desc: ds.d,
      topo: receiverId,
      log: `DECAP: ${ds.from} → ${ds.to}`,
      render: () => `<div class="transform-chain"><div class="tf-box">${ds.from}</div><div class="tf-arrow">→</div><div class="tf-box" style="border-color:var(--ok); color:var(--ok)">${ds.to}</div></div>`,
      headers: [],
      data: { text: msg }
    });
  });

  const messageComplete = finalMessage === msg;
  S.push({
    layer: 'app',
    badge: 'DONE',
    title: `Message received on ${pathNodes[pathNodes.length - 1].label}`,
    desc: messageComplete ? 
      `Reassembly is complete. The receiver's screen now shows exactly what was sent.` : 
      `Reassembly is complete, but because ${cfg.transport === 'UDP' ? 'some UDP data was lost with no recovery' : 'some segments were retransmitted'}, the receiver got: "${finalMessage}".`,
    topo: receiverId,
    log: `APP: displayed on ${pathNodes[pathNodes.length - 1].label} — "${finalMessage}"`,
    render: () => `<div class="capsule"><div class="capsule-core" style="color:${messageComplete ? 'var(--ok)' : 'var(--bad)'}">${esc(finalMessage)}</div>
      ${!messageComplete ? '<div style="position:absolute; top:-10px; right:-10px; font-size:20px;">⚠️</div>' : ''}
    </div>`,
    headers: [],
    data: { text: finalMessage },
    final: true,
    errorInfo: {
      ...errorInfo,
      messageComplete: messageComplete,
      finalMessage: finalMessage,
      originalMessage: msg
    }
  });

  S.meta = {
    sent: segmentPlan.length,
    delivered: segmentsWithErrors.filter(s => !s.effectivelyLost || s.retransmitted).length,
    lost: segmentsWithErrors.filter(s => s.effectivelyLost && !s.retransmitted).length,
    retransmitted: segmentsWithErrors.filter(s => s.retransmitted).length,
    ttlDropped: false,
    bitError: anyBitError,
    success: messageComplete,
    protocol: cfg.transport,
    encoding: cfg.encoding,
    errorSegments: errorInfo.errorSegments,
    retransSegments: errorInfo.retransSegments,
    lostSegments: errorInfo.lostSegments
  };
  return S;
}