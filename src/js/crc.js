/* ============================================================
   CRC ERROR DETECTION LAB
   ============================================================ */

let crcState = null;

function xorDivide(dividendBits, generator) {
  const steps = [];
  let work = dividendBits.split('').map(Number);
  const glen = generator.length;
  for (let i = 0; i <= work.length - glen; i++) {
    if (work[i] === 1) {
      const before = work.slice(i, i + glen).join('');
      for (let j = 0; j < glen; j++) {
        work[i + j] ^= (generator.charCodeAt(j) - 48);
      }
      steps.push({
        pos: i,
        before: before,
        gen: generator,
        after: work.slice(i, i + glen).join('')
      });
    }
  }
  const remainder = work.slice(work.length - (glen - 1)).join('');
  return { remainder, steps, worked: work.join('') };
}

function runCrc() {
  const data = cleanBits(document.getElementById('crcData').value) || '1101011100';
  const gen = cleanBits(document.getElementById('crcGen').value) || '1011';
  const augmented = data + '0'.repeat(gen.length - 1);
  const { remainder, steps } = xorDivide(augmented, gen);
  const codeword = data + remainder;
  crcState = { data, gen, codeword, remainder, corrupted: false };
  document.getElementById('crcInjectBtn').disabled = false;
  renderCrcResult(steps, null);
}

function injectCrcError() {
  if (!crcState) return;
  const pos = Math.floor(Math.random() * crcState.codeword.length);
  const arr = crcState.codeword.split('');
  arr[pos] = arr[pos] === '1' ? '0' : '1';
  crcState.received = arr.join('');
  crcState.errorPos = pos;
  crcState.corrupted = true;
  const { remainder, steps } = xorDivide(crcState.received, crcState.gen);
  renderCrcResult(steps, { remainder, pos });
}

function renderCrcResult(genSteps, checkResult) {
  const stepLines = genSteps.map(s =>
    `pos ${String(s.pos).padStart(2, '0')}:  ${s.before}  XOR  ${s.gen}  =  ${s.after}`
  ).join('\n') || '(no XOR steps — leading bit was already 0)';
  let html = `<div class="card-title">CRC Generation</div>
    <div class="mono muted" style="font-size:12px; margin-bottom:8px;">Data: ${crcState.data}  ·  Generator: ${crcState.gen}  ·  Augmented (data + ${crcState.gen.length - 1} zeros): ${crcState.data}${'0'.repeat(crcState.gen.length - 1)}</div>
    <div class="step-lines">${esc(stepLines)}</div>
    <div class="info-card"><h4>Result</h4><p>CRC remainder: <b class="mono" style="color:var(--net)">${crcState.remainder}</b></p>
      <p>Transmitted codeword (data + CRC): <b class="mono">${crcState.codeword}</b></p></div>`;
  if (checkResult) {
    const arr = crcState.received.split('').map((b, i) =>
      i === checkResult.pos ? `<span style="color:var(--bad); font-weight:800;">${b}</span>` : b
    ).join('');
    const valid = /^0+$/.test(checkResult.remainder);
    html += `<div class="info-card" style="margin-top:14px; border-color:${valid ? 'var(--ok)' : 'var(--bad)'}">
      <h4>Receiver Check (after injecting a bit error at position ${checkResult.pos})</h4>
      <p class="mono">Received: ${arr}</p>
      <p>Remainder after dividing by the generator: <b class="mono">${checkResult.remainder}</b></p>
      <p style="color:${valid ? 'var(--ok)' : 'var(--bad)'}; font-weight:800;">${valid ? '✓ CRC Valid (error not detected — rare with a good polynomial)' : '✕ CRC Error — corruption detected, frame will be discarded/retransmitted'}</p></div>`;
  }
  document.getElementById('crcResult').innerHTML = html;
}