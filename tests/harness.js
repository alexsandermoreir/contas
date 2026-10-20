// Abre o index.html num navegador simulado (jsdom), com a data fixa em 20/10/2026 às 12h
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const F = path.join(__dirname, '..', 'index.html');

function boot(opts = {}) {
  const html = fs.readFileSync(F, 'utf8');
  const now = opts.now || '2026-10-20T12:00:00';
  const dom = new JSDOM(html, {
    url: 'https://example.test/contas/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      const RealDate = w.Date, fixed = new RealDate(now).getTime();
      class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
      w.Date = FakeDate;
      if (opts.state) w.localStorage.setItem('minhas-contas-v2', JSON.stringify(opts.state));
      w.scrollTo = () => {}; w.print = () => {};
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.requestAnimationFrame = f => setTimeout(f, 0);
      w.navigator.clipboard = { writeText: () => Promise.resolve() };
    },
  });
  const w = dom.window, errs = [];
  w.addEventListener('error', e => errs.push(e.message));
  return { dom, w, ev: s => w.eval(s), doc: w.document, errs };
}

/* Estado de teste: os dados do próprio app + cartões com fechamento, antecipação e assinaturas no cartão */
let cached;
function estado() {
  if (cached) return JSON.parse(cached);
  const { ev } = boot();
  ev(`(() => {
    const byN = n => S.cards.find(c => c.name === n);
    const nu = byN('Meu Nubank'), bela = byN('Nubank Bela'), itau = byN('Itaúcard');
    Object.assign(nu, { closeDay: 3, dueDay: 10, limit: 500000, color: '#8A05BE' });
    Object.assign(bela, { closeDay: 27, dueDay: 3, limit: 300000, color: '#1C1C1E' });
    Object.assign(itau, { closeDay: 30, dueDay: 6, limit: 400000, color: '#EC7000' });
    ['Claro Flex','Blink Fibra','Claude','Google One','Uber + iFood'].forEach(n => { const s = S.subs.find(s=>s.name===n); if (n==='Claro Flex'||n==='Blink Fibra') s.day = 10; s.cardId = nu.id; });
    ['iCloud','Meli+'].forEach(n => { S.subs.find(s=>s.name===n).cardId = bela.id; });
    S.installments[0].cardId = itau.id; S.installments[0].day = 15;
    /* provisão de cada cartão (o total que costuma vir na fatura) */
    const au = (c, k) => sum(outItems(k).filter(o => o.card === c.id && !o.extra));
    nu.prov = au(nu, '2026-11') + 50000; bela.prov = au(bela, '2026-11') + 100000; itau.prov = au(itau, '2026-11') + 150000;
    S.cardPays = [{ id: uid(), cardId: nu.id, fatura: '2026-11', date: '2026-10-16', cents: 158538 }];
    save();
  })()`);
  cached = ev('JSON.stringify(S)');
  return JSON.parse(cached);
}

/* Contador simples de testes */
function suite(name) {
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log(`  FALHOU [${name}]: ${m}`); } };
  const end = () => { console.log(`${name}: ${pass} passaram, ${fail} falharam`); if (fail) process.exitCode = 1; };
  return { ok, end };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = { boot, estado, suite, wait };
