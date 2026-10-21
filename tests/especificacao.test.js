// Especificação do Alexsander (gastos, pessoas, cartões, viagem, câmbio): um teste para cada regra
const H = require('./harness');
const t = H.suite('especificacao.test.js');
(async () => {
  const fresh = () => H.boot({ state: H.estado() });
  const Ev = d => d.defaultView.Event;
  const input = (doc, sel, v) => { const e = doc.querySelector(sel); e.value = v; e.dispatchEvent(new (Ev(doc))('input', { bubbles: true })); e.dispatchEvent(new (Ev(doc))('change', { bubbles: true })); };
  const chip = (doc, box, v) => doc.querySelector(`#${box} .chip[data-v="${v}"]`).click();
  const tile = (doc, label) => [...doc.querySelectorAll('.addtile')].find(b => b.textContent.trim().toLowerCase() === label).click();
  const save = async doc => { await H.wait(20); doc.querySelector('.sheet [data-sheet="save"]').click(); await H.wait(400); };
  const money = (doc, ev, c, sel = '#f-amount') => { ev(`setC($('${sel}'), ${c})`); doc.querySelector(sel).dispatchEvent(new (Ev(doc))('input', { bubbles: true })); };

  /* 1. Parcelado: digita o total e o app divide (R$ 500,00 em 5× = R$ 100,00 · parc. 1/5) */
  { const { ev, doc, errs } = fresh();
    ev(`ui.tab='mes'; ui.view='2026-10'; render(); openItem({ mode: 'out' })`); await H.wait(20);
    money(doc, ev, 50000); input(doc, '#f-name', 'Geladeira'); chip(doc, 'f-freq', 'parc'); await H.wait(20); input(doc, '#f-tot', '5'); await H.wait(20);
    t.ok(/5× R\$\s?100,00/.test(doc.querySelector('#f-hint').textContent), 'Mostra 5× R$ 100,00: ' + doc.querySelector('#f-hint').textContent);
    await save(doc);
    const i = JSON.parse(ev(`JSON.stringify(S.installments.find(x => x.name === 'Geladeira'))`));
    t.ok(i && i.cents === 10000 && i.total === 5 && i.totalCents === 50000, 'Guarda R$ 100,00 por parcela, 5 parcelas, total R$ 500,00');
    t.ok(ev(`outItems('2026-10').some(o => o.it.name === 'Geladeira' && o.tag === 'parc. 1/5' && o.cents === 10000)`), 'Outubro: R$ 100,00 · parc. 1/5');
    t.ok(ev(`outItems('2027-02').some(o => o.it.name === 'Geladeira' && o.tag === 'parc. 5/5')`) && !ev(`outItems('2027-03').some(o => o.it.name === 'Geladeira')`), 'Termina em fevereiro (5/5)');
    /* centavos que sobram ficam na 1ª parcela */
    ev(`openItem({ mode: 'out', freq: 'parc' })`); await H.wait(20); money(doc, ev, 10000); input(doc, '#f-name', 'Tênis'); input(doc, '#f-tot', '3'); await H.wait(20); await save(doc);
    t.ok(ev(`outItems('2026-10').find(o => o.it.name === 'Tênis').cents`) === 3334 && ev(`outItems('2026-11').find(o => o.it.name === 'Tênis').cents`) === 3333, 'R$ 100,00 em 3×: 33,34 + 33,33 + 33,33');
    t.ok(!errs.length, 'Sem erros: ' + errs.join(';')); }

  /* 2. Anual: repete todo ano no mesmo mês, até a data-limite */
  { const { ev, doc } = fresh();
    ev(`openItem({ mode: 'out', freq: 'ano' })`); await H.wait(20);
    money(doc, ev, 150000); input(doc, '#f-name', 'IPVA'); input(doc, '#f-date', '2027-03-15'); await H.wait(20);
    t.ok(/todo ano em 15\/mar/i.test(doc.querySelector('#f-rep').textContent), 'Mostra "todo ano em 15/mar"');
    input(doc, '#f-until', '2028-12'); await save(doc);
    t.ok(ev(`outItems('2027-03').some(o => o.type === 'yr' && o.name === 'IPVA' && o.cents === 150000)`), 'Março de 2027 tem o IPVA');
    t.ok(!ev(`outItems('2027-04').some(o => o.name === 'IPVA')`) && !ev(`outItems('2026-10').some(o => o.name === 'IPVA')`), 'Os outros meses não têm');
    t.ok(ev(`outItems('2028-03').some(o => o.name === 'IPVA')`) && !ev(`outItems('2029-03').some(o => o.name === 'IPVA')`), 'Repete em 2028 e para depois da data-limite');
    t.ok(ev(`itemCat(yrList()[0])`) === 'tributos', 'IPVA cai em tributos sozinho'); }

  /* 3. Mensal com data-limite */
  { const { ev, doc } = fresh();
    ev(`ui.view='2026-10'; openItem({ mode: 'out', freq: 'mes' })`); await H.wait(20);
    money(doc, ev, 9900); input(doc, '#f-name', 'Academia'); input(doc, '#f-date', '2026-10-25'); input(doc, '#f-until', '2026-12'); await save(doc);
    ev(`ensureMonth('2026-11'); ensureMonth('2026-12'); ensureMonth('2027-01'); ensureMonth('2027-02')`);
    const has = k => ev(`month('${k}').bills.some(b => b.name === 'Academia')`);
    t.ok(has('2026-11') && has('2026-12') && !has('2027-01') && !has('2027-02'), 'Academia vai até dezembro e para'); }

  /* 4. Alguém pagou por mim: vira "eu devo" para a pessoa, com o pix dela, nos dois lugares */
  { const { ev, doc } = fresh();
    ev(`ui.tab='home'; render(); fabAction()`); await H.wait(20); tile(doc, 'alguém pagou'); await H.wait(20);
    chip(doc, 'f-who', 'Igor'); await H.wait(20);
    t.ok(doc.querySelector('#f-ppix').value === '10394806670', 'Pix do Igor vem do cadastro');
    money(doc, ev, 30000); input(doc, '#f-name', 'Ingresso show'); chip(doc, 'f-freq', 'parc'); await H.wait(20); input(doc, '#f-tot', '3'); await H.wait(20);
    chip(doc, 'f-payk', '2026-11'); await save(doc);
    const r = JSON.parse(ev(`JSON.stringify(S.payables.find(x => x.desc === 'Ingresso show'))`));
    t.ok(r && r.person === 'Igor' && r.cents === 10000 && r.parcels === 3 && r.start === '2026-11', 'Eu devo ao Igor 3× R$ 100,00 a partir de novembro: ' + JSON.stringify(r));
    const pe = ev(`peopleReg().find(x => x.name === 'Igor').id`);
    ev(`ui.tab='people'; ui.page='person:${pe}'; render()`); await H.wait(20);
    t.ok(/ingresso show/.test(doc.querySelector('#view').textContent), 'Aparece na página do Igor');
    ev(`applyToggle('pay', '${r.id}', '2026-11')`);
    t.ok(ev(`personItems('pay','2026-11').find(o => o.it.desc === 'Ingresso show').done`), 'Marcar na pessoa marca no mês (é o mesmo registro)'); }

  /* 5. Gasto em outra moeda mostra quanto vale em reais */
  { const { ev, doc } = fresh();
    ev(`ui.view='2026-10'; openItem({ mode: 'out' })`); await H.wait(20);
    doc.querySelector('#f-curbtn').click(); await H.wait(10); chip(doc, 'f-curr', 'USD'); await H.wait(10);
    input(doc, '#f-rate', '5,00'); money(doc, ev, 1000); await H.wait(10);
    t.ok(/≈ R\$\s?50,00/.test(doc.querySelector('#f-hint').textContent), 'US$ 10,00 ≈ R$ 50,00: ' + doc.querySelector('#f-hint').textContent);
    input(doc, '#f-name', 'App store'); await save(doc);
    const b = JSON.parse(ev(`JSON.stringify(month('2026-10').bills.find(x => x.name === 'App store'))`));
    t.ok(b && b.cents === 5000 && b.cur === 'USD' && b.amt === 1000, 'Guarda R$ 50,00 e US$ 10,00');
    t.ok(ev(`outItems('2026-10').find(o => o.name === 'App store').tag`).includes('US$'), 'Na lista aparece o valor em dólar'); }

  /* 6. Assinatura sem cartão: sem caixinha, conta como paga quando passa o dia */
  { const { ev } = fresh();
    ev(`month('2026-10', true).bills.push({ id: 'sb1', name: 'Spotify', cents: 2190, day: 5, kind: 'fixa', recurring: true, cat: 'assinaturas' }, { id: 'sb2', name: 'Disney+', cents: 3390, day: 28, kind: 'fixa', recurring: true, cat: 'assinaturas' })`);
    const o1 = JSON.parse(ev(`JSON.stringify(outItems('2026-10').filter(o => o.it.id === 'sb1' || o.it.id === 'sb2').map(o => [o.it.id, o.fixed, o.done]))`));
    t.ok(o1.find(x => x[0] === 'sb1')[1] && o1.find(x => x[0] === 'sb1')[2], 'Dia 5 já passou: conta como paga, sem caixinha');
    t.ok(o1.find(x => x[0] === 'sb2')[1] && !o1.find(x => x[0] === 'sb2')[2], 'Dia 28 ainda não: falta pagar (mas sem caixinha)'); }

  /* 7. Variável: * e lembrete no dia escolhido; previsão em % do que entra */
  { const { ev, doc } = fresh();
    ev(`ui.view='2026-10'; openItem({ mode: 'out', freq: 'mes' })`); await H.wait(20);
    money(doc, ev, 8000); input(doc, '#f-name', 'Conta de gás'); input(doc, '#f-date', '2026-10-25'); chip(doc, 'f-nat', 'var'); await H.wait(20); input(doc, '#f-remind', '18'); await save(doc);
    const g = JSON.parse(ev(`JSON.stringify(month('2026-10').bills.find(x => x.name === 'Conta de gás'))`));
    t.ok(g.estimate && g.variable && g.remind === 18, 'Variável: estimado (*) com lembrete dia 18');
    ev(`ui.tab='home'; ui.page=null; render()`);
    t.ok([...doc.querySelectorAll('.remind')].some(x => /conta de gás/i.test(x.textContent)), 'Início lembra de colocar o valor da conta de gás');
    ev(`openItem({ mode: 'out', freq: 'mes', nat: 'var' })`); await H.wait(20);
    input(doc, '#f-name', 'Saúde'); const sw = doc.querySelector('#f-pcton'); sw.checked = true; sw.dispatchEvent(new (Ev(doc))('change', { bubbles: true })); await H.wait(10);
    input(doc, '#f-pct', '10'); await H.wait(10); await save(doc);
    const inc = ev(`sum(inItems('2026-10'))`), sv = ev(`outItems('2026-10').find(o => o.name === 'Saúde').cents`);
    t.ok(sv === Math.round(inc * 0.1), `Previsão de 10% do que entra: ${sv} de ${inc}`); }

  /* 8. + na fatura: tudo vai para aquele cartão */
  { const { ev, doc } = fresh(); const cid = ev(`S.cards.find(c => c.name === 'Nubank Bela').id`);
    ev(`ui.tab='cards'; ui.page='card:${cid}'; ui.view='2026-11'; render(); fabAction()`); await H.wait(20);
    tile(doc, 'compra'); await H.wait(20); money(doc, ev, 4500); input(doc, '#f-name', 'Uber'); await save(doc);
    t.ok(ev(`month('2026-10').bills.some(b => b.name === 'Uber' && b.cardId === '${cid}')`), 'Compra do + vai para o Nubank Bela');
    ev(`fabAction()`); await H.wait(20); tile(doc, 'assinatura'); await H.wait(20);
    t.ok(doc.querySelector('#f-freq') === null || doc.querySelector('#f-freq .chip.on').dataset.v === 'mes', 'Assinatura já vem mensal');
    ev(`closeSheet()`); await H.wait(350); ev(`fabAction()`); await H.wait(20); tile(doc, 'antecipar'); await H.wait(20);
    t.ok(doc.querySelector('#f-card .chip.on').dataset.v === '${cid}'.replace('${cid}', cid), 'Antecipar já vem no Nubank Bela');
    ev(`closeSheet()`); await H.wait(350); ev(`fabAction()`); await H.wait(20); tile(doc, 'estorno'); await H.wait(20);
    t.ok(doc.querySelector('#f-card .chip.on').dataset.v === cid, 'Estorno já vem no Nubank Bela'); }

  /* 9. Viagem: vou gastar → já gastei com a bolinha; tudo em reais */
  { const { ev, doc } = fresh(); const pid = ev(`S.projects[0].id`);
    ev(`ui.tab='projects'; ui.page='proj:${pid}'; render(); fabAction()`); await H.wait(20); tile(doc, 'vou gastar'); await H.wait(20);
    t.ok(!doc.querySelector('#f-tdone').checked, '"Vou gastar" começa como não pago');
    money(doc, ev, 30000); input(doc, '#f-name', 'Hotel em Osaka'); await save(doc);
    const x = JSON.parse(ev(`JSON.stringify(projById('${pid}').items.find(i => i.desc === 'Hotel em Osaka'))`));
    t.ok(x && x.done === false && x.kind === 'reserva', 'Fica em "vou gastar", tipo reserva');
    const st0 = JSON.parse(ev(`JSON.stringify(projStats(projById('${pid}')))`));
    t.ok(st0.planBRL === 30000, 'Vou gastar: R$ 300,00');
    ev(`render()`); await H.wait(20); const row = [...doc.querySelectorAll('.item[data-type="pitem"]')].find(r => /hotel em osaka/.test(r.textContent));
    row.querySelector('.tick').click(); await H.wait(500);
    t.ok(ev(`projById('${pid}').items.find(i => i.desc === 'Hotel em Osaka').done`) === true, 'Bolinha passa para "já gastei"');
    t.ok(ev(`outItems('2026-10').some(o => o.type === 'pitem' && o.name === 'Hotel em Osaka' && o.cat === 'proj:${pid}')`), 'No mês aparece na categoria da viagem');
    ev(`ui.tab='mes'; ui.view='2026-10'; ui.list='out'; render()`); await H.wait(20);
    t.ok([...doc.querySelectorAll('.grp-n')].some(e => /viagem ao japão/.test(e.textContent)), 'A categoria aparece com o nome do projeto'); }

  /* 10. Câmbio vai para a reserva internacional (Wise) e os gastos em espécie saem de lá */
  { const { ev, doc } = fresh(); const pid = ev(`S.projects[0].id`);
    ev(`openFx(projById('${pid}'))`); await H.wait(20);
    money(doc, ev, 100000, '#f-brl'); money(doc, ev, 30000, '#f-amt'); await save(doc);
    const w = JSON.parse(ev(`JSON.stringify(S.provisions.find(p => p.name === 'Wise'))`));
    t.ok(w && w.cur === 'JPY' && ev(`walletAmt(provById('${w.id}'))`) === 30000, 'Reserva Wise em iene com ¥ 30.000');
    t.ok(ev(`projById('${pid}').walletId`) === w.id, 'A viagem fica ligada à Wise');
    t.ok(ev(`outItems('2026-10').some(o => o.type === 'move' && o.cents === 100000 && /wise/i.test(o.name))`), 'R$ 1.000,00 saem da conta em outubro');
    ev(`projById('${pid}').items.push({ id: 'cash1', desc: 'Ramen', amt: 1500, cur: 'JPY', date: '2026-10-20', done: true })`);
    t.ok(ev(`walletAmt(provById('${w.id}'))`) === 28500, 'Gasto em espécie de ¥ 1.500 sai da Wise');
    t.ok(!ev(`outItems('2026-10').some(o => o.it && o.it.id === 'cash1')`), 'E não sai de novo da conta em reais');
    ev(`ui.tab='prov'; ui.page=null; render()`); await H.wait(20);
    t.ok(/wise/.test(doc.querySelector('#view').textContent) && /JP¥/.test(doc.querySelector('#view').textContent), 'Aba reservas mostra a Wise em JP¥'); }

  /* 11. Cartão de outra pessoa: pago a fatura por pix para ela */
  { const { ev, doc } = fresh();
    ev(`const pe = ensurePerson('Isabela', 'isa@pix.com'); S.cards.push({ id: 'cisa', name: 'Cartão da Isabela', color: '#C2185B', closeDay: 5, dueDay: 12, limit: 300000, ownerId: pe.id }); month('2026-10', true).bills.push({ id: 'bisa', name: 'Sapato', cents: 20000, day: 2, kind: 'compra', cardId: 'cisa' })`);
    const fr = JSON.parse(ev(`JSON.stringify(faturaRows('2026-10').find(x => x.it.id === 'cisa'))`));
    t.ok(fr && fr.pix === 'isa@pix.com' && /isabela/i.test(fr.tag), 'Fatura do cartão da Isabela: pagar Isabela por pix');
    ev(`ui.tab='people'; ui.page='person:' + peopleReg().find(x => x.name === 'Isabela').id; render()`); await H.wait(20);
    t.ok(/cartão da isabela/.test(doc.querySelector('#view').textContent), 'A Isabela mostra o cartão dela'); }

  /* 12. Categorias novas e abas */
  { const { ev, doc } = fresh();
    const ids = JSON.parse(ev(`JSON.stringify(catsOf('out').map(c => c.id))`));
    t.ok(['contas', 'tributos', 'financeiro', 'assinaturas', 'parceladas', 'outros'].every(i => ids.includes(i)), 'Tem tributos, contas da casa, cartões, assinaturas, parceladas e outros');
    t.ok(!ids.includes('mercado') && !ids.includes('moradia'), 'As antigas foram juntadas');
    t.ok(ev(`catById('financeiro').label`) === 'Cartões', '"Cartões e bancos" virou "Cartões"');
    t.ok(ev(`guess('Supermercado BH').cat`) === 'contas' && ev(`guess('Anuidade OAB').cat`) === 'tributos' && ev(`guess('IPTU 2027').cat`) === 'tributos', 'Supermercado → contas da casa; OAB e IPTU → tributos');
    t.ok(ev(`Object.values(S.months).flatMap(m => m.bills).every(b => !b.cat || !Object.keys(CAT_ALIAS).includes(b.cat) || catsOf('out').some(c => c.id === b.cat))`), 'Nenhum gasto ficou numa categoria que sumiu');
    ev(`ui.tab='home'; render()`);
    const tabs = [...doc.querySelectorAll('#tabbar .tab')].map(x => x.textContent.trim().toLowerCase());
    t.ok(['início', 'mês', 'pessoas', 'cartões', 'projetos', 'reservas'].every(x => tabs.includes(x)), 'Abas: ' + tabs.join(', '));
    t.ok(!!doc.querySelector('[data-act="more"]'), 'Início tem o menu ☰');
    ev(`ui.tab='more'; ui.page=null; render()`); await H.wait(20);
    t.ok(/dívidas/.test(doc.querySelector('#view').textContent), 'Dívidas ficam no menu');
    ev(`ui.tab='cards'; ui.cardSeg='parc'; ui.page=null; render()`); await H.wait(20);
    t.ok(/parc\. \d+\/\d+/.test(doc.querySelector('#view').textContent), 'Cartões > parcelas lista os parcelamentos'); }

  /* 13. Início: sobra com cor e os números do mês */
  { const { ev, doc } = fresh(); ev(`ui.tab='home'; ui.page=null; render()`); await H.wait(20);
    const tl = [...doc.querySelectorAll('.tile')].map(x => x.textContent.toLowerCase());
    t.ok(['falta receber', 'vai sobrar', 'contas da casa', 'devo a pessoas', 'assinaturas', 'parcelas'].every(l => tl.some(x => x.includes(l))), 'Início mostra os quadrados pedidos');
    const sob = [...doc.querySelectorAll('.tile')].find(x => /vai sobrar/.test(x.textContent.toLowerCase()));
    t.ok(/t-(good|warn|bad)/.test(sob.className), 'Vai sobrar tem cor: ' + sob.className); }

  /* 14. Extras da fatura: tocar abre direto para editar os extras */
  { const { ev, doc } = fresh(); const cid = ev(`S.cards.find(c => c.name === 'Meu Nubank').id`);
    ev(`ui.tab='cards'; ui.page='card:${cid}'; ui.view='2026-12'; render()`);
    const ex = doc.querySelector('[data-act="fechar"][data-ex="1"]'); t.ok(!!ex, 'Linha dos extras dá para tocar');
    ex.click(); await H.wait(20);
    t.ok(!!doc.querySelector('.sheet #f-extra'), 'Abre com o campo dos extras'); }
  t.end();
})();
