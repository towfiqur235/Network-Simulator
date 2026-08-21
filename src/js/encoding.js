/* ============================================================
   LINE ENCODING LAB
   ============================================================ */

const ENCODING_INFO = {
  unipolar: {
    name: 'Unipolar NRZ',
    cat: 'Unipolar',
    theory: 'Every bit is represented by only one non-zero voltage level (usually positive for 1) and zero for 0. It never uses negative voltage.',
    adv: ['Very simple to implement', 'Easy to understand'],
    dis: ['Has a strong DC component', 'No clock/sync recovery from long runs of 0s'],
    apps: ['Early digital logic, rarely used in modern data links'],
    sync: 'None built-in — long runs of identical bits give no transitions to recover a clock from.'
  },
  nrzl: {
    name: 'NRZ-L',
    cat: 'Polar',
    theory: 'The signal level itself represents the bit: one voltage for 1, the opposite voltage for 0. The level only changes when the bit value changes.',
    adv: ['Simple, bandwidth-efficient'],
    dis: ['No self-clocking on long runs of same bit', 'DC component present'],
    apps: ['Short-distance links, some legacy interfaces'],
    sync: 'Only when bits alternate; long runs of the same bit provide no transitions.'
  },
  nrzi: {
    name: 'NRZ-I',
    cat: 'Polar',
    theory: 'A transition (inversion) at the start of the bit interval represents a 1; no transition represents a 0.',
    adv: ['Better sync than NRZ-L when 1s are frequent'],
    dis: ['Still no transitions during long runs of 0s'],
    apps: ['USB, 100BASE-FX (with 4B/5B pre-coding)'],
    sync: 'Improves with more 1-bits; combined with 4B/5B block coding to bound zero-runs.'
  },
  rz: {
    name: 'Return-to-Zero (RZ)',
    cat: 'Polar',
    theory: 'The signal returns to zero halfway through every bit interval, so each bit always has a transition regardless of value.',
    adv: ['Self-clocking — a transition every bit'],
    dis: ['Needs twice the bandwidth of NRZ schemes'],
    apps: ['Rarely used alone; basis for biphase schemes'],
    sync: 'Excellent — guaranteed transition every bit period.'
  },
  manchester: {
    name: 'Manchester',
    cat: 'Polar (Biphase)',
    theory: 'Combines clock and data: a mid-bit transition always occurs — low-to-high represents a 0, high-to-low represents a 1 (IEEE 802.3 convention).',
    adv: ['Self-clocking', 'No DC component'],
    dis: ['Needs double the bandwidth of NRZ'],
    apps: ['Classic 10BASE-T Ethernet'],
    sync: 'Excellent — a transition is guaranteed at the middle of every bit.'
  },
  diffmanchester: {
    name: 'Differential Manchester',
    cat: 'Polar (Biphase)',
    theory: 'A mid-bit transition always occurs (for clocking); a transition at the START of the interval represents 0, absence of a start transition represents 1.',
    adv: ['Self-clocking', 'More noise-immune than Manchester (relies on presence/absence, not polarity)'],
    dis: ['Still needs double the NRZ bandwidth'],
    apps: ['Token Ring (IEEE 802.5)'],
    sync: 'Excellent — guaranteed mid-bit transition.'
  },
  ami: {
    name: 'AMI',
    cat: 'Bipolar',
    theory: 'Alternate Mark Inversion: binary 0 is sent as zero voltage; each successive 1 alternates polarity (+,−,+,−…).',
    adv: ['No DC component', 'Simple error detection — two same-polarity pulses in a row signal a "bipolar violation"'],
    dis: ['Long runs of 0s still cause loss of sync'],
    apps: ['T1 lines (with B8ZS to fix zero runs)'],
    sync: 'Good when 1s are frequent; degrades with long zero runs — fixed by B8ZS/HDB3.'
  },
  pseudoternary: {
    name: 'Pseudoternary',
    cat: 'Bipolar',
    theory: 'The mirror image of AMI: binary 1 is sent as zero voltage; each successive 0 alternates polarity.',
    adv: ['No DC component', 'Simple violation-based error check'],
    dis: ['Long runs of 1s cause loss of sync'],
    apps: ['Some ISDN basic-rate interfaces'],
    sync: 'Good when 0s are frequent; degrades with long runs of 1s.'
  },
  twob1q: {
    name: '2B1Q',
    cat: 'Multilevel',
    theory: 'Two Binary, One Quaternary: every pair of bits is mapped to one of four voltage levels (−3,−1,+1,+3), so each symbol carries 2 bits.',
    adv: ['Halves the required bandwidth versus 2-level codes'],
    dis: ['Only 4 levels means less noise margin per level'],
    apps: ['ISDN, early DSL variants'],
    sync: 'Weak on repeated symbols; often paired with scrambling for sync.'
  },
  mlt3: {
    name: 'MLT-3',
    cat: 'Multilevel',
    theory: 'Uses 3 levels (−1, 0, +1). On a 1-bit the signal steps to the next level in the cycle 0 → +1 → 0 → −1 → 0…; on a 0-bit the level stays the same.',
    adv: ['Lower effective signal frequency than NRZI for the same bit rate, reducing EMI'],
    dis: ['More complex decoder logic'],
    apps: ['100BASE-TX Fast Ethernet (after 4B/5B)'],
    sync: 'Relies on the paired 4B/5B block coding to bound zero-runs.'
  },
  fourb5b: {
    name: '4B/5B Block Coding',
    cat: 'Block Coding',
    theory: 'Every 4 data bits are mapped to a 5-bit code group chosen so that no code has more than three leading/trailing zeros — bounding zero-runs before line encoding (typically NRZI).',
    adv: ['Guarantees enough transitions for clock recovery', 'Reserves code groups for control symbols'],
    dis: ['25% overhead (5 bits sent per 4 data bits)'],
    apps: ['100BASE-TX / FDDI, usually followed by NRZI'],
    sync: 'Bounds the maximum run of zeros so the following line code stays self-clocking.'
  },
  eightb10b: {
    name: '8B/10B Block Coding',
    cat: 'Block Coding',
    theory: 'Maps 8 data bits to a 10-bit symbol chosen from a table that tracks "running disparity" (the running balance of 1s vs 0s) to keep the link DC-balanced. Full symbol table and disparity-tracking logic are beyond this simplified lab — shown here for reference only.',
    adv: ['Excellent DC balance and transition density', 'Built-in error detection via disparity rules'],
    dis: ['25% overhead, most complex block code in common use'],
    apps: ['Gigabit Ethernet, Fibre Channel, PCIe (early generations)'],
    sync: 'Very strong — disparity tracking guarantees balanced, frequent transitions.',
    noWave: true
  },
  b8zs: {
    name: 'B8ZS',
    cat: 'Scrambling',
    theory: 'Bipolar with 8-Zero Substitution: starts from AMI, but any run of eight consecutive zeros is replaced with a pattern containing two deliberate "bipolar violations" the receiver can recognize and undo.',
    adv: ["Fixes AMI's long-zero-run sync problem", 'No DC component preserved'],
    dis: ['Slightly more complex encoder/decoder'],
    apps: ['T1/DS1 lines in North America'],
    sync: 'Guarantees a pulse at least every 8 bits.'
  },
  hdb3: {
    name: 'HDB3',
    cat: 'Scrambling',
    theory: 'High-Density Bipolar 3-Zero Substitution: like B8ZS but triggers on runs of just four zeros, using a 000V or B00V pattern chosen to keep the pulse count balanced.',
    adv: ["Fixes AMI's zero-run problem with a shorter threshold than B8ZS"],
    dis: ['Substitution rule depends on pulse parity — more complex logic'],
    apps: ['E1 lines (European digital telephony)'],
    sync: 'Guarantees a pulse at least every 4 bits.'
  }
};

const FOURB5B_TABLE = {
  '0000': '11110', '0001': '01001', '0010': '10100', '0011': '10101',
  '0100': '01010', '0101': '01011', '0110': '01110', '0111': '01111',
  '1000': '10010', '1001': '10011', '1010': '10110', '1011': '10111',
  '1100': '11010', '1101': '11011', '1110': '11100', '1111': '11101'
};

function encodeAdvanced(bits, scheme) {
  if (scheme === 'unipolar') {
    return { cells: bits.split('').map(b => [b === '1' ? 1 : 0, b === '1' ? 1 : 0]), maxLevel: 1 };
  }
  if (scheme === 'nrzl') {
    return { cells: bits.split('').map(b => [b === '1' ? 1 : -1, b === '1' ? 1 : -1]), maxLevel: 1 };
  }
  if (scheme === 'nrzi') {
    let last = -1;
    const cells = bits.split('').map(b => { if (b === '1') last = -last; return [last, last]; });
    return { cells, maxLevel: 1 };
  }
  if (scheme === 'rz') {
    return { cells: bits.split('').map(b => b === '1' ? [1, 1, 0] : [-1, -1, 0]), maxLevel: 1 };
  }
  if (scheme === 'manchester') {
    return { cells: bits.split('').map(b => b === '1' ? [1, -1] : [-1, 1]), maxLevel: 1 };
  }
  if (scheme === 'diffmanchester') {
    let level = 1;
    const cells = bits.split('').map(b => {
      if (b === '0') level = -level;
      const first = level;
      level = -level;
      const second = level;
      return [first, second];
    });
    return { cells, maxLevel: 1 };
  }
  if (scheme === 'ami') {
    let pol = 1;
    const cells = bits.split('').map(b => {
      if (b === '1') { pol = -pol; return [pol, pol]; }
      return [0, 0];
    });
    return { cells, maxLevel: 1 };
  }
  if (scheme === 'pseudoternary') {
    let pol = 1;
    const cells = bits.split('').map(b => {
      if (b === '0') { pol = -pol; return [pol, pol]; }
      return [0, 0];
    });
    return { cells, maxLevel: 1 };
  }
  if (scheme === 'twob1q') {
    let padded = bits.length % 2 ? bits + '0' : bits;
    const map = { '00': -3, '01': -1, '11': 1, '10': 3 };
    const cells = [];
    for (let i = 0; i < padded.length; i += 2) {
      const lvl = map[padded.slice(i, i + 2)];
      cells.push([lvl, lvl]);
    }
    return { cells, maxLevel: 3 };
  }
  if (scheme === 'mlt3') {
    const cycle = [0, 1, 0, -1];
    let idx = 0;
    const cells = bits.split('').map(b => {
      if (b === '1') { idx = (idx + 1) % 4; }
      const lvl = cycle[idx];
      return [lvl, lvl];
    });
    return { cells, maxLevel: 1 };
  }
  if (scheme === 'b8zs') {
    const levels = [];
    let lastPol = 1;
    const arr = bits.split('');
    let i = 0;
    while (i < arr.length) {
      if (arr.slice(i, i + 8).join('') === '00000000') {
        const pat = lastPol === 1 ? [0, 0, 0, 1, -1, 0, -1, 1] : [0, 0, 0, -1, 1, 0, 1, -1];
        pat.forEach(v => levels.push(v));
        lastPol = pat[pat.length - 1];
        i += 8;
      } else {
        const b = arr[i];
        if (b === '1') { lastPol = -lastPol;
          levels.push(lastPol); } else levels.push(0);
        i++;
      }
    }
    return { cells: levels.map(l => [l, l]), maxLevel: 1 };
  }
  if (scheme === 'hdb3') {
    const levels = [];
    let lastPol = -1;
    let pulseCount = 0;
    const arr = bits.split('');
    let i = 0;
    while (i < arr.length) {
      if (arr.slice(i, i + 4).join('') === '0000') {
        const odd = (pulseCount % 2 === 1);
        let pat;
        if (odd) { pat = [0, 0, 0, lastPol]; } else { const B = -lastPol;
          pat = [B, 0, 0, B]; }
        pat.forEach(v => levels.push(v));
        lastPol = pat[pat.length - 1];
        pulseCount = 0;
        i += 4;
      } else {
        const b = arr[i];
        if (b === '1') { lastPol = -lastPol;
          levels.push(lastPol);
          pulseCount++; } else levels.push(0);
        i++;
      }
    }
    return { cells: levels.map(l => [l, l]), maxLevel: 1 };
  }
  if (scheme === 'fourb5b') {
    let padded = bits;
    while (padded.length % 4 !== 0) padded += '0';
    let coded = '';
    for (let i = 0; i < padded.length; i += 4) {
      coded += FOURB5B_TABLE[padded.slice(i, i + 4)] || '00000';
    }
    let last = -1;
    const cells = coded.split('').map(b => {
      if (b === '1') last = -last;
      return [last, last];
    });
    return { cells, maxLevel: 1, note: `4-bit groups → 5-bit codes: ${coded}, then sent using NRZI.` };
  }
  return { cells: bits.split('').map(b => [b === '1' ? 1 : -1, b === '1' ? 1 : -1]), maxLevel: 1 };
}

function renderEncodingWaveform(bits, scheme) {
  const info = ENCODING_INFO[scheme];
  if (info && info.noWave) {
    return `<div class="muted" style="text-align:center; padding:30px; font-size:12.5px;">8B/10B relies on a running-disparity symbol table too large for an interactive demo here — see the theory panel for how it works.</div>`;
  }
  const { cells, maxLevel, note } = encodeAdvanced(bits, scheme);
  const segW = 40;
  const totalSegs = cells.reduce((a, c) => a + c.length, 0);
  const totalW = totalSegs * segW;
  const h = 110;
  const midY = 55;
  const amp = 40;
  let path = '';
  let x = 0;
  cells.forEach(cell => {
    cell.forEach((lvl, si) => {
      const y = midY - (lvl / maxLevel) * amp;
      if (x === 0 && si === 0) path += `M ${x} ${y} `;
      else path += `L ${x} ${y} `;
      x += segW;
      path += `L ${x} ${y} `;
    });
  });
  let bitLabels = '';
  let bx = 0;
  bits.split('').forEach((b, i) => {
    const w = (cells[i] ? cells[i].length : 2) * segW;
    bitLabels += `<text x="${bx + w / 2}" y="${h - 4}" font-size="11" fill="var(--muted)" text-anchor="middle" font-family="var(--mono)">${b}</text>`;
    bx += w;
  });
  let gridLines = '';
  let gx = 0;
  cells.forEach(c => {
    gridLines += `<line x1="${gx}" y1="8" x2="${gx}" y2="${midY + amp + 6}" stroke="var(--line-soft)" stroke-width="1"/>`;
    gx += c.length * segW;
  });
  gridLines += `<line x1="${gx}" y1="8" x2="${gx}" y2="${midY + amp + 6}" stroke="var(--line-soft)" stroke-width="1"/>`;
  let levelLabels = '';
  if (maxLevel > 1) {
    [-maxLevel, 0, maxLevel].forEach(l => {
      levelLabels += `<text x="-6" y="${midY - (l / maxLevel) * amp + 4}" font-size="9" text-anchor="end" fill="var(--muted2)" font-family="var(--mono)">${l > 0 ? '+' : ''}${l}</text>`;
    });
  }
  return `<div class="waveform-wrap">${note ? `<div class="mono muted" style="font-size:11px; margin-bottom:8px;">${esc(note)}</div>` : ''}<svg class="wave" width="${totalW + 20}" height="${h + 10}" viewBox="-20 0 ${totalW + 40} ${h + 10}">
      <line x1="0" y1="${midY}" x2="${totalW}" y2="${midY}" stroke="var(--line)" stroke-dasharray="3,3"/>
      ${gridLines}${levelLabels}<path d="${path}" fill="none" stroke="var(--phy)" stroke-width="2.5" stroke-linejoin="round"/>${bitLabels}
    </svg></div>`;
}

function renderEncodingInfo(scheme) {
  const i = ENCODING_INFO[scheme];
  return `<h4>Theory</h4><p>${i.theory}</p>
    <h4 style="margin-top:10px;">Synchronization</h4><p>${i.sync}</p>
    <h4 style="margin-top:10px;">Advantages</h4><ul>${i.adv.map(a => `<li>${a}</li>`).join('')}</ul>
    <h4 style="margin-top:10px;">Disadvantages</h4><ul>${i.dis.map(a => `<li>${a}</li>`).join('')}</ul>
    <h4 style="margin-top:10px;">Applications</h4><ul>${i.apps.map(a => `<li>${a}</li>`).join('')}</ul>`;
}