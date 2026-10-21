// Revisão geral: um teste para cada defeito encontrado usando o app como usuário
const H = require('./harness');
const t = H.suite('revisao.test.js');
(async () => {
  const fresh = () => H.boot({ state: H.estado() });
  const Ev = d => d.defaultView.Event;
  const input = (doc, sel, v) => { const e = doc.querySelector(sel); e.value = v; e.dispatchEvent(new (Ev(doc))('input', { bubbles: true })); e.dispatchEvent(new (Ev(doc))('change', { bubbles: true })); };
  const chip = (doc, box, v) => doc.querySelector(`#${box} .chip[data-v="${v}"]`).click();
  const tile = (doc, label) => [...doc.querySelectorAll('.addtile')].find(b => b.textContent.trim().toLowerCase() === label).click();

  /* 1. Antecipação paga no mesmo mês da fatura continua saindo da conta */
  { const { ev } = fresh(); const cid = ev(`S.cards.find(c => c.name === 'Itaúcard').id`);
    const before = ev(`monthTotals('2026-11').out`);
    ev(`S.cardPays.push({ id: 'cp1', cardId: '${cid}', fatura: '2026-11', date: '2026-11-02', cents: 10000 })`);
    t.ok(ev(`monthTotals('2026-11').out`) === before, 'Antecipação no mesmo mês: o total que sai não muda');
    t.ok(ev(`payItems('2026-11').some(o => o.type === 'cpay' && o.cents === 10000)`), 'Antecipação aparece como saída do mês');
    t.ok(ev(`faturaRows('2026-11').find(x => x.it.id === '${cid}').cents`) === ev(`cardUsage(cardById('${cid}'), '2026-11').gross`) - 10000, 'Fatura diminui o que foi antecipado'); }

  /* 2. Conta fixa: criar, mudar e apagar valem para os meses que já existem */
  { const { ev, doc } = fresh();
    ev(`ensureMonth('2026-12'); ensureMonth('2027-01'); ui.tab = 'mes'; ui.view = '2026-11'; render(); openItem({ mode: 'out' })`); await H.wait(20);
    ev(`setC($('#f-amount'), 5590)`); input(doc, '#f-name', 'Netflix'); input(doc, '#f-date', '2026-11-15'); chip(doc, 'f-freq', 'mes'); await H.wait(20);
    doc.querySelector('[data-sheet="save"]').click(); await H.wait(400);
    const has = k => ev(`month('${k}').bills.filter(b => b.name === 'Netflix').map(b => b.cents).join()`);
    t.ok(has('2026-11') === '5590' && has('2026-12') === '5590' && has('2027-01') === '5590', `Netflix nova aparece em nov, dez e jan: ${has('2026-11')}/${has('2026-12')}/${has('2027-01')}`);
    /* dezembro já pago não muda */
    ev(`month('2026-12').bills.find(b => b.name === 'Netflix').paid = true`);
    const id = ev(`month('2026-11').bills.find(b => b.name === 'Netflix').id`);
    ev(`openItem({ item: findItem('bill', '${id}'), itemType: 'bill' })`); await H.wait(20);
    ev(`setC($('#f-amount'), 6590)`); await H.wait(20); doc.querySelector('[data-sheet="save"]').click(); await H.wait(400);
    t.ok(has('2026-11') === '6590' && has('2027-01') === '6590', 'Mudar o valor em novembro muda janeiro também');
    t.ok(has('2026-12') === '5590', 'Dezembro (já pago) fica com o valor que foi pago');
    /* apagar: só deste mês */
    ev(`deleteItem('bill', '${id}')`); await H.wait(50);
    doc.querySelector('.alert [data-r="one"]').click(); await H.wait(300);
    t.ok(has('2026-11') === '' && has('2027-01') === '6590', 'Apagar "só de novembro" mantém janeiro');
    /* apagar: daqui em diante */
    const idJ = ev(`month('2027-01').bills.find(b => b.name === 'Netflix').id`);
    ev(`deleteItem('bill', '${idJ}')`); await H.wait(50); doc.querySelector('.alert [data-r="all"]').click(); await H.wait(300);
    ev(`ensureMonth('2027-02')`);
    t.ok(has('2027-01') === '' && has('2027-02') === '', 'Apagar "de janeiro em diante" para a conta');
    /* dados antigos: aluguel de todos os meses ligado */
    t.ok(ev(`new Set(Object.values(S.months).flatMap(m => m.bills).filter(b => b.name === 'Aluguel').map(b => b.rid)).size`) === 1, 'Aluguel de todos os meses fica ligado (mesmo rid)'); }

  /* 3. Conta sem dia continua sem dia depois de abrir e salvar */
  { const { ev, doc } = fresh(); const id = ev(`month('2026-11').bills.find(b => b.name === 'Aluguel').id`);
    ev(`ui.view = '2026-11'; openItem({ item: findItem('bill', '${id}'), itemType: 'bill' })`); await H.wait(20);
    doc.querySelector('[data-sheet="save"]').click(); await H.wait(300);
    t.ok(ev(`findItem('bill', '${id}').day`) == null, 'Aluguel sem dia continua sem dia'); }

  /* 4. Cartão: limite usado conta a compra feita hoje, e a tela abre na fatura certa */
  { const { ev } = fresh(); const cid = ev(`S.cards.find(c => c.name === 'Nubank Bela').id`);
    const u0 = ev(`cardLimit(cardById('${cid}')).used`);
    ev(`month('2026-10', true).bills.push({ id: 'cmp', name: 'Tênis', cents: 30000, kind: 'compra', recurring: false, paid: false, cardId: '${cid}', day: 20 })`);
    t.ok(ev(`cardLimit(cardById('${cid}')).used`) === u0 + 30000, 'Compra de hoje entra no limite usado');
    t.ok(ev(`openFatura(cardById('${cid}'))`) === '2026-11', 'Compra de hoje no Nubank Bela vai para a fatura de novembro');
    t.ok(/aberta/i.test(ev(`fatState(cardById('${cid}'), '2026-11', cardUsage(cardById('${cid}'), '2026-11'))`)), 'Fatura de novembro aparece como aberta'); }

  /* 5. Cartão novo não pede valor final de fatura antiga */
  { const { ev, doc } = fresh();
    ev(`openCard()`); await H.wait(20); input(doc, '#f-name', 'Inter'); input(doc, '#f-close', '3'); input(doc, '#f-due', '10'); await H.wait(20);
    doc.querySelector('[data-sheet="save"]').click(); await H.wait(300);
    const c = ev(`S.cards.find(c => c.name === 'Inter').id`);
    t.ok(!ev(`needsFinal(cardById('${c}'), lastClosed(cardById('${c}')))`), 'Inter recém-criado não pede valor final');
    ev(`ui.tab = 'home'; ui.page = null; render()`);
    t.ok(![...doc.querySelectorAll('.remind')].some(x => /inter/i.test(x.textContent)), 'Sem aviso de fatura fechada para o Inter'); }

  /* 6. Dívidas: o total usa o valor de hoje quando anotado */
  { const { ev, doc } = fresh(); ev(`ui.tab = 'more'; ui.page = 'debts'; render()`); await H.wait(20);
    const expected = ev(`fmt(S.debts.filter(d => d.status !== 'paga' && d.status !== 'prescrita').reduce((a, d) => a + (d.updatedCents || d.cents), 0))`);
    t.ok(doc.querySelector('.hero-value').textContent.replace(/\s/g, ' ').includes(expected.replace(/\s/g, ' ').toLowerCase().replace('r$', 'R$')), 'Total de dívidas com o valor de hoje: ' + expected); }

  /* 7. O + mostra o que dá para lançar naquela tela */
  { const { ev, doc } = fresh(); ev(`ui.tab = 'home'; render(); fabAction()`); await H.wait(20);
    const labels = [...doc.querySelectorAll('.addtile')].map(b => b.textContent.trim().toLowerCase());
    t.ok(['gasto', 'no cartão', 'entrada', 'assinatura', 'parcelado', 'anual', 'alguém pagou'].every(l => labels.includes(l)), 'Início: o + mostra os tipos em quadrados: ' + labels.join(', '));
    tile(doc, 'gasto'); await H.wait(20);
    t.ok(!!doc.querySelector('.sheet #f-amount') && /novo gasto/i.test(doc.querySelector('.sheet h2').textContent), 'Gasto abre o formulário "novo gasto"');
    ev(`closeSheet()`); await H.wait(400); ev(`ui.tab = 'cards'; ui.page = null; ui.cardSeg = 'cards'; render(); fabAction()`); await H.wait(20);
    t.ok([...doc.querySelectorAll('.addtile')].some(b => /compra no cartão/i.test(b.textContent)), 'Na aba cartões o + oferece compra no cartão'); }

  /* 8. Natureza: fixo ou variável (*), com lembrete; parcelado é sempre fixo */
  { const { ev, doc } = fresh(); ev(`openItem({ mode: 'out' })`); await H.wait(20);
    t.ok(!!doc.querySelector('#f-nat .chip[data-v="fixo"].on'), 'Começa como fixo');
    chip(doc, 'f-nat', 'var'); await H.wait(20);
    t.ok(!!doc.querySelector('#f-remind'), 'Variável: pede o dia do lembrete');
    chip(doc, 'f-freq', 'parc'); await H.wait(20);
    t.ok(!doc.querySelector('#f-nat'), 'Parcelado: sem fixo/variável'); }

  /* 10. Uma linha por pessoa no mês */
  { const { ev, doc } = fresh();
    const rows = JSON.parse(ev(`JSON.stringify(payItems('2026-11').filter(o => o.type === 'ppl').map(o => [o.name, o.cents, o.tag]))`));
    const igor = rows.find(r => r[0] === 'Igor'), igorSum = ev(`sum(personItems('pay', '2026-11').filter(o => o.it.person === 'Igor'))`);
    t.ok(igor && igor[1] === igorSum, `Igor numa linha só em novembro: ${JSON.stringify(igor)}`);
    t.ok(!ev(`payItems('2026-11').some(o => o.type === 'pay' && o.it.person === 'Igor')`), 'Sem linhas repetidas do Igor');
    const before = ev(`monthTotals('2026-11').toPay`);
    const rid = ev(`payItems('2026-11').find(o => o.type === 'ppl' && o.name === 'Igor').it.id`);
    t.ok(/~/.test(rid), 'A linha do Igor da viagem é separada do Igor do dia a dia: ' + rid);
    ev(`ui.view = '2026-11'; applyToggle('ppl', '${rid}')`);
    t.ok(ev(`monthTotals('2026-11').toPay`) === before - igorSum, 'Marcar a linha do Igor paga tudo dele no mês');
    t.ok(ev(`monthTotals('2026-11').out`) === ev(`sum(outItems('2026-11'))`), 'Total do mês igual com a linha agrupada');
    ev(`ui.tab = 'mes'; render()`); await H.wait(30);
    t.ok([...doc.querySelectorAll('#view .item[data-type="ppl"]')].length >= 1, 'Mês mostra a linha agrupada'); }
  t.end();
})();

/* 11. Na tela do cartão (fatura de novembro), o + sugere a data de hoje (antes sugeria 20/11) */
(async () => {
  const H2 = require('./harness'); const t2 = H2.suite('revisao-cartao-data');
  const { ev, doc } = H2.boot({ state: H2.estado() });
  const cid = ev(`S.cards.find(c => c.name === 'Meu Nubank').id`);
  ev(`ui.tab = 'cards'; ui.page = 'card:${cid}'; ui.view = '2026-11'; render(); fabAction()`); await H2.wait(20);
  [...doc.querySelectorAll('.addtile')].find(b => b.textContent.trim().toLowerCase() === 'compra').click(); await H2.wait(20);
  t2.ok(/compra no meu nubank/i.test(doc.querySelector('.sheet h2').textContent) && !doc.querySelector('#f-card'), 'No cartão: compra já vai para o Meu Nubank (sem escolher cartão)');
  t2.ok(doc.querySelector('#f-date').value === '2026-10-20', 'Data sugerida é hoje: ' + doc.querySelector('#f-date').value);
  t2.end();
})();
