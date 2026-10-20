const H = require('./harness'); const boot = (_f, o) => H.boot(o);
const state = H.estado();
const F = '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FALHOU:', m); } };
function app() {
  const a = boot(F, { state }); const errs = []; a.w.addEventListener('error', e => errs.push(e.message)); a.errs = errs;
  /* cartão novo: fecha dia 15, vence dia 25; assinatura dia 5 e parcela dia 8 */
  a.ev(`(() => { const c = { id: 'tc', name: 'Cartão Teste', color: '#0A84FF', closeDay: 15, dueDay: 25, limit: 500000, paidFatura: {} }; S.cards.push(c);
    S.subs.push({ id: 'sp', name: 'Spotify', cents: 2190, day: 5, since: '2026-09', paid: {}, cardId: 'tc' });
    S.installments.push({ id: 'ip', name: 'Fone', cents: 10000, total: 3, start: '2026-10', day: 8, paid: {}, cardId: 'tc' });
    save(); ui.tab = 'home'; render(); })()`);
  return a;
}
const fat = (ev, k) => JSON.parse(ev(`JSON.stringify(faturaRows('${k}').find(x => x.it.id === 'tc') || null)`));

/* 1. Aviso no Início a partir do fechamento */
{ const { ev, doc } = app();
  const r = [...doc.querySelectorAll('.remind')].map(x => x.textContent.replace(/\s+/g, ' '));
  ok(r.some(t => /Cartão Teste fechou/.test(t)), 'Aviso "A fatura do Cartão Teste fechou" no Início');
  ok(fat(ev, '2026-10').needsFinal === true, 'Fatura de outubro marcada como "falta o valor final"');
  ok(fat(ev, '2026-10').cents === 12190, 'Antes do valor final: só os automáticos (R$ 121,90)');
  /* tocar no aviso abre o formulário com os automáticos */
  doc.querySelector('.remind[data-id="tc"]').click();
  ok(/Automáticos/.test(doc.querySelector('.sheet').textContent) && /121,90/.test(doc.querySelector('.sheet').textContent), 'Formulário mostra os automáticos R$ 121,90');
  ev(`setC($('#f-amount'), 30000)`); doc.querySelector('#f-amount').dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true }));
  doc.querySelector('[data-sheet="save"]').click();
  const f = fat(ev, '2026-10');
  ok(f.cents === 30000, 'Fatura fica com o valor final R$ 300,00');
  const ex = JSON.parse(ev(`JSON.stringify(cardItems('tc','2026-10').filter(o => o.extra).map(o => [o.name, o.cents]))`));
  ok(ex.length === 1 && ex[0][0] === 'Extras' && ex[0][1] === 17810, 'Extras = 300,00 − 121,90 = R$ 178,10: ' + JSON.stringify(ex));
  ok(!f.needsFinal, 'Depois de colocar, não pede mais');
  ok(![...doc.querySelectorAll('.remind')].some(x => /Cartão Teste/.test(x.textContent)), 'Aviso some do Início');
  /* extras viram previsão (*) nos próximos meses */
  const nov = JSON.parse(ev(`JSON.stringify(cardItems('tc','2026-11').filter(o => o.extra).map(o => [o.cents, o.est]))`));
  ok(nov.length === 1 && nov[0][0] === 17810 && nov[0][1] === true, 'Novembro: extras previstos R$ 178,10* ' + JSON.stringify(nov));
  /* um automático novo diminui os extras, e a fatura continua no valor final */
  ev(`S.subs.push({ id: 'nx', name: 'Netflix', cents: 3990, day: 2, since: '2026-10', paid: {}, cardId: 'tc' }); save();`);
  ok(fat(ev, '2026-10').cents === 30000, 'Com automático novo, a fatura continua R$ 300,00');
  ok(ev(`cardItems('tc','2026-10').find(o => o.extra).cents`) === 13820, 'E os extras viram R$ 138,20');
  /* pagar a fatura paga tudo, inclusive os extras */
  ev(`ui.tab='mes'; ui.view='2026-10'; render()`);
  doc.querySelector('.item[data-type="fatura"][data-id="tc"] button.tick').click();
  ok(ev(`cardUsage(cardById('tc'),'2026-10').paid`) === true, 'Bolinha da fatura paga tudo, inclusive os extras');
  ev(`applyToggle('fatura','tc')`);
  ok(ev(`cardUsage(cardById('tc'),'2026-10').paid`) === false, 'Desmarcar volta');
}
(async () => {
/* 2. Bolinha de fatura fechada sem valor final pergunta o valor */
{ const { ev, doc } = app();
  ev(`ui.tab='mes'; ui.view='2026-10'; render()`);
  const row = doc.querySelector('.item[data-type="fatura"][data-id="tc"]');
  ok(/falta o valor final/i.test(row.textContent), 'Linha da fatura avisa "Falta o valor final"');
  row.querySelector('button.tick').click();
  ok(!!doc.querySelector('.sheet #f-amount') && doc.querySelector('#f-paid').checked, 'Bolinha abre o valor da fatura com "Já paguei" ligado');
  ev(`setC($('#f-amount'), 10000)`); doc.querySelector('#f-amount').dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  ok(!doc.querySelector('#f-ex-warn').hidden, 'Valor menor que os automáticos mostra aviso');
  doc.querySelector('[data-sheet="save"]').click();
  ok(fat(ev, '2026-10').cents === 10000, 'Fatura menor: fica R$ 100,00 (ajuste de −R$ 21,90)');
  ok(ev(`cardUsage(cardById('tc'),'2026-10').paid`) === true, 'E fica paga');
  /* tirar o valor final */
  ev(`openFaturaValue('tc','2026-10')`); doc.querySelector('[data-sheet="delete"]').click();
  ok(fat(ev, '2026-10').cents === 12190 && fat(ev, '2026-10').needsFinal, 'Tirar o valor final volta aos automáticos');
}
/* 3. Fatura que ainda não fechou não pede valor; tela do cartão mostra a linha */
{ const { ev, doc, errs } = app();
  ok(!fat(ev, '2026-11').needsFinal, 'Novembro (não fechou) não pede valor final');
  ev(`ui.tab='cards'; ui.view='2026-10'; ui.page='card:tc'; render()`);
  ok(/Valor final da fatura/.test(doc.body.textContent), 'Tela do cartão tem "Valor final da fatura"');
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 4. Minúsculas */
{ const { doc, w } = app();
  await new Promise(r => setTimeout(r, 20)); const t = doc.querySelector('.title').textContent; ok(t === t.toLowerCase(), 'Texto do app em minúsculas');
}
console.log(`valor-final-fatura.test.js: ${pass} passaram, ${fail} falharam`); if (fail) process.exitCode = 1;
})();
