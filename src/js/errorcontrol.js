/* ============================================================
   PARITY CHECK + CHECKSUM LABS
   (Sit alongside crc.js and hamming.js under the merged
   "Error Detection & Correction" section. Same algorithms as
   python_algorithms/error_detection.py — see that file for the
   fully-commented reference version.)
   ============================================================ */

// ---- Parity Check ----
let parityState = null;

function generateParityBit(dataBits, even) {
  const ones = dataBits.split('').filter(b => b === '1').length;
  if (even) return (ones % 2 === 0) ? '0' : '1';
  return (ones % 2 === 0) ? '1' : '0';
}

function runParity() {
  const data = cleanBits(document.getElementById('parityData').value) || '1011000';
  const even = document.getElementById('parityScheme').value === 'even';
  const p = generateParityBit(data, even);
  const codeword = data + p;
  parityState = { data, even, codeword, corrupted: null };
  document.getElementById('parityInjectBtn').disabled = false;
  renderParityResult(null);
}

function injectParityError() {
  if (!parityState) return;
  const pos = Math.floor(Math.random() * parityState.codeword.length);
  const arr = parityState.codeword.split('');
  arr[pos] = arr[pos] === '1' ? '0' : '1';
  parityState.corrupted = arr.join('');
  parityState.errorPos = pos;
  renderParityResult(pos);
}

function renderParityResult(errorPos) {
  const boxes = arr => arr.split('').map((b, i) =>
    `<div class="bit-box ${i === arr.length - 1 ? 'parity' : ''}">${b}</div>`
  ).join('');
  let html = `<div class="card-title">Parity Check (${parityState.even ? 'Even' : 'Odd'})</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Data: ${parityState.data}  ·  Ones count: ${parityState.data.split('').filter(b => b === '1').length}  ·  Parity bit chosen so the total count of 1s is ${parityState.even ? 'even' : 'odd'}.</div>
    <div style="margin:10px 0;">${boxes(parityState.codeword)}</div>
    <div class="info-card"><h4>Transmitted Codeword</h4><p class="mono">${parityState.codeword} <span class="muted" style="font-size:11px;">(last bit = parity)</span></p></div>`;
  if (errorPos !== null && errorPos !== undefined && parityState.corrupted) {
    const ones = parityState.corrupted.split('').filter(b => b === '1').length;
    const isEven = ones % 2 === 0;
    const expectedEven = parityState.even;
    const errorDetected = isEven !== expectedEven;
    const arr = parityState.corrupted.split('').map((b, i) =>
      i === errorPos ? `<span style="color:var(--bad); font-weight:800;">${b}</span>` : b
    ).join('');
    html += `<div class="info-card" style="margin-top:14px; border-color:${errorDetected ? 'var(--ok)' : 'var(--bad)'}">
      <h4>Receiver Check (bit flipped at position ${errorPos})</h4>
      <p class="mono">Received: ${arr}</p>
      <p>Recount of 1s: <b class="mono">${ones}</b> (${isEven ? 'even' : 'odd'}) — expected ${expectedEven ? 'even' : 'odd'}</p>
      <p style="color:${errorDetected ? 'var(--ok)' : 'var(--bad)'}; font-weight:800;">${errorDetected ? '✓ Error Detected — parity mismatch' : '✕ Not Detected — an even number of bits flipped, parity looks fine (this is parity\'s known blind spot)'}</p></div>`;
  }
  document.getElementById('parityResult').innerHTML = html;
}

// ---- Checksum ----
let checksumState = null;

function splitIntoBlocks(bits, blockSize) {
  const padLen = (blockSize - (bits.length % blockSize)) % blockSize;
  const padded = bits + '0'.repeat(padLen);
  const blocks = [];
  for (let i = 0; i < padded.length; i += blockSize) blocks.push(padded.slice(i, i + blockSize));
  return blocks;
}

function onesComplementAdd(a, b, bitWidth) {
  const mask = (1 << bitWidth) - 1;
  let total = a + b;
  let carry = total >>> bitWidth;
  total = (total & mask) + carry;
  if (total > mask) total = (total & mask) + 1;
  return total;
}

function runChecksum() {
  const data = cleanBits(document.getElementById('checksumData').value) || '1101011000100110';
  const blockSize = parseInt(document.getElementById('checksumBlockSize').value, 10);
  const blocks = splitIntoBlocks(data, blockSize);
  const mask = (1 << blockSize) - 1;
  let runningSum = 0;
  const steps = [];
  blocks.forEach(block => {
    const value = parseInt(block, 2);
    const newSum = onesComplementAdd(runningSum, value, blockSize);
    steps.push({ block, value, sumAfter: newSum });
    runningSum = newSum;
  });
  const checksum = (~runningSum) & mask;
  const checksumBits = checksum.toString(2).padStart(blockSize, '0');
  checksumState = { data, blockSize, blocks, steps, sum: runningSum, checksum, checksumBits, corrupted: null };
  document.getElementById('checksumInjectBtn').disabled = false;
  renderChecksumResult(null);
}

function injectChecksumError() {
  if (!checksumState) return;
  const pos = Math.floor(Math.random() * checksumState.data.length);
  const arr = checksumState.data.split('');
  arr[pos] = arr[pos] === '1' ? '0' : '1';
  checksumState.corruptedData = arr.join('');
  checksumState.errorPos = pos;
  // Receiver adds all data blocks (now possibly corrupted) PLUS the received checksum block.
  const blockSize = checksumState.blockSize;
  const mask = (1 << blockSize) - 1;
  const blocks = splitIntoBlocks(checksumState.corruptedData, blockSize).concat([checksumState.checksumBits]);
  let runningSum = 0;
  blocks.forEach(block => { runningSum = onesComplementAdd(runningSum, parseInt(block, 2), blockSize); });
  checksumState.finalSum = runningSum;
  checksumState.valid = runningSum === mask;
  renderChecksumResult(pos);
}

function renderChecksumResult(errorPos) {
  const c = checksumState;
  const stepLines = c.steps.map((s, i) =>
    `block ${i + 1}: ${s.block} (${s.value})  →  running sum = ${s.sumAfter.toString(2).padStart(c.blockSize, '0')} (${s.sumAfter})`
  ).join('\n');
  let html = `<div class="card-title">Checksum (${c.blockSize}-bit blocks, one's-complement addition)</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Data: ${c.data}  ·  Split into ${c.blocks.length} block(s) of ${c.blockSize} bits</div>
    <div class="step-lines">${esc(stepLines)}</div>
    <div class="info-card"><h4>Result</h4><p>Final sum: <b class="mono">${c.sum.toString(2).padStart(c.blockSize, '0')}</b></p>
      <p>Checksum (one's complement of the sum): <b class="mono" style="color:var(--net)">${c.checksumBits}</b></p></div>`;
  if (errorPos !== null && errorPos !== undefined) {
    const arr = c.corruptedData.split('').map((b, i) =>
      i === errorPos ? `<span style="color:var(--bad); font-weight:800;">${b}</span>` : b
    ).join('');
    html += `<div class="info-card" style="margin-top:14px; border-color:${c.valid ? 'var(--ok)' : 'var(--bad)'}">
      <h4>Receiver Check (after injecting a bit error at data position ${errorPos})</h4>
      <p class="mono">Received data: ${arr}</p>
      <p>Sum of all blocks + checksum: <b class="mono">${c.finalSum.toString(2).padStart(c.blockSize, '0')}</b></p>
      <p style="color:${c.valid ? 'var(--ok)' : 'var(--bad)'}; font-weight:800;">${c.valid ? '✓ Checksum Valid (all-ones pattern) — error not detected' : '✕ Checksum Invalid — not all-ones, corruption detected'}</p></div>`;
  }
  document.getElementById('checksumResult').innerHTML = html;
}
