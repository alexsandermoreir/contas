const H = require('./harness'); const boot = (_f, o) => H.boot(o);
const state = H.estado();
const F = '';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FALHOU:', m); } };
const tick = () => new Promise(r => setTimeout(r, 30));
const gone = () => new Promise(r => setTimeout(r, 600));
function app() { const a = boot(F, { state }); const errs = []; a.w.addEventListener('error', e => errs.push(e.message)); a.errs = errs; return a; }
const input = (doc, sel, v) => { const e = doc.querySelector(sel); e.value = v; e.dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true })); };
const money = (doc, ev, sel, c) => { ev(`setC($('${sel}'), ${c})`); doc.querySelector(sel).dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true })); };
const chip = (doc, box, v) => doc.querySelector(`#${box} .chip[data-v="${v}"]`).click();
const tile = (doc, label) => [...doc.querySelectorAll('.addtile')].find(b => b.textContent.trim().toLowerCase() === label).click();
(async () => {
/* 1. Shibuya Skytree, ¥ 2.700, o Igor pagou */
{ const { ev, doc, errs } = app();
  const pid = ev(`S.projects[0].id`);
  ev(`ui.tab='projects'; ui.page='proj:${pid}'; render()`);
  ev(`fabAction()`);
  ok(['já gastei', 'vou gastar', 'alguém pagou', 'câmbio'].every(l => [...doc.querySelectorAll('.addtile')].some(b => b.textContent.trim().toLowerCase() === l)), 'O + do projeto mostra já gastei, vou gastar, alguém pagou e câmbio');
  tile(doc, 'já gastei'); await tick();
  ok(/já gastei/i.test(doc.querySelector('.sheet h2').textContent), 'Abre "já gastei" da viagem');
  chip(doc, 'f-curr', 'JPY'); await tick();
  ok(doc.querySelector('#f-rate'), 'Iene pede a cotação');
  input(doc, '#f-rate', '0,037');
  money(doc, ev, '#f-amount', 2700);
  input(doc, '#f-name', 'Shibuya Skytree');
  chip(doc, 'f-who', 'Igor'); await tick();
  ok(doc.querySelector('#f-pix').value === '10394806670', 'PIX do Igor vem sozinho');
  ok(doc.querySelector('#f-payk .chip.on').dataset.v === '2026-11', 'Pagar ao Igor em novembro (padrão: mês que vem)');
  ok(/≈ R\$\s?99,90/.test(doc.querySelector('#f-hint').textContent), 'Mostra ≈ R$ 99,90: ' + doc.querySelector('#f-hint').textContent);
  doc.querySelector('[data-sheet="save"]').click();
  const r = JSON.parse(ev(`JSON.stringify(S.payables.find(x => x.desc === 'Shibuya Skytree'))`));
  ok(r && r.person === 'Igor' && r.cents === 9990 && r.start === '2026-11' && r.amt === 2700 && r.cur === 'JPY' && r.pix === '10394806670' && r.projectId === pid, 'Vira "pagar ao Igor" R$ 99,90 em novembro: ' + JSON.stringify(r));
  const nov = JSON.parse(ev(`JSON.stringify(outItems('2026-11').filter(o => o.type === 'pay' && o.it.desc === 'Shibuya Skytree').map(o => [o.cents, o.tag]))`));
  ok(nov.length === 1 && nov[0][0] === 9990, 'Aparece nas saídas de novembro: ' + JSON.stringify(nov));
  ok(!ev(`outItems('2026-10').some(o => o.it && o.it.desc === 'Shibuya Skytree')`), 'Não aparece em outubro');
  /* tela do projeto: grupo do Igor com o PIX, texto curto */
  ev(`render()`);
  const txt = doc.body.textContent.replace(/\s+/g, ' ');
  ok(/parc\. \d\/6/.test(txt) && !/de 6 parcelas/.test(txt), 'Textos curtos: "parc. 2/6"');
  ok(/¥\s?2\.700/.test(txt), 'Mostra ¥ 2.700 na lista');
  ok(doc.querySelectorAll('.grp .grp-n').length >= 3, 'Agrupado por pessoa');
  /* editar o gasto abre o mesmo formulário com os dados */
  const row = [...doc.querySelectorAll('.item[data-type="pay"]')].find(x => /shibuya/i.test(x.textContent));
  row.querySelector('.item-text').click();
  ok(doc.querySelector('#f-curr .chip.on').dataset.v === 'JPY' && doc.querySelector('#f-who .chip.on').dataset.v === 'Igor', 'Editar abre com iene e Igor');
  doc.querySelector('[data-sheet="close"]').click();
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 2. Gasto da viagem no meu cartão vai para a fatura, mesmo com o projeto fora do mês */
{ const { ev, doc, errs } = app();
  const pid = ev(`S.projects[0].id`), cid = ev(`S.cards.find(c => c.name === 'Nubank Bela').id`);
  ok(ev(`projById('${pid}').count`) === false, 'Projeto está com "somar no mês" desligado');
  ev(`ui.tab='projects'; ui.page='proj:${pid}'; render(); fabAction()`); tile(doc, 'já gastei'); await tick();
  chip(doc, 'f-curr', 'JPY'); await tick(); input(doc, '#f-rate', '0,037');
  money(doc, ev, '#f-amount', 10000); input(doc, '#f-name', 'Uniqlo');
  chip(doc, 'f-card', cid); await tick();
  ok(/fatura de novembro/.test(doc.querySelector('#f-fat').textContent), 'Avisa a fatura (novembro): ' + doc.querySelector('#f-fat').textContent);
  doc.querySelector('[data-sheet="save"]').click();
  const inFat = JSON.parse(ev(`JSON.stringify(cardItems('${cid}','2026-11').filter(o => o.name === 'Uniqlo').map(o => o.cents))`));
  ok(inFat.length === 1 && inFat[0] === 37000, 'Uniqlo ¥ 10.000 = R$ 370,00 na fatura de novembro do Nubank Bela: ' + JSON.stringify(inFat));
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 3. Formulário principal: data completa e "repete?" */
{ const { ev, doc, errs } = app();
  ev(`ui.tab='mes'; ui.view='2026-10'; render(); openItem({ mode: 'out' })`);
  ok(doc.querySelector('#f-date').value === '2026-10-20', 'Data vem com hoje');
  money(doc, ev, '#f-amount', 15000); input(doc, '#f-name', 'Academia');
  input(doc, '#f-date', '2026-11-10');
  chip(doc, 'f-freq', 'mes'); await tick();
  ok(/todo dia 10/i.test(doc.querySelector('#f-rep').textContent), 'Repete: "todo dia 10"');
  doc.querySelector('[data-sheet="save"]').click();
  ok(ev(`month('2026-11').bills.some(b => b.name === 'Academia' && b.day === 10 && b.recurring)`), 'Cai em novembro, dia 10, todo mês');
  ok(!ev(`month('2026-10').bills.some(b => b.name === 'Academia')`), 'Não cai em outubro');
  await gone(); ev(`ensureMonth('2026-12')`);
  ok(ev(`month('2026-12').bills.some(b => b.name === 'Academia' && b.day === 10)`), 'Dezembro já tem a Academia dia 10');
  /* parcelado com data */
  ev(`openItem({ mode: 'out' })`); money(doc, ev, '#f-amount', 20000); input(doc, '#f-name', 'Celular');
  input(doc, '#f-date', '2026-11-05'); chip(doc, 'f-freq', 'parc'); await tick();
  input(doc, '#f-tot', '10'); await tick();
  doc.querySelector('[data-sheet="save"]').click();
  await gone();
  ok(ev(`S.installments.some(i => i.name === 'Celular' && i.start === '2026-11' && i.total === 10 && i.day === 5)`), 'Parcelado começa em novembro');
  /* mudar a data de uma conta para outro mês move a conta */
  const id = ev(`month('2026-10').bills.find(b => b.name === 'OAB').id`);
  ev(`openItem({ item: findItem('bill','${id}'), itemType: 'bill' })`);
  ok(doc.querySelector('#f-date').value.startsWith('2026-10'), 'Conta de outubro abre com data de outubro');
  input(doc, '#f-date', '2026-11-03'); await tick(); doc.querySelector('[data-sheet="save"]').click();
  ok(!ev(`month('2026-10').bills.some(b => b.id === '${id}')`) && ev(`month('2026-11').bills.some(b => b.id === '${id}')`), 'Mudar a data leva a conta para novembro');
  ok(!errs.length, 'Sem erros: ' + errs.join(';'));
}
/* 4. Minúsculas com R$ maiúsculo */
{ const { ev, doc } = app(); ev(`ui.tab='home'; render()`); await tick();
  const t = doc.querySelector('.hero').textContent;
  ok(/R\$/.test(t) && !/r\$/.test(t) && t === t.replace(/[A-QS-Z]/g, ''), 'Texto minúsculo e R$ maiúsculo: ' + t.replace(/\s+/g, ' '));
  ok(doc.querySelector('.title').textContent === doc.querySelector('.title').textContent.toLowerCase(), 'Título em minúsculas');
}
console.log(`viagem-e-formulario.test.js: ${pass} passaram, ${fail} falharam`); if (fail) process.exitCode = 1;
})();

/* Cotação: no máximo 4 algarismos (1 iene = R$ 0,03288) */
(() => {
  const H2 = require('./harness'); const { ev, errs } = H2.boot({ state: H2.estado() }); const t = H2.suite('cotacao');
  t.ok(ev(`rateTxt(0.032881234)`) === '0,03288', 'Mostra 0,03288: ' + ev(`rateTxt(0.032881234)`));
  t.ok(ev(`rateTxt(5.43219)`) === '5,432', 'Dólar: 5,432');
  ev(`S.projects[0].rates = { JPY: 0.032881234 }; migrate();`);
  t.ok(ev(`S.projects[0].rates.JPY`) === 0.03288, 'Cotação guardada também fica com 4 algarismos');
  t.ok(!errs.length, 'Sem erros: ' + errs.join(';'));
  t.end();
})();
