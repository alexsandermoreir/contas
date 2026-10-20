const H = require('./harness'); const boot = (_f, o) => H.boot(o);
const state = H.estado();
const F = '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FALHOU:', m); } };
function app(st) { const a = boot(F, { state: st || state }); const errs = []; a.w.addEventListener('error', e => errs.push(e.message)); a.errs = errs; return a; }
const rows = (doc) => [...doc.querySelectorAll('.item')].map(r => ({ el: r, name: r.querySelector('.nm')?.textContent, sub: r.querySelector('.item-sub')?.textContent || '', done: r.classList.contains('done'), tick: !!r.querySelector('button.tick'), card: !!r.querySelector('.cardmark'), type: r.dataset.type }));

/* 1. Novembro: Claro Flex de 10/11 aparece, sem risco e sem bolinha, apontando para a fatura de dezembro */
{ const { ev, doc } = app();
  ev(`ui.tab='mes'; ui.view='2026-11'; render()`);
  const r = rows(doc), claro = r.filter(x => x.name === 'Claro Flex');
  ok(claro.length === 1, 'Claro Flex aparece uma vez em novembro');
  ok(claro[0] && !claro[0].done && !claro[0].tick && claro[0].card, 'Claro Flex sem risco, sem bolinha, com cartãozinho');
  ok(claro[0] && /Dia 10/.test(claro[0].sub) && /fatura de dezembro/.test(claro[0].sub), 'Claro Flex: dia 10, fatura de dezembro');
  ok(!r.some(x => /Cobrado em/.test(x.sub)), 'Nada de "Cobrado em" na lista do mês');
  /* sem repetição: cada cartão uma vez, sem "Outras compras do cartão" */
  ['Nubank Bela', 'Itaúcard', 'Meu Nubank'].forEach(n => ok(r.filter(x => x.name === n).length === 1, `${n} aparece uma vez só`));
  ok(!r.some(x => /Outras compras do cartão/.test(x.sub)), 'Sem linhas "Outras compras do cartão"');
  ok(!r.some(x => /Já antecipado/.test(x.name || '')), 'Sem linha "Já antecipado" repetida');
  ok(r.filter(x => x.type === 'fatura').every(x => x.tick), 'Toda fatura tem bolinha');
}
/* 2. Outubro: Claro Flex de 10/10 aparece em outubro, apontando para a fatura de novembro */
{ const { ev, doc } = app();
  ev(`ui.tab='mes'; ui.view='2026-10'; render()`);
  const c = rows(doc).find(x => x.name === 'Claro Flex');
  ok(c && /fatura de novembro/.test(c.sub) && !c.done, 'Outubro: Claro Flex na fatura de novembro, sem risco');
}
/* 3. Os totais não mudaram: payItems soma igual a outItems (dinheiro que sai da conta) */
{ const { ev } = app();
  for (const k of ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']) {
    ev(`ensureMonth('${k}')`);
    const a = ev(`sum(outItems('${k}'))`), b = ev(`sum(payItems('${k}'))`);
    ok(a === b, `Total de ${k} igual (${a} x ${b})`);
    const t = JSON.parse(ev(`JSON.stringify(monthTotals('${k}'))`)), s = ev(`sum(faturaRows('${k}'))`);
    ok(t.paid <= t.out && t.toPay >= 0, `Pago e falta pagar coerentes em ${k}`);
    ok(s === ev(`S.cards.reduce((a,c)=>a+cardUsage(c,'${k}').fatura,0)`), `Faturas de ${k} batem com a tela do cartão`);
  }
}
/* 4. Falta pagar de outubro igual ao de antes da mudança (R$ 323,00) */
{ const { ev } = app(); ok(ev(`monthTotals('2026-10').toPay`) === 32300, 'Outubro: falta pagar continua R$ 323,00'); }
/* 5. Marcar a fatura pela bolinha marca tudo dela; desmarcar volta */
{ const { ev, doc, w } = app();
  ev(`ui.tab='mes'; ui.view='2026-10'; render()`);
  const itau = rows(doc).find(x => x.type === 'fatura' && x.name === 'Itaúcard');
  ok(itau && !itau.done, 'Fatura Itaú de outubro em aberto');
  itau.el.querySelector('button.tick').click();
  ok(!doc.querySelector('.sheet #f-amount'), 'Fatura já fechada (com valor): a bolinha marca direto, sem perguntar');
  ok(ev(`cardUsage(S.cards.find(c=>c.name==='Itaúcard'),'2026-10').paid`) === true, 'Bolinha marca a fatura como paga');
  ok(ev(`monthTotals('2026-10').toPay`) === 0, 'Outubro: tudo pago depois de marcar a fatura');
  ev(`applyToggle('fatura', S.cards.find(c=>c.name==='Itaúcard').id)`);
  ok(ev(`cardUsage(S.cards.find(c=>c.name==='Itaúcard'),'2026-10').paid`) === false, 'Desmarcar volta a fatura para em aberto');
}
/* 6. Fatura com valor estimado: a bolinha pergunta o valor certo */
{ const { ev, doc } = app();
  ev(`ui.tab='mes'; ui.view='2026-11'; render()`);
  const bela = rows(doc).find(x => x.type === 'fatura' && x.name === 'Nubank Bela');
  bela.el.querySelector('button.tick').click();
  const sheet = doc.querySelector('#f-amount');
  ok(!!sheet, 'Abre "Valor da fatura"');
  ev(`setC($('#f-amount'), 150000)`);
  doc.querySelector('[data-sheet="save"]').click();
  const id = ev(`S.cards.find(c=>c.name==='Nubank Bela').id`);
  ok(ev(`cardUsage(cardById('${id}'),'2026-11').fatura`) === 150000, 'Fatura fica com o valor digitado (R$ 1.500,00)');
  ok(ev(`cardUsage(cardById('${id}'),'2026-11').paid`) === true, 'E fica paga');
  ok(ev(`faturaRows('2026-11').find(x=>x.it.id==='${id}').est`) === false, 'Sem asterisco depois');
}
/* 7. Início: simples, sem meses vazios negativos, fatura como uma linha */
{ const { ev, doc, errs } = app();
  ev(`ui.tab='home'; render()`);
  const h2 = [...doc.querySelectorAll('h2')].map(x => x.textContent);
  ok(h2.join('|') === 'Para pagar|Meses', 'Início com só "Para pagar" e "Meses": ' + h2.join('|'));
  const ms = [...doc.querySelectorAll('.mrow .m-name')].map(x => x.textContent);
  ok(!ms.includes('Setembro') && !ms.includes('Agosto'), 'Sem meses antigos vazios: ' + ms.join(','));
  ok(ms[0] === 'Outubro' && ms.length === 3, 'Outubro + 2 meses de previsão');
  ok(doc.querySelectorAll('.tile').length >= 2, 'Quadradinhos no Início');
  const tp = rows(doc);
  ok(tp.some(x => x.type === 'fatura') && !tp.some(x => x.card), 'Para pagar: fatura como uma linha, sem compras do cartão');
  /* tocar na fatura abre a tela do cartão */
  doc.querySelector('.item[data-type="fatura"] .item-text').click();
  ok(ev('ui.tab') === 'cards' && /^card:/.test(ev('ui.page')), 'Tocar na fatura abre o cartão');
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 8. Relatório e telas do cartão funcionam */
{ const { ev, doc, errs, w } = app();
  const html = ev(`buildReport('2026-11')`);
  ok(/Compras no cartão em novembro/.test(html) && /Claro Flex/.test(html), 'Relatório tem as compras do cartão');
  for (const c of ev(`JSON.stringify(S.cards.map(c=>c.id))`) && JSON.parse(ev(`JSON.stringify(S.cards.map(c=>c.id))`))) { ev(`ui.tab='cards'; ui.page='card:${c}'; ui.view='2026-11'; render()`); }
  ev(`ui.tab='more'; ui.page='prefs'; render()`);
  ok(/Mostrar as compras do cartão/.test(doc.body.textContent), 'Ajuste novo aparece');
  ev(`S.prefs={showCardSpends:false}; ui.tab='mes'; ui.view='2026-11'; ui.page=null; render()`);
  ok(!rows(doc).some(x => x.card), 'Desligando o ajuste, as compras do cartão somem da lista');
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 9. Dados vazios e exemplo continuam funcionando */
{ const { ev, doc, errs } = app({ v: 4, months: {}, installments: [], subs: [], receivables: [], payables: [], debts: [], cards: [], projects: [], provisions: [], icons: {}, mineLoaded: true, novLoaded: true });
  ok(/Anotar o primeiro gasto/.test(doc.body.textContent), 'Tela vazia');
  ev(`seedExample()`); ev(`ui.tab='home'; render(); ui.tab='mes'; render();`);
  ok(!errs.length, 'Exemplo sem erros: ' + errs.join(';'));
}
console.log(`fatura-e-mes.test.js: ${pass} passaram, ${fail} falharam`); if (fail) process.exitCode = 1;
