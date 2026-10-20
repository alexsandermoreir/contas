// Moedas: todas mantêm a escrita oficial, cotação com 4 algarismos, viagem e dívidas em outra moeda
const H = require('./harness');
const t = H.suite('moedas.test.js');
(async () => {
  const { ev, doc, errs } = H.boot({ state: H.estado() });
  /* 1. Símbolo de TODAS as moedas fica como é escrito, mesmo com o texto em minúsculas */
  const curs = JSON.parse(ev(`JSON.stringify(CURS.map(c => c[0]))`));
  for (const c of curs) {
    const orig = ev(`fmtCur(-123456, '${c}')`), low = ev(`lowerTxt('Total ' + fmtCur(-123456, '${c}') + ' em ${c}')`);
    t.ok(low.includes(orig), `${c}: "${orig}" continua igual (veio "${low}")`);
    t.ok(low.endsWith(` em ${c}`), `${c}: o código ${c} fica em maiúsculas`);
    t.ok(low.startsWith('total '), `${c}: o resto do texto fica minúsculo`);
  }
  t.ok(ev(`lowerTxt('Tente TRYHARD e Mars')`) === 'tente tryhard e mars', 'Palavras comuns não viram moeda');
  /* 2. Cotação com no máximo 4 algarismos, em qualquer moeda */
  [[0.032881234, '0,03288'], [5.43219, '5,432'], [0.0039123, '0,003912'], [6.1789, '6,179'], [0.17512, '0,1751']].forEach(([v, s]) => t.ok(ev(`rateTxt(${v})`) === s, `rateTxt(${v}) = ${s} (veio ${ev(`rateTxt(${v})`)})`));
  /* 3. Viagem ao Japão: o gasto já começa em iene depois do primeiro gasto em iene */
  ev(`S.projects[0].rates = { JPY: 0.03288 }`);
  t.ok(ev(`tripCur(S.projects[0])`) === 'JPY', 'Moeda principal da viagem: iene');
  /* 4. Alguém me deve em iene (dentro da viagem) */
  const pid = ev(`S.projects[0].id`);
  ev(`openPerson('recv', { projectId: '${pid}' })`); await H.wait(30);
  t.ok(doc.querySelector('#f-curr .chip.on') && doc.querySelector('#f-curr .chip.on').dataset.v === 'JPY', 'Me devem (viagem) já vem em iene');
  ev(`setC($('#f-amount'), 1350)`); const inp = doc.querySelector('#f-person'); inp.value = 'Igor'; inp.dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true }));
  doc.querySelector('#f-desc').value = 'Metade do Shibuya Sky'; await H.wait(30);
  doc.querySelector('[data-sheet="save"]').click();
  const r = JSON.parse(ev(`JSON.stringify(S.receivables.find(x => x.desc === 'Metade do Shibuya Sky'))`));
  t.ok(r && r.cur === 'JPY' && r.amt === 1350 && r.cents === 4439 && r.rate === 0.03288, 'Igor me deve ¥ 1.350 = R$ 44,39: ' + JSON.stringify(r));
  /* 5. Câmbio: cotação com 4 algarismos */
  await H.wait(400); ev(`openFx(S.projects[0])`); await H.wait(10);
  ev(`setC($('#f-brl'), 100000); setC($('#f-amt'), 30412)`); doc.querySelector('#f-amt').dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true })); await H.wait(10);
  t.ok(/= R\$ 0,03288$/.test(doc.querySelector('#f-hint').textContent), 'Câmbio mostra 1 iene = R$ 0,03288: ' + doc.querySelector('#f-hint').textContent);
  t.ok(!errs.length, 'Sem erros: ' + errs.join(';'));
  t.end();
})();
