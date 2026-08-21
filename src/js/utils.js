/* ============================================================
   UTILITIES
   ============================================================ */

let currentModel = 'OSI';

function activeLayers() {
  return currentModel === 'OSI' ? LAYERS_OSI : LAYERS_TCPIP;
}

function mapLayerKey(key) {
  if (currentModel === 'TCPIP' && (key === 'pres' || key === 'sess')) return 'app';
  return key;
}

function getLayerColorVar(key) {
  const k = mapLayerKey(key);
  const l = activeLayers().find(x => x.key === k);
  return l ? l.color : 'var(--accent)';
}

function strToHex(s) {
  return [...s].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
}

function strToBin(s) {
  return [...s].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function charToBits(c) {
  return c.charCodeAt(0).toString(2).padStart(8, '0');
}

function rand() {
  return Math.random();
}

function chunk(str, size) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out.length ? out : [''];
}

function esc(s) {
  return (s + '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function randIp() {
  return `10.${Math.floor(rand() * 200) + 1}.${Math.floor(rand() * 254)}.${Math.floor(rand() * 254) + 1}`;
}

function cleanBits(str) {
  return (str || '').replace(/[^01]/g, '');
}

function pathCost(path, edgeTypeCosts) {
  let cost = path.nodes.length * 3;
  path.edges.forEach(e => { cost += (edgeTypeCosts[e.type] || 2); });
  return cost;
}