// Roda todos os testes, um de cada vez. Se algum falhar, o app NÃO é publicado.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let bad = 0;
for (const f of files) {
  try { process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, f)], { env: { ...process.env, TZ: 'America/Sao_Paulo' }, encoding: 'utf8' })); }
  catch (e) { bad++; process.stdout.write((e.stdout || '') + (e.stderr || '')); }
}
/* o JavaScript do app precisa estar sem erro de digitação */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
try { new Function(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'))); } catch (e) { bad++; console.log('ERRO no JavaScript do app:', e.message); }
console.log(bad ? `\n${bad} grupo(s) de testes falharam.` : '\nTodos os testes passaram.');
process.exit(bad ? 1 : 0);
