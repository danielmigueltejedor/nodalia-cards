import { spawn } from 'node:child_process';
const build = spawn('pnpm', ['run', 'build'], { stdio: 'inherit' });
build.on('exit', code => {
  if (code !== 0) { process.exitCode = code ?? 1; return; }
  console.log('Preview: http://127.0.0.1:4173/tests/fixtures/browser.html (rerun build after source changes)');
  const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: 'inherit' });
  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
  server.on('exit', code => { process.exitCode = code ?? 0; });
});
