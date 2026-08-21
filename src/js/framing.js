/* ============================================================
   FRAMING LAB
   ============================================================ */

function runByteStuffing() {
  const FLAG = '~';
  const ESC = '\\';
  const input = document.getElementById('frameByteInput').value || 'AB~CD';
  let stuffed = '';
  const highlights = [];
  for (const ch of input) {
    if (ch === FLAG || ch === ESC) {
      stuffed += ESC;
      highlights.push(stuffed.length - 1);
      stuffed += ch;
      highlights.push(stuffed.length - 1);
    } else {
      stuffed += ch;
    }
  }
  const framed = FLAG + stuffed + FLAG;
  const chars = framed.split('').map((c, i) => {
    let cls = 'bit-box';
    if (i === 0 || i === framed.length - 1) cls += ' flag';
    else if (highlights.includes(i - 1)) cls += ' stuffed';
    return `<div class="${cls}" title="${i === 0 || i === framed.length - 1 ? 'Flag byte (delimits the frame)' : (highlights.includes(i - 1) ? 'Inserted ESC / escaped payload byte' : 'Original data byte')}">${esc(c)}</div>`;
  }).join('');
  let destuffed = '';
  let i = 1;
  while (i < framed.length - 1) {
    if (framed[i] === ESC) {
      destuffed += framed[i + 1];
      i += 2;
    } else {
      destuffed += framed[i];
      i++;
    }
  }
  document.getElementById('framingResult').innerHTML = `
    <div class="card-title">Byte Stuffing Result</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Original: "${esc(input)}"  ·  FLAG = ~  ·  ESC = \\</div>
    <div style="margin:10px 0;">${chars}</div>
    <div class="info-card"><h4>Framed &amp; Stuffed</h4><p class="mono">${esc(framed)}</p>
      <h4 style="margin-top:10px;">De-stuffed at Receiver</h4><p class="mono" style="color:${destuffed === input ? 'var(--ok)' : 'var(--bad)'}">${esc(destuffed)} ${destuffed === input ? '✓ matches original' : '✕ mismatch'}</p></div>`;
}

function runBitStuffing() {
  const input = cleanBits(document.getElementById('frameBitInput').value) || '0111111011111011';
  const FLAG = '01111110';
  let stuffed = '';
  let run = 0;
  const stuffedPositions = [];
  for (const b of input) {
    stuffed += b;
    if (b === '1') {
      run++;
      if (run === 5) {
        stuffed += '0';
        stuffedPositions.push(stuffed.length - 1);
        run = 0;
      }
    } else {
      run = 0;
    }
  }
  const framed = FLAG + stuffed + FLAG;
  const bitsHtml = framed.split('').map((b, i) => {
    let cls = 'bit-box';
    const isFlag = (i < 8) || (i >= framed.length - 8);
    const stuffedIdx = i - 8;
    if (isFlag) cls += ' flag';
    else if (stuffedPositions.includes(stuffedIdx)) cls += ' stuffed';
    return `<div class="${cls}" title="${isFlag ? 'Flag pattern 01111110' : (stuffedPositions.includes(stuffedIdx) ? 'Stuffed 0 (inserted after five 1s)' : 'Data bit')}">${b}</div>`;
  }).join('');
  let destuffed = '';
  run = 0;
  for (let i = 8; i < framed.length - 8; i++) {
    const b = framed[i];
    if (run === 5) {
      run = 0;
      continue;
    }
    destuffed += b;
    if (b === '1') run++;
    else run = 0;
  }
  document.getElementById('framingResult').innerHTML = `
    <div class="card-title">Bit Stuffing Result</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Original bits: ${input}  ·  Flag pattern: 01111110</div>
    <div style="margin:10px 0; line-height:2.4;">${bitsHtml}</div>
    <div class="info-card"><h4>Framed &amp; Stuffed</h4><p class="mono" style="word-break:break-all;">${framed}</p>
      <h4 style="margin-top:10px;">De-stuffed at Receiver</h4><p class="mono" style="color:${destuffed === input ? 'var(--ok)' : 'var(--bad)'}">${destuffed} ${destuffed === input ? '✓ matches original' : '✕ mismatch'}</p></div>`;
}