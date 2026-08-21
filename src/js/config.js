/* ============================================================
   CONFIGURATION
   ============================================================ */

const LAYERS_OSI = [
  { key: 'app', name: 'Application', color: 'var(--app)' },
  { key: 'pres', name: 'Presentation', color: 'var(--pres)' },
  { key: 'sess', name: 'Session', color: 'var(--sess)' },
  { key: 'trans', name: 'Transport', color: 'var(--trans)' },
  { key: 'net', name: 'Network', color: 'var(--net)' },
  { key: 'link', name: 'Data Link', color: 'var(--link)' },
  { key: 'phy', name: 'Physical', color: 'var(--phy)' },
];

const LAYERS_TCPIP = [
  { key: 'app', name: 'Application', color: 'var(--app)' },
  { key: 'trans', name: 'Transport', color: 'var(--trans)' },
  { key: 'net', name: 'Network', color: 'var(--net)' },
  { key: 'link', name: 'Data Link', color: 'var(--link)' },
  { key: 'phy', name: 'Physical', color: 'var(--phy)' },
];

const DEVICE_ICON = {
  pc: '💻',  
  laptop: '💻',
  server: '🖥️',
  router: '📡',
  switch: '🔀',
  hub: '🔘',
  ap: '📶',
  firewall: '🧱',
  cloud: '☁️'
};

const L3_TYPES = new Set(['router', 'firewall', 'cloud']);
const L2_TYPES = new Set(['switch', 'hub', 'ap']);

const EDGE_TYPE_COST = { ethernet: 2, fiber: 1, wireless: 5 };