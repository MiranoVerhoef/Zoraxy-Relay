// Keep everyday service actions visible; reveal diagnostics only when requested.
const OPEN_SERVICE_DETAILS = new Set();
const COLLAPSED_TUNNELS_KEY = 'relay.collapsed-tunnels:' + location.pathname;
const COLLAPSED_TUNNELS = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(COLLAPSED_TUNNELS_KEY) || '[]');
  if (Array.isArray(saved)) saved.filter(id => typeof id === 'string').forEach(id => COLLAPSED_TUNNELS.add(id));
} catch { /* The dashboard also works when browser storage is unavailable. */ }

function toggleTunnelCollapsed(id) {
  COLLAPSED_TUNNELS.has(id) ? COLLAPSED_TUNNELS.delete(id) : COLLAPSED_TUNNELS.add(id);
  try { localStorage.setItem(COLLAPSED_TUNNELS_KEY, JSON.stringify([...COLLAPSED_TUNNELS])); } catch {}
  OPEN_MENU = null;
  renderTunnels();
  document.getElementById('relay-toggle-' + id)?.focus({preventScroll: true});
}

function toggleServiceDetails(tid, sid) {
  const key = tid + '/' + sid;
  OPEN_SERVICE_DETAILS.has(key) ? OPEN_SERVICE_DETAILS.delete(key) : OPEN_SERVICE_DETAILS.add(key);
  renderTunnels();
}

function serviceAvailability(t, s) {
  if (!t.enabled || !s.enabled) return {label: 'Disabled', tone: 'muted'};
  if (!t.online) return {label: 'Tunnel offline', tone: 'warning'};
  if (!s.installed_route) return {label: 'Route not installed', tone: 'warning'};
  const health = healthFor(t.id, s.id);
  if (!health || health.status === 'unknown') return {label: 'Checking', tone: 'muted'};
  if (health.status === 'healthy') return {label: 'Healthy', tone: 'healthy'};
  return {label: health.status === 'unhealthy' ? 'Unhealthy' : health.status, tone: 'warning'};
}

renderTunnelGroup = function(t) {
  const c = CLIENT_STATS[t.id] || {}, services = t.services || [], counts = connectorCounts(c);
  const connected = t.enabled && t.online, open = OPEN_TUNNELS.has(t.id), menuId = 't-' + t.id;
  const label = !t.enabled ? 'Disabled' : connected ? 'Connected' : 'Offline';
  const needsAttention = services.filter(s => serviceAvailability(t, s).tone === 'warning').length;
  const serviceSummary = services.length + ' service' + (services.length === 1 ? '' : 's');
  const connectionSummary = counts.total ? `${counts.online} of ${counts.total} connectors online` : 'No connectors reported';
  const collapsed = COLLAPSED_TUNNELS.has(t.id);
  return `<article class="relay-tunnel ${open ? 'diagnostics-open' : ''} ${collapsed ? 'is-collapsed' : ''}">
    <header class="relay-tunnel-header">
      <div class="relay-tunnel-title"><h3><button class="relay-tunnel-toggle" id="relay-toggle-${esc(t.id)}" aria-expanded="${!collapsed}" aria-controls="relay-body-${esc(t.id)}" onclick="toggleTunnelCollapsed('${t.id}')"><span class="relay-tunnel-chevron" aria-hidden="true"></span>${esc(t.name)}</button></h3><span class="relay-connection ${connected ? 'healthy' : 'muted'}"><span class="status-dot ${connected ? 'ok' : ''}"></span>${label}</span>${collapsed ? `<span class="relay-collapsed-count">${serviceSummary}${needsAttention ? `<span class="relay-attention"> · ${needsAttention} need attention</span>` : ''}</span>` : ''}</div>
      <div class="relay-tunnel-actions"><button class="btn secondary compact" onclick="openSvc('${t.id}')">Add service</button><div class="manage-wrap"><button class="icon-btn" aria-label="Manage ${esc(t.name)}" onclick="toggleActionMenu('${menuId}',event)">•••</button>${renderTunnelMenu(t, menuId, versionMismatch(c))}</div></div>
    </header>
    <div id="relay-body-${esc(t.id)}"${collapsed ? ' hidden' : ''}>
    <div class="relay-tunnel-summary">${serviceSummary}${needsAttention ? `<span class="relay-attention">${needsAttention} need attention</span>` : ''}</div>
    ${renderServices(t)}
    <footer class="relay-connection-footer"><button class="relay-disclosure" aria-expanded="${open}" onclick="toggleTunnel('${t.id}')"><span aria-hidden="true">${open ? '▾' : '▸'}</span> Connection details</button><span>${connectionSummary}${versionMismatch(c) ? ' · Update available' : ''}</span></footer>
    ${open ? `<div class="relay-diagnostics">${renderConnectors(t, c)}</div>` : ''}
    </div>
  </article>`;
};

renderServices = function(t) {
  const services = t.services || [];
  if (!services.length) return `<div class="relay-empty"><strong>No services yet</strong><p>Publish a service to make an application available through this tunnel.</p><button class="btn secondary compact" onclick="openSvc('${t.id}')">Add your first service</button></div>`;
  return `<div class="relay-services"><div class="relay-service-columns" aria-hidden="true"><span>Service</span><span>Status</span><span>Actions</span></div>${services.map(s => renderServiceRow(t.id, s)).join('')}</div>`;
};

renderServiceRow = function(tid, s) {
  const t = TUNNELS.find(item => item.id === tid), state = serviceAvailability(t, s);
  const key = tid + '/' + s.id, open = OPEN_SERVICE_DETAILS.has(key), menuId = 's-' + tid + '-' + s.id;
  const health = healthFor(tid, s.id), installed = !!s.installed_route;
  return `<div class="relay-service">
    <div class="relay-service-row">
      <div class="relay-service-identity"><button class="relay-service-name" aria-expanded="${open}" onclick="toggleServiceDetails('${tid}','${s.id}')"><span>${esc(s.name || s.host)}</span><span class="relay-service-chevron" aria-hidden="true">${open ? '▾' : '▸'}</span></button><span class="relay-service-host">${esc(s.host)}${esc(s.path || '')}</span></div>
      <div class="relay-service-status"><span class="relay-state ${state.tone}"><span class="status-dot ${state.tone === 'healthy' ? 'ok' : ''}"></span>${esc(state.label)}</span>${s.skip_tls_verify ? '<span class="relay-tls-warning">TLS unchecked</span>' : ''}</div>
      <div class="service-actions">${installed && s.enabled && t.enabled ? `<button class="btn secondary compact" onclick="openService('${tid}','${s.id}')">Open</button>` : ''}<button class="btn secondary compact" onclick="openSvc('${tid}','${s.id}')">Edit</button><div class="manage-wrap"><button class="icon-btn" aria-label="More actions for ${esc(s.name || s.host)}" onclick="toggleActionMenu('${menuId}',event)">•••</button>${renderServiceMenu(tid, s, menuId)}</div></div>
    </div>
    ${open ? `<dl class="relay-service-details"><div><dt>Target</dt><dd>${esc(s.target)}</dd></div><div><dt>Route</dt><dd>${installed ? 'Installed' : 'Not installed'}</dd></div><div><dt>Response time</dt><dd>${health?.latency_ms > 0 ? esc(health.latency_ms) + ' ms' : 'Not available'}</dd></div><div><dt>Upstream TLS</dt><dd>${/^https:/i.test(s.target || '') ? s.skip_tls_verify ? 'Certificate verification disabled' : 'Certificate verification enabled' : 'HTTP target'}</dd></div>${health?.error ? `<div class="relay-health-error"><dt>Health check</dt><dd>${esc(health.error)}</dd></div>` : ''}</dl>` : ''}
  </div>`;
};

// Live refresh must not close a menu while the user is choosing an action.
const dashboardBaseInputFocused = inputFocused;
inputFocused = function() { return !!OPEN_MENU || dashboardBaseInputFocused(); };
