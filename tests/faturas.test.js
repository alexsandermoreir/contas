// Cartões e faturas: provisão (*), prévia antes de fechar, fatura fechada, assinaturas sem duplicar, cancelar, categorias
const H = require('./harness');
const t = H.suite('faturas.test.js');
(async () => {
  const Ev = d => d.defaultView.Event;
  const money = (doc, ev, c) => { ev(`setC($('#f-amount'), ${c})`); doc.querySelector('#f-amount').dispatchEvent(new (Ev(doc))('input', { bubbles: true })); };

  /* 1. Provisão: Itaú com provisão R$ 1.500 → novembro estimado (*) */
  { const { ev } = H.boot({ state: H.estado() }); const id = ev(`S.cards.find(c => c.name === 'Itaúcard').id`);
    ev(`cardById('${id}').prov = 150000`);
    const autos = ev(`sum(cardItems('${id}', '2026-12').filter(o => !o.extra))`);
    const f = JSON.parse(ev(`JSON.stringify(faturaRows('2026-12').find(x => x.it.id === '${id}'))`));
    t.ok(f.cents === Math.max(autos, 150000) && f.est, `Dezembro: fatura estimada pela provisão = R$ 1.500 (*) [${f.cents}]`);
    const ex = JSON.parse(ev(`JSON.stringify(cardItems('${id}', '2026-12').find(o => o.extra))`));
    t.ok(ex && ex.cents === 150000 - autos && ex.state === 'estimada', 'Extras previstos = provisão − o que está anotado'); }

  /* 2. Prévia: novembro do Itaú ainda não fechou; lanço R$ 1.800 */
  { const { ev, doc } = H.boot({ state: H.estado() }); const id = ev(`S.cards.find(c => c.name === 'Itaúcard').id`);
    t.ok(!ev(`isClosed(cardById('${id}'), '2026-12')`), 'Fatura de dezembro do Itaú ainda não fechou');
    ev(`openFaturaValue('${id}', '2026-12')`); await H.wait(20);
    t.ok(/prévia/i.test(doc.querySelector('.sheet h2').textContent), 'Formulário de prévia');
    money(doc, ev, 180000); await H.wait(20); doc.querySelector('[data-sheet="save"]').click(); await H.wait(300);
    const f = JSON.parse(ev(`JSON.stringify(faturaRows('2026-12').find(x => x.it.id === '${id}'))`));
    t.ok(f.cents === 180000 && !f.est && /prévia/i.test(f.tag), 'Dezembro fica R$ 1.800 como prévia (sem *)');
    t.ok(ev(`prevOf(cardById('${id}'), '2026-12')`) === 180000 && ev(`finalOf(cardById('${id}'), '2026-12')`) === null, 'Guardado como prévia, não fechada'); }

  /* 3. No fechamento: aviso com a prévia; confirmar vira fechada */
  { const { ev, doc } = H.boot({ state: H.estado() }); const id = ev(`S.cards.find(c => c.name === 'Nubank Bela').id`);
    /* Nubank Bela fecha dia 27; a fatura de outubro já fechou */
    ev(`const c = cardById('${id}'); delete c.fechada['2026-10']; c.extraPaid = {}; month('2026-10'); c.prev = { '2026-10': 199000 };
        cardItems('${id}', '2026-10').forEach(o => { if (o.type === 'sub' || o.type === 'inst') o.it.paid = {}; else if (o.type === 'bill') o.it.paid = false; });`);
    ev(`ui.tab = 'home'; ui.page = null; render()`); await H.wait(30);
    const rem = [...doc.querySelectorAll('.remind')].map(x => x.textContent.replace(/\s+/g, ' ')).join(' | ');
    t.ok(/nubank bela/i.test(rem) && /confirme a prévia de R\$\s?1\.990,00/i.test(rem), 'Aviso: "confirme a prévia de R$ 1.990,00" — ' + rem);
    ev(`openFaturaValue('${id}', '2026-10')`); await H.wait(20);
    t.ok(/fechada/i.test(doc.querySelector('.sheet h2').textContent) && doc.querySelector('#f-amount').dataset.cents === '199000', 'Abre "fatura fechada" já com a prévia');
    doc.querySelector('[data-sheet="save"]').click(); await H.wait(300);
    t.ok(ev(`finalOf(cardById('${id}'), '2026-10')`) === 199000 && ev(`prevOf(cardById('${id}'), '2026-10')`) === null, 'Confirmar: vira fechada'); }

  /* 4. Assinatura nova no cartão: entra sozinha e não duplica a fatura fechada */
  { const { ev } = H.boot({ state: H.estado() }); const id = ev(`S.cards.find(c => c.name === 'Itaúcard').id`);
    ev(`cardById('${id}').fechada['2026-12'] = 200000`);
    const before = ev(`faturaRows('2026-12').find(x => x.it.id === '${id}').cents`);
    ev(`month('2026-12', true).bills.push({ id: 'nf', rid: 'rnf', name: 'Netflix', cents: 5590, kind: 'fixa', recurring: true, paid: false, cardId: '${id}', day: 2, cat: 'assinaturas' })`);
    t.ok(ev(`faturaRows('2026-12').find(x => x.it.id === '${id}').cents`) === before && before === 200000, 'Fatura fechada continua R$ 2.000 com a Netflix nova (sem duplicar)');
    t.ok(ev(`cardItems('${id}', '2026-12').find(o => o.extra).cents`) === 200000 - ev(`sum(cardItems('${id}', '2026-12').filter(o => !o.extra))`), 'Extras = fechada − anotado (a Netflix sai dos extras)'); }

  /* 5. Assinaturas: total e cancelar a partir do mês que vem */
  { const { ev, doc } = H.boot({ state: H.estado() });
    const tot = ev(`sum(subsList('2026-10'))`);
    ev(`ui.tab = 'more'; ui.page = 'subs'; render()`); await H.wait(20);
    t.ok(doc.querySelector('.hero-value').textContent.replace(/\s/g, '').includes(ev(`fmt(${tot})`).replace(/\s/g, '')), 'Tela de assinaturas mostra o total por mês');
    const row = [...doc.querySelectorAll('#view .item')].find(r => /claro flex/i.test(r.textContent));
    row.querySelector('[data-act="cancelSub"]').click(); await H.wait(30);
    doc.querySelector('.alert [data-r="2026-11"]').click(); await H.wait(300);
    t.ok(ev(`outItems('2026-10').some(o => o.name === 'Claro Flex')`) || ev(`outItems('2026-11').some(o => o.name === 'Claro Flex')`), 'Claro Flex ainda é cobrada até o cancelamento');
    t.ok(!ev(`outItems('2027-01').some(o => o.name === 'Claro Flex')`) && !ev(`subsList('2026-11').some(o => o.name === 'Claro Flex')`), 'Claro Flex some a partir de novembro');
    t.ok(ev(`sum(subsList('2026-11'))`) < tot, 'Total de assinaturas diminui'); }

  /* 6. Mês por categoria, com o que tem dentro das faturas */
  { const { ev, doc } = H.boot({ state: H.estado() }); ev(`ui.tab = 'mes'; ui.view = '2026-11'; ui.list = 'out'; render()`); await H.wait(20);
    const labels = [...doc.querySelectorAll('#view .catrow .cat-top span')].map(x => x.textContent);
    t.ok(labels.includes('viagem ao japão') && labels.includes('cartões') && labels.includes('assinaturas') && labels.includes('contas da casa'), 'Para onde vai: viagem ao japão (projeto), cartões, assinaturas e contas da casa — ' + labels.join(', '));
    const items = ev(`sum(outItems('2026-11').filter(o => o.type !== 'cpay'))`), shown = ev(`[...document.querySelectorAll('#view .catrow b')].reduce((a, b) => a + Math.round(parseFloat(b.textContent.replace(/[^\\d,]/g, '').replace(',', '.')) * 100), 0)`);
    t.ok(Math.abs(items - shown) <= 2, `Soma das categorias bate com as saídas (${items} x ${shown})`); }

  /* 7. Dados antigos (contas "base" do cartão) viram fechada/provisão sem mudar os totais */
  { const old = { v: 4, mineLoaded: true, novLoaded: true, cardsFixed: true, cardsMerged: true, japanFixed: true, investSeeded: true, theme: 'claro',
      cards: [{ id: 'c1', name: 'Itaú', closeDay: 30, dueDay: 6, limit: 400000, color: '#EC7000' }],
      months: { '2026-10': { bills: [{ id: 'b1', name: 'Itaú', cents: 134068, kind: 'fixa', recurring: true, paid: true, cardId: 'c1', cardBase: true }], incomes: [] },
                '2026-11': { bills: [{ id: 'b2', name: 'Itaú', cents: 150000, kind: 'fixa', recurring: true, paid: false, estimate: true, variable: true, cardId: 'c1', cardBase: true }], incomes: [] } },
      installments: [{ id: 'i1', name: 'Cama', cents: 32300, total: 12, start: '2025-12', day: 15, paid: {}, cardId: 'c1' }], subs: [], receivables: [], payables: [], debts: [], projects: [], provisions: [] };
    const { ev } = H.boot({ state: old });
    t.ok(ev(`Object.values(S.months).every(m => !m.bills.some(b => b.cardBase))`), 'Contas "base" antigas saem');
    t.ok(ev(`cardById('c1').fechada['2026-10']`) === 166368, 'Outubro vira fechada com o mesmo total (R$ 1.663,68)');
    t.ok(ev(`faturaRows('2026-11').find(x => x.it.id === 'c1').cents`) === 182300 && ev(`faturaRows('2026-11').find(x => x.it.id === 'c1').est`), 'Novembro continua R$ 1.823,00 (*) pela provisão');
    t.ok(ev(`cardById('c1').prov`) === 182300, 'Provisão do cartão = R$ 1.823,00'); }
  t.end();
})();
