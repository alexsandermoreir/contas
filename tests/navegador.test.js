// Teste num navegador de verdade (Chromium, tamanho do iPhone): toca e digita como uma pessoa
const H = require('./harness'); const path = require('path');
const t = H.suite('navegador.test.js');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-10-20T10:00:00-03:00') });
  const state = JSON.stringify(H.estado());
  await p.addInitScript(s => { if (!sessionStorage.getItem('s')) { localStorage.setItem('minhas-contas-v2', s); sessionStorage.setItem('s', '1'); } }, state);
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  const typeIn = async (sel, txt) => { await p.locator(sel).first().tap(); await p.keyboard.type(txt, { delay: 20 }); await p.waitForTimeout(80); };

  /* 1. + abre o gasto; digitar 1290 vira R$ 12,90; salvar aparece no mês */
  await p.locator('#fab').tap(); await p.waitForTimeout(300);
  await p.locator('.addtile', { hasText: /^\s*gasto\s*$/ }).tap(); await p.waitForTimeout(400);
  await typeIn('#f-amount', '1290'); await typeIn('#f-name', 'Padaria');
  t.ok((await p.inputValue('#f-amount')).replace(/\s/g, ' ') === 'R$ 12,90', 'Digitar 1290 mostra R$ 12,90');
  await p.locator('.sheet [data-sheet="save"]').first().tap(); await p.waitForTimeout(500);
  t.ok(await p.evaluate(() => month('2026-10').bills.some(b => b.name === 'Padaria' && b.cents === 1290 && b.day === 20)), 'Padaria salva em 20/10 com R$ 12,90');

  /* 2. Viagem: ¥ 1.450 digitado mostra ≈ R$ 47,68 */
  await p.evaluate(() => { S.projects[0].rates = { JPY: 0.03288 }; ui.tab = 'projects'; ui.page = 'proj:' + S.projects[0].id; render(); });
  await p.locator('#fab').tap(); await p.waitForTimeout(300);
  await p.locator('.addtile', { hasText: 'já gastei' }).tap(); await p.waitForTimeout(400);
  await p.locator('#f-curr .chip[data-v="JPY"]').tap(); await p.waitForTimeout(100);
  await typeIn('#f-amount', '1450');
  t.ok(/R\$\s?47,68/.test(await p.textContent('#f-hint')), 'Iene: ¥ 1.450 ≈ R$ 47,68 (veio "' + await p.textContent('#f-hint') + '")');
  await p.locator('.sheet [data-sheet="close"]').first().tap(); await p.waitForTimeout(400);

  /* 3. Tocar no nome de uma conta com PIX abre a conta (não copia o PIX) */
  await p.evaluate(() => { ui.tab = 'mes'; ui.page = null; ui.view = '2026-11'; render(); });
  await p.locator('#view .item', { hasText: 'aluguel' }).first().locator('.nm').tap(); await p.waitForTimeout(300);
  t.ok(await p.locator('.sheet #f-amount').count() === 1, 'Tocar em "aluguel" abre a conta');
  await p.locator('.sheet [data-sheet="close"]').first().tap(); await p.waitForTimeout(400);

  /* 4. Uma linha só para o Igor em novembro; marcar paga tudo dele */
  const igor = p.locator('#view .item[data-type="ppl"]', { hasText: 'igor' });
  t.ok(await igor.count() === 1, 'Igor aparece numa linha só');
  await igor.locator('button.tick').tap(); await p.waitForTimeout(600);
  t.ok(await p.evaluate(() => personItems('pay', '2026-11').filter(o => o.it.person === 'Igor').every(o => o.done)), 'Marcar a linha do Igor paga tudo dele');

  /* 5. Texto em minúsculas, moedas na escrita oficial */
  const hero = (await p.textContent('.trio')).replace(/\s+/g, ' ');
  t.ok(/R\$/.test(hero) && !/r\$/.test(hero), 'R$ em maiúsculo: ' + hero);
  t.ok(!errs.length, 'Sem erros no navegador: ' + errs.join(' | '));
  await b.close(); t.end();
})().catch(e => { console.log('  FALHOU [navegador.test.js]:', e.message.split('\n')[0]); process.exitCode = 1; });
