// Digitar valores tecla por tecla (como no iPhone): as contas na tela usam o número completo
const H = require('./harness');
const t = H.suite('digitar.test.js');
(async () => {
  const { ev, doc, errs } = H.boot({ state: H.estado() });
  const Ev = doc.defaultView.Event;
  /* digita como no teclado: cada tecla acrescenta um caractere e dispara "input" */
  const typeKeys = (sel, keys) => { const el = doc.querySelector(sel); for (const k of keys) { el.value = el.value + k; el.dispatchEvent(new Ev('input', { bubbles: true })); } };
  const hint = () => doc.querySelector('#f-hint').textContent;
  const closeAll = async () => { ev('closeSheet()'); await H.wait(400); };
  ev(`S.projects[0].rates = { JPY: 0.03288 }`);
  const pid = ev(`S.projects[0].id`);
  /* 1. Viagem: 1.450 ienes = R$ 47,68 (antes mostrava R$ 4,77) */
  ev(`openTripItem(projById('${pid}'), { who: 'Igor' })`); await H.wait(20);
  typeKeys('#f-amount', '1450');
  t.ok(/R\$\s?47,68/.test(hint()), 'Viagem: ¥ 1.450 ≈ R$ 47,68 (veio "' + hint() + '")');
  doc.querySelector('#f-name').value = 'Teste digitado'; await H.wait(20); doc.querySelector('[data-sheet="save"]').click();
  t.ok(ev(`S.payables.find(x => x.desc === 'Teste digitado').cents`) === 4768, 'Salva R$ 47,68 para pagar ao Igor');
  await H.wait(400);
  /* 2. Me devem na viagem */
  ev(`openPerson('recv', { projectId: '${pid}' })`); await H.wait(20);
  typeKeys('#f-amount', '1450');
  t.ok(/R\$\s?47,68/.test(hint()), 'Me devem: ¥ 1.450 ≈ R$ 47,68 (veio "' + hint() + '")');
  await closeAll();
  /* 3. Viagem parcelado: 6× */
  ev(`openTripItem(projById('${pid}'), { who: 'Igor' })`); await H.wait(20);
  typeKeys('#f-amount', '30000');
  const sw = doc.querySelector('#f-parc'); sw.checked = true; sw.dispatchEvent(new Ev('change', { bubbles: true })); await H.wait(10);
  typeKeys('#f-tot', '6');
  t.ok(/6× R\$\s?164,40/.test(hint()), 'Parcelado: ¥ 30.000 em 6× R$ 164,40 (veio "' + hint() + '")');
  await closeAll();
  /* 4. Câmbio: R$ 1.000 por ¥ 30.412 → 0,03288 */
  ev(`openFx(projById('${pid}'))`); await H.wait(20);
  typeKeys('#f-brl', '100000'); typeKeys('#f-amt', '30412');
  t.ok(/0,03288$/.test(hint()), 'Câmbio: cotação 0,03288 (veio "' + hint() + '")');
  await closeAll();
  /* 5. Valor final da fatura: extras somam certo enquanto digita */
  ev(`openFaturaValue(S.cards.find(c => c.name === 'Itaúcard').id, '2026-10')`); await H.wait(20);
  const a = doc.querySelector('#f-amount'); a.value = ''; a.dispatchEvent(new Ev('input', { bubbles: true }));
  typeKeys('#f-amount', '200000'); await H.wait(10);
  t.ok(/1\.677,00/.test(doc.querySelector('#f-ex').textContent), 'Fatura de R$ 2.000,00: extras R$ 1.677,00 (veio "' + doc.querySelector('#f-ex').textContent + '")');
  await closeAll();
  /* 6. Gasto parcelado no formulário principal: o botão salvar libera com o último dígito */
  ev(`openItem({ mode: 'out' })`); await H.wait(20);
  typeKeys('#f-amount', '5'); await H.wait(10);
  t.ok(!doc.querySelector('[data-sheet="save"]').disabled, 'Salvar libera ao digitar o primeiro número');
  t.ok(doc.querySelector('#f-amount').value.replace(/\s/g, ' ') === 'R$ 0,05', 'Campo mostra R$ 0,05 (veio "' + doc.querySelector('#f-amount').value + '")');
  await closeAll();
  t.ok(!errs.length, 'Sem erros: ' + errs.join(';'));
  t.end();
})();
