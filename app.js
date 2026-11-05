/* Golden Services — PWA de gestão de serviços com controle por e-mails autorizados */
const $ = s => document.querySelector(s);
const LS = {
  get: (k, d) => JSON.parse(localStorage.getItem(k) ?? 'null') ?? d,
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};
const state = {
  clients: LS.get('gs_clients', []),
  jobs: LS.get('gs_jobs', []),
  quotes: LS.get('gs_quotes', []),
  vehicles: LS.get('gs_vehicles', []),
  fuel: LS.get('gs_fuel', []),
};
const VALID_DEVICES = LS.get('gs_valid', {}); // {emailHash: true} por aparelho

const sha = str => crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  .then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}
const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ======================= PORTÃO DE SEGURANÇA ======================= */
let CAN_IN = false;

async function boot() {
  let cfg = { authorized: [], adminPassHash: '' };
  try { cfg = await (await fetch('authorized.json', { cache: 'no-store' })).json(); } catch {}
  window.__gsCfg = cfg;
  // dispositivos já liberados nesta sessão/local storage
  const okDevice = Object.entries(VALID_DEVICES)
    .some(([h, t]) => t === true && (cfg.authorized.includes(h) || LS.get('gs_deleted_' + h, false) !== true));
  if (okDevice) enter(Object.keys(VALID_DEVICES).find(h => VALID_DEVICES[h] === true) || '');
}
boot();

async function tryGate(inputEmail) {
  const cfg = window.__gsCfg || await Promise.reject('config indisponível');
  let email = inputEmail.trim().toLowerCase();
  // com invisível: '' + email allowlist --- compute hash of email and check
  const h = email ? await sha(email) : '';
  if (h && cfg.authorized.includes(h)) return { ok: true, email, hash: h };
  if (email && VALID_DEVICES[h] === true) return { ok: true, email, hash: h };
  return { ok: false };
}
async function tryAdmin(pass) {
  const cfg = window.__gsCfg || { adminPassHash: '' };
  return pass && (await sha(pass)) === cfg.adminPassHash;
}

function enter(hash = '', email = '') {
  CAN_IN = true;
  if (hash) VALID_DEVICES[hash] = true;
  LS.set('gs_valid', VALID_DEVICES);
  const chip = email || LS.get('gs_email', '');
  $('#userChip').textContent = chip || 'autorizado';
  LS.set('gs_email', chip);
  $('#gate').style.display = 'none';
  renderAll();
}

$('#gateBtn').onclick = async () => {
  const email = $('#gateEmail').value.trim().toLowerCase().replace(/\s+/g, '');
  if (!email) return gateMsg('Digite seu e-mail.');
  const cfg = window.__gsCfg;
  if (!cfg) {
    gateMsg('A lista de autorização não carregou. Recarregue a página (feito isso, tente de novo).');
    return;
  }
  const res = await tryGate(email);
  if (res.ok) return enter(res.hash, res.email);
  gateMsg('Recebido: "' + email + '" — este e-mail não está na lista autorizada (lista carregada com ' + (cfg.authorized?.length ?? 0) + ' e-mails). Confira a grafia ou entre como admin.');
};
$('#gateEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('#gateBtn').click(); });
$('#gateAdmin').onclick = () => openAdminGate();
function gateMsg(m) { $('#gateMsg').textContent = m; }

async function openAdminGate() {
  gateMsg('');
  const pass = prompt('Senha master do admin:');
  if (!(await tryAdmin(pass))) {
    gateMsg('⚠ Senha master inválida.');
    return false;
  }
  return true;
}

$('#gateAdmin').addEventListener('click', async () => {
  if (await openAdminGate()) {
    localAuth = [...new Set([...(window.__gsCfg?.authorized ?? []), ...Object.keys(VALID_DEVICES)])].filter(Boolean);
    $('#adminModal').classList.remove('hidden');
    renderAdmin();
  }
});
$('#adminClose').onclick = () => $('#adminModal').classList.add('hidden');

let localAuth = [...(window.__gsCfg?.authorized ?? []), ...Object.keys(VALID_DEVICES)].filter(Boolean);
function renderAdmin() {
  $('#adminList').innerHTML = localAuth.length
    ? localAuth.map(h => `<div class="item"><div class="info"><p style="color:var(--gold);font-size:.8rem">${h.slice(0, 12)}…</p></div>
      <button class="btn del" data-h="${h}">Remover</button></div>`).join('')
    : '<p class="empty">Nenhum e-mail autorizado neste aparelho.</p>';
  $('#adminList').querySelectorAll('.del').forEach(b => b.onclick = () => {
    const h = b.dataset.h;
    localAuth = localAuth.filter(x => x !== h);
    delete VALID_DEVICES[h];
    LS.set('gs_valid', VALID_DEVICES);
    LS.set('gs_deleted_' + h, true);
    renderAdmin();
  });
}
$('#adminAdd').onclick = async () => {
  const email = $('#adminEmail').value.trim().toLowerCase();
  if (!email) return toast('Digite um e-mail');
  const h = await sha(email);
  if (!localAuth.includes(h)) localAuth.push(h);
  VALID_DEVICES[h] = true;
  LS.set('gs_valid', VALID_DEVICES);
  $('#adminEmail').value = '';
  renderAdmin();
  toast('E-mail autorizado neste aparelho ✔');
};
const ADMIN_HASH = 'f2ec49cc591ff570c23765bca3530620a563a93f59da1cfd57971cfee6c173c8';
$('#adminExport').onclick = () => {
  const final = new Set([...localAuth, ...(window.__gsCfg?.authorized ?? [])].filter(Boolean));
  const blob = new Blob([JSON.stringify({
    _comment: 'Lista de e-mails autorizados (SHA-256). Gere hashes em generate-hash.html',
    adminPassHash: window.__gsCfg?.adminPassHash || ADMIN_HASH,
    authorized: [...final],
  }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'authorized.json';
  a.click();
  toast('Baixe e commite authorized.json no repo');
};

$('#logout').onclick = () => {
  CAN_IN = false;
  $('#gate').style.display = '';
};

/* ======================= NAVEGAÇÃO ======================= */
document.querySelectorAll('.nav-item').forEach(b => b.onclick = () => {
  document.querySelectorAll('.nav-item,.view').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#view-' + b.dataset.view).classList.add('active');
  closeSb();
});
$('#menuBtn').onclick = () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); };
$('#scrim').onclick = closeSb;
function closeSb() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }

/* ======================= ATENDIMENTO WHATSAPP ======================= */
const WA_TPLS = {
  lembrete: c => {
    const prox = state.jobs.filter(j => j.who === c.name && new Date(j.dt) >= new Date()).sort((a, b) => a.dt > b.dt ? 1 : -1)[0];
    const quando = prox ? new Date(prox.dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sua próxima visita';
    return `Olá ${c.name}! 🏛️\nPassando para confirmar seu agendamento em ${quando}.\nPrecisa ajustar algo? Estamos à disposição!\n— Golden Services`;
  },
  orcamento: c => {
    const q = state.quotes.filter(x => x.who === c.name && x.st === 'pendente').sort((a, b) => b.id - a.id)[0];
    return `Olá ${c.name}! 🏛️\nDeixamos registrado o orçamento de *${q?.svc || 'seu serviço'}* no valor de ${fmt(q?.v)}.\nPodemos seguir com o serviço? ✅\n— Golden Services`;
  },
  agradecimento: c => `Olá ${c.name}! 🙏\nObrigado pela confiança no trabalho. Qualquer necessidade, chama a gente!\n— Golden Services`,
  promocional: c => `Olá ${c.name}! 🌟\nTemos condições especiais neste mês para serviços agendados.\nQuer reservar uma vaga?\n— Golden Services`,
  livre: c => LS.get('gs_wa_free', `Olá ${c.name}! 🏛️\n`) || `Olá ${c.name}! 🏛️\n`,
};

let waClient = null;
function openWa(client) {
  waClient = client;
  const sel = $('#waTpl');
  sel.value = 'lembrete';
  $('#waMsg').value = WA_TPLS.lembrete(client);
  $('#waModal').classList.remove('hidden');
}
$('#waClose').onclick = () => $('#waModal').classList.add('hidden');
$('#waTpl').addEventListener('change', () => {
  const t = $('#waTpl').value;
  if (t === 'livre') {
    $('#waMsg').value = LS.get('gs_wa_free', `Olá ${waClient?.name || ''}! 🏛️\n`) || `Olá ${waClient?.name}! 🏛️\n`;
  } else {
    $('#waMsg').value = WA_TPLS[t](waClient);
  }
});
$('#waMsg').addEventListener('input', () => {
  if ($('#waTpl').value === 'livre') LS.set('gs_wa_free', $('#waMsg').value);
});
$('#waSend').onclick = () => {
  const phone = (waClient?.phone || '').replace(/\D/g, '');
  const txt = $('#waMsg').value;
  const url = `https://wa.me/${phone ? '55' + phone : ''}?text=${encodeURIComponent(txt)}`;
  window.open(url, '_blank');
  logWa(txt);
  $('#waModal').classList.add('hidden');
};
function logWa(txt) {
  const hist = LS.get('gs_wa_log', []);
  hist.unshift({ c: waClient?.name || '', t: txt, dt: Date.now() });
  LS.set('gs_wa_log', hist.slice(0, 30));
  const tpl = $('#waTpl').value;
  if (tpl && tpl !== 'livre') {
    const done = LS.get('gs_wa_done_' + tpl, []);
    if (!done.includes(waClient?.name)) LS.set('gs_wa_done_' + tpl, [...done, waClient?.name]);
  }
}

/* contato direto por modelo (botões de contato rápido) */
document.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => {
  if (!state.clients.length) return toast('Cadastre um cliente primeiro');
  const tpl = b.dataset.tpl;
  const done = LS.get('gs_wa_done_' + tpl, []);
  const next = state.clients.find(c => !done.includes(c.name));
  if (!next) return toast('Todos já receberam este modelo ✔');
  waClient = next;
  $('#waTpl').value = tpl;
  $('#waMsg').value = WA_TPLS[tpl](next);
  $('#waModal').classList.remove('hidden');
});

/* ======================= NÚCLEO ======================= */
function itemHTML(i, extra = '') {
  return `<div class="item"><div class="info"><h3>${i.title}</h3>${i.sub ? '<p>' + i.sub + '</p>' : ''}</div>${extra}<div>${i.val || ''}</div></div>`;
}

/* ======================= VEÍCULOS / FROTA ======================= */
$('#vhAdd').onclick = () => {
  const name = $('#vhName').value.trim(), model = $('#vhModel').value.trim();
  const km = +$('#vhKm').value || 0, fuel = $('#vhFuel').value;
  if (!name) return toast('Informe o apelido do veículo');
  state.vehicles.push({ id: Date.now() + '', name, model, km, fuel });
  LS.set('gs_vehicles', state.vehicles);
  ['#vhName', '#vhModel', '#vhKm'].forEach(s => $(s).value = '');
  renderVehicles(); renderDashboard(); toast('Veículo cadastrado 🚗');
};

function fillVehSelect() {
  $('#fufVeh').innerHTML = state.vehicles.length
    ? state.vehicles.map(v => `<option value="${v.id}">${v.name}${v.model ? ' · ' + v.model : ''}</option>`).join('')
    : '<option value="">— cadastre um veículo acima —</option>';
}

$('#fufVal').addEventListener('input', () => {
  $('#fufPrice').value = l && v ? (v / l).toFixed(2) : '';
});
$('#fufAdd').onclick = () => {
  const vid = $('#fufVeh').value, km = +$('#fufKm').value, l = +$('#fufL').value, v = +$('#fufVal').value;
  if (!vid) return toast('Cadastre um veículo primeiro');
  if (!km || !l || !v) return toast('KM, litros e valor obrigatórios');
  const prev = state.fuel.filter(f => f.v === vid).sort((a, b) => b.km - a.km)[0];
  const dist = prev ? km - prev.km : 0;
  if (prev && dist <= 0) return toast('KM menor/igual ao último registro (' + prev.km + ')');
  state.fuel.push({ id: Date.now() + '', v: vid, km, l, val: v, dt: Date.now() });
  LS.set('gs_fuel', state.fuel);
  $('#fufKm').value = $('#fufL').value = $('#fufVal').value = $('#fufPrice').value = '';
  renderVehicles(); renderDashboard();
  toast(prev ? `Consumo: ${(dist / l).toFixed(2)} km/L` : 'Abastecimento registrado ⛽');
};

function kmL(vid) {
  const recs = state.fuel.filter(f => f.v === vid).sort((a, b) => a.km - b.km);
  const rows = recs.map((f, i) => {
    if (i === 0) return null;
    const dist = f.km - recs[i - 1].km;
    return { kmL: dist / f.l, ckm: f.val / f.km === Infinity || !f.km ? 0 : f.val / f.km, dist };
  }).filter(Boolean);
  return {
    avg: rows.length ? rows.reduce((s, r) => s + r.kmL, 0) / rows.length : 0,
    last: rows.length ? rows[rows.length - 1] : 0,
    rows,
  };
}

function renderVehicles() {
  fillVehSelect();
  $('#vehiclesList').innerHTML = state.vehicles.length ? state.vehicles.map(v => {
    const c = kmL(v.id);
    const recs = state.fuel.filter(f => f.v === v.id).sort((a, b) => b.km - a.km).slice(0, 3);
    return `<div class="item" style="flex-wrap:wrap">
      <div class="info">
        <h3>🚗 ${v.name} <span class="pill p">${v.fuel}</span></h3>
        <p>${v.model || ''} · Odômetro: ${v.km.toLocaleString('pt-BR')} km</p>
        <p>Consumo médio: <b style="color:var(--gold)">${c.avg ? c.avg.toFixed(2) + ' km/L' : '—'}</b>
        · Custo/km: ${c.last && c.last.ckm ? fmt(c.last.ckm) : '—'}</p>
        ${recs.map(f => `<p style="font-size:.7rem">${new Date(f.dt).toLocaleDateString('pt-BR')} — ${f.km.toLocaleString('pt-BR')} km · ${f.l}L · ${fmt(f.val)}</p>`).join('')}
      </div>
      <button class="btn del" data-del-v="${v.id}">✕</button>
    </div>`;
  }).join('') : '<p class="empty">Nenhum veículo.</p>';
  $('#vehiclesList').querySelectorAll('[data-del-v]').forEach(b => b.onclick = () => {
    if (!confirm('Remover veículo e seus abastecimentos?')) return;
    const id = b.dataset.delV;
    state.vehicles = state.vehicles.filter(x => x.id !== id);
    state.fuel = state.fuel.filter(x => x.v !== id);
    LS.set('gs_vehicles', state.vehicles); LS.set('gs_fuel', state.fuel);
    renderVehicles(); renderDashboard(); toast('Removido');
  });
}

function renderDashboard() {
  if (!CAN_IN) return;
  const today = new Date().toISOString().slice(0, 10);
  const m = new Date().toISOString().slice(0, 7);
  $('#kpiToday').textContent = state.jobs.filter(j => (j.dt || '').startsWith(today)).length;
  $('#kpiMonth').textContent = fmt(state.jobs.filter(j => (j.dt || '').startsWith(m)).reduce((s, j) => s + (+j.v || 0), 0));
  $('#kpiPending').textContent = state.quotes.filter(q => q.st === 'pendente').length;
  $('#kpiClients').textContent = state.clients.length;

  // frota
  $('#kpiFleet').textContent = state.vehicles.length;
  const monthFuel = state.fuel.filter(f => new Date(f.dt).toISOString().slice(0, 7) === m);
  $('#kpiFuel').textContent = fmt(monthFuel.reduce((s, f) => s + f.val, 0));
  const avgs = state.vehicles.map(v => kmL(v.id).avg).filter(Boolean);
  $('#kpiKmL').textContent = avgs.length ? (avgs.reduce((s, a) => s + a, 0) / avgs.length).toFixed(2) : '—';
  const receita = state.jobs.filter(j => (j.dt || '').startsWith(m)).reduce((s, j) => s + (+j.v || 0), 0);
  const custoComb = monthFuel.reduce((s, f) => s + f.val, 0);
  $('#kpiBudget').textContent = fmt(Math.max(0, receita - custoComb));

  const up = [...state.jobs].sort((a, b) => (a.dt || '') > (b.dt || '') ? 1 : -1).slice(0, 5);
  $('#upcoming').innerHTML = up.length
    ? up.map(j => itemHTML({ title: `${j.who} — ${j.svc}`,
        sub: new Date(j.dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        val: `<span class="val">${fmt(j.v)}</span>` })).join('')
    : '<p class="empty">Nada agendado. Vá em 📅 Agenda.</p>';

  const lastF = [...state.fuel].sort((a, b) => b.dt - a.dt).slice(0, 4);
  $('#lastFuel').innerHTML = lastF.length ? lastF.map(f => {
    const v = state.vehicles.find(v => v.id === f.v);
    return itemHTML({ title: (v?.name || 'Veículo') + ' — ' + f.l + 'L',
      sub: new Date(f.dt).toLocaleDateString('pt-BR') + ' · ' + f.km.toLocaleString('pt-BR') + ' km',
      val: `<span class="val">${fmt(f.val)}</span>` });
  }).join('') : '<p class="empty">Sem abastecimentos registrados.</p>';
}

function renderAgenda() {
  const list = [...state.jobs].sort((a, b) => (a.dt || '') > (b.dt || '') ? 1 : -1);
  $('#agendaList').innerHTML = list.length ? list.map(j => itemHTML({
    title: `${j.who} — ${j.svc}`,
    sub: new Date(j.dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    val: `<span class="val">${fmt(j.v)}</span>`,
  }, `<button class="btn del" data-del-j="${j.id}">✕</button>`)).join('') : '<p class="empty">Sem compromissos.</p>';
  $('#agendaList').querySelectorAll('[data-del-j]').forEach(b => b.onclick = () => {
    state.jobs = state.jobs.filter(x => x.id !== b.dataset.delJ);
    LS.set('gs_jobs', state.jobs); renderAgenda(); renderDashboard(); toast('Removido');
  });
}
$('#agAdd').onclick = () => {
  const who = $('#agWho').value.trim(), svc = $('#agService').value.trim(),
        dt = $('#agDate').value, v = $('#agValue').value;
  if (!who || !dt) return toast('Cliente e data obrigatórios');
  state.jobs.push({ id: Date.now() + '', who, svc: svc || 'Serviço', dt, v: +v || 0 });
  LS.set('gs_jobs', state.jobs);
  ['#agWho', '#agService', '#agDate', '#agValue'].forEach(s => $(s).value = '');
  renderAgenda(); renderDashboard(); toast('Agendado 📅');
};

function renderClients() {
  const waLog = LS.get('gs_wa_log', []);
  $('#clientsList').innerHTML = state.clients.length ? state.clients.map(c => {
    const lastWa = waLog.find(w => w.c === c.name);
    return `<div class="item"><div class="info"><h3>${c.name}</h3><p>${c.phone || 'sem telefone'}
      ${lastWa ? `<br>💬 última mensagem ${new Date(lastWa.dt).toLocaleDateString('pt-BR')}` : ''}</p></div>
    <button class="btn ghost wa-btn" data-wa="${c.id}" title="WhatsApp">💬</button>
    <button class="btn del" data-del-c="${c.id}">✕</button></div>`;
  }).join('')
    : '<p class="empty">Sem clientes.</p>';
  $('#clientsList').querySelectorAll('[data-wa]').forEach(b => b.onclick = () => {
    openWa(state.clients.find(x => x.id === b.dataset.wa));
  });
  $('#clientsList').querySelectorAll('[data-del-c]').forEach(b => b.onclick = () => {
    state.clients = state.clients.filter(x => x.id !== b.dataset.delC);
    LS.set('gs_clients', state.clients); renderClients(); fillDatalist(); renderDashboard();
  });
}
$('#clAdd').onclick = () => {
  const name = $('#clName').value.trim();
  if (!name) return toast('Informe o nome');
  state.clients.push({ id: Date.now() + '', name, phone: $('#clPhone').value.trim() });
  LS.set('gs_clients', state.clients);
  $('#clName').value = $('#clPhone').value = '';
  renderClients(); fillDatalist(); renderDashboard(); toast('Cliente salvo 👥');
};
function fillDatalist() {
  $('#clientsDatalist').innerHTML = state.clients.map(c => `<option value="${c.name}">`).join('');
}

function renderQuotes() {
  const map = { pendente: 'p', aceito: 'a', recusado: 'r' };
  const label = { pendente: 'pendente', aceito: 'aceito', recusado: 'recusado' };
  $('#quotesList').innerHTML = state.quotes.length ? state.quotes.map(q =>
    `<div class="item"><div class="info"><h3>${q.who} — ${q.svc}
      <span class="pill ${map[q.st]}">${label[q.st]}</span></h3>
      <p>${new Date(q.id * 1).toLocaleDateString('pt-BR')}</p></div>
      <button class="btn del" data-del-q="${q.id}">✕</button></div>`).join('')
    : '<p class="empty">Sem orçamentos.</p>';
  $('#quotesList').querySelectorAll('[data-del-q]').forEach(b => b.onclick = () => {    state.quotes = state.quotes.filter(x => x.id !== b.dataset.delQ);
    LS.set('gs_quotes', state.quotes); renderQuotes(); renderDashboard();
  });
}
function _qDate(q) { return new Date(q.id * 1).toLocaleDateString('pt-BR'); }

$('#qcAdd').onclick = () => {
  const who = $('#qcWho').value.trim(), svc = $('#qcService').value.trim(),
        v = $('#qcValue').value, st = $('#qcStatus').value;
  if (!who || !svc) return toast('Cliente e serviço obrigatórios');
  state.quotes.push({ id: Date.now() + '', who, svc, v: +v || 0, st });
  LS.set('gs_quotes', state.quotes);
  ['#qcWho', '#qcService', '#qcValue'].forEach(s => $(s).value = '');
  renderQuotes(); renderDashboard(); updateWa(); toast('Orçamento salvo 🧾');
};
function updateWa() {
  const last = state.quotes[state.quotes.length - 1];
  if (!last) return;
  const phone = (state.clients.find(c => c.name === last.who)?.phone || '').replace(/\D/g, '');
  const txt = `Olá ${last.who}! 🏛️ Golden Services\nOrçamento: ${last.svc}\nValor: ${fmt(last.v)}\nAguardamos seu OK!`;
  $('#waLink').href = phone
    ? `https://wa.me/55${phone}?text=${encodeURIComponent(txt)}`
    : `https://wa.me/?text=${encodeURIComponent(txt)}`;
}

function renderAll() {
  if (!CAN_IN) return;
  renderDashboard(); renderAgenda(); renderClients(); renderQuotes(); fillDatalist(); updateWa(); renderVehicles();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
