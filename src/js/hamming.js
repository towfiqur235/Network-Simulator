/* ============================================================
   HAMMING(7,4) ERROR CORRECTION LAB
   ============================================================ */

let hamState = null;

function hammingEncode(d) {
  const c = new Array(8).fill(0);
  c[3] = d[0];
  c[5] = d[1];
  c[6] = d[2];
  c[7] = d[3];
  c[1] = c[3] ^ c[5] ^ c[7];
  c[2] = c[3] ^ c[6] ^ c[7];
  c[4] = c[5] ^ c[6] ^ c[7];
  return c;
}

function runHammingEncode() {
  const raw = cleanBits(document.getElementById('hamData').value).padEnd(4, '0').slice(0, 4);
  const d = raw.split('').map(Number);
  const c = hammingEncode(d);
  hamState = { data: raw, code: c.slice(1), corrupted: null };
  document.getElementById('hamInjectBtn').disabled = false;
  document.getElementById('hamCorrectBtn').disabled = true;
  renderHammingResult();
}

function runHammingInject() {
  if (!hamState) return;
  let pos = parseInt(document.getElementById('hamFlipPos').value, 10);
  if (!(pos >= 1 && pos <= 7)) pos = Math.floor(Math.random() * 7) + 1;
  const flipped = [...hamState.code];
  flipped[pos - 1] = flipped[pos - 1] === 1 ? 0 : 1;
  hamState.corrupted = flipped;
  hamState.errorPos = pos;
  document.getElementById('hamCorrectBtn').disabled = false;
  renderHammingResult();
}

function runHammingCorrect() {
  if (!hamState || !hamState.corrupted) return;
  const c = [0, ...hamState.corrupted];
  const p1 = c[1] ^ c[3] ^ c[5] ^ c[7];
  const p2 = c[2] ^ c[3] ^ c[6] ^ c[7];
  const p4 = c[4] ^ c[5] ^ c[6] ^ c[7];
  const syndrome = p1 + p2 * 2 + p4 * 4;
  const corrected = [...hamState.corrupted];
  if (syndrome !== 0) {
    corrected[syndrome - 1] = corrected[syndrome - 1] === 1 ? 0 : 1;
  }
  hamState.syndrome = syndrome;
  hamState.corrected = corrected;
  renderHammingResult();
}

function renderHammingResult() {
  const labelPos = i => ({ 1: 'P1', 2: 'P2', 3: 'D1', 4: 'P4', 5: 'D2', 6: 'D3', 7: 'D4' })[i];
  const boxes = arr => arr.map((b, i) =>
    `<div class="bit-box ${[1, 2, 4].includes(i + 1) ? 'parity' : ''}" title="Position ${i + 1} (${labelPos(i + 1)})">${b}</div>`
  ).join('');
  let html = `<div class="card-title">Hamming(7,4) Encoding</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Data D1 D2 D3 D4 = ${hamState.data.split('').join(' ')}</div>
    <div style="margin:10px 0;">${boxes(hamState.code)}</div>
    <div class="info-card"><h4>Parity Calculation</h4>
      <p>P1 (covers 1,3,5,7) = D1⊕D2⊕D4 → checks positions 3,5,7</p>
      <p>P2 (covers 2,3,6,7) = D1⊕D3⊕D4 → checks positions 3,6,7</p>
      <p>P4 (covers 4,5,6,7) = D2⊕D3⊕D4 → checks positions 5,6,7</p>
      <p>Transmitted 7-bit codeword: <b class="mono">${hamState.code.join('')}</b></p></div>`;
  if (hamState.corrupted) {
    html += `<div class="info-card" style="margin-top:14px; border-color:var(--bad);"><h4>Error Injected at position ${hamState.errorPos}</h4>
      <div style="margin:8px 0;">${hamState.corrupted.map((b, i) =>
        `<div class="bit-box ${i + 1 === hamState.errorPos ? 'error' : ''}">${b}</div>`
      ).join('')}</div></div>`;
  }
  if (hamState.corrected) {
    const fixed = hamState.syndrome !== 0;
    html += `<div class="info-card" style="margin-top:14px; border-color:var(--ok);"><h4>Syndrome = P1P2P4 = ${hamState.syndrome.toString(2).padStart(3, '0')} (decimal ${hamState.syndrome}) ${fixed ? `→ error at position ${hamState.syndrome}` : '→ no error detected'}</h4>
      <div style="margin:8px 0;">${hamState.corrected.map((b, i) =>
        `<div class="bit-box ${fixed && i + 1 === hamState.syndrome ? 'corrected' : ''}">${b}</div>`
      ).join('')}</div>
      <p>Recovered data bits (positions 3,5,6,7): <b class="mono" style="color:var(--ok)">${[3, 5, 6, 7].map(p => hamState.corrected[p - 1]).join('')}</b> ${[3, 5, 6, 7].map(p => hamState.corrected[p - 1]).join('') === hamState.data ? '✓ matches original' : ''}</p></div>`;
  }
  document.getElementById('hamResult').innerHTML = html;
}