const H = require('./harness'); const boot = (_f, o) => H.boot(o);
const state = H.estado();
const F = '';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FALHOU:', m); } };
const { ev, doc, w } = boot(F, { state }); const errs = []; w.addEventListener('error', e => errs.push(e.message));
const bad = () => { const t = [...doc.body.children].filter(e => e.tagName !== 'SCRIPT').map(e => e.textContent).join(' '); return /NaN|undefined|null|\[object/.test(t) ? t.match(/.{0,40}(NaN|undefined|null|\[object).{0,40}/)[0] : ''; };
const pages = [['home', null], ['mes', null], ['cards', null], ['projects', null], ['prov', null], ['more', null], ['more', 'pay'], ['more', 'recv'], ['more', 'debts'], ['more', 'prefs'], ['more', 'cats'], ['more', 'cloud']];
ev(`S.cards.forEach(c => {}); S.projects.forEach(p => {});`);
const ids = JSON.parse(ev(`JSON.stringify({ c: S.cards.map(c => c.id), p: S.projects.map(p => p.id), v: (S.provisions || []).map(p => p.id) })`));
ids.c.forEach(id => pages.push(['cards', 'card:' + id])); ids.p.forEach(id => pages.push(['projects', 'proj:' + id])); ids.v.forEach(id => pages.push(['prov', 'prov:' + id]));
for (const k of ['2026-09', '2026-10', '2026-11', '2026-12']) for (const [tab, page] of pages) {
  ev(`ui.tab='${tab}'; ui.page=${page ? `'${page}'` : 'null'}; ui.view='${k}'; ui.list='out'; render()`);
  ok(!bad(), `${tab}/${page} ${k}: texto quebrado "${bad()}"`);
  if (tab === 'mes') { ev(`ui.list='in'; render()`); ok(!bad(), `mes entradas ${k}: "${bad()}"`); }
}
/* abre o formulário de cada item de cada lista */
for (const k of ['2026-10', '2026-11']) {
  ev(`ui.tab='mes'; ui.page=null; ui.view='${k}'; ui.list='out'; render()`);
  const rows = [...doc.querySelectorAll('#app .item[data-type]')].map(r => [r.dataset.type, r.dataset.id]);
  for (const [t, id] of rows) { ev(`editAny('${t}','${id}')`); ok(!bad(), `abrir ${t} ${k}: "${bad()}"`); ev(`closeSheet(); if (ui.tab !== 'mes') { ui.tab='mes'; ui.page=null; render(); }`); }
}
for (const fn of ['openItem({mode:"out"})', 'openItem({mode:"in"})', 'openCard()', 'openProject()', 'openTripItem(S.projects[0])', 'openPerson("pay")', 'openPerson("recv")', 'openDebt()', 'openProv()', 'openFx()', 'openCardPay()', 'openEstorno()', 'openAporte()', 'fabAction()'])
  { try { ev(fn); ok(!bad(), `${fn}: "${bad()}"`); } catch (e) { ok(false, fn + ': ' + e.message); } ev('closeSheet()'); }
setTimeout(() => { ok(!errs.length, 'Sem erros: ' + errs.join(' | ')); console.log(`varredura.test.js: ${pass} passaram, ${fail} falharam`); if (fail) process.exitCode = 1; }, 800);
