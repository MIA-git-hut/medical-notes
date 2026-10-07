import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const entry = path.join(root, 'api/index.ts')
const cache = path.join(root, 'node_modules/.cache')
fs.mkdirSync(cache, { recursive: true })
const output = fs.mkdtempSync(path.join(cache, 'api-smoke-'))
try {
  // Resolve the nearest config just as the Vercel Node builder does.
  const configPath = ts.findConfigFile(path.dirname(entry), ts.sys.fileExists, 'tsconfig.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  const options = { ...parsed.options, noEmit: false, rootDir: root, outDir: output, declaration: false }
  const program = ts.createProgram([entry], options)
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }))
  if (program.emit().emitSkipped) throw new Error('API emit skipped')
  const runner = path.join(output, 'smoke.cjs')
  fs.writeFileSync(runner, `
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const handler = require('./api/index.js').default;
const server = createServer(handler);
server.listen(0, '127.0.0.1', async () => {
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const route of ['/api/health', '/api?__route=health']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, configured: false });
    }
    const me = await fetch(base + '/api?__route=me');
    assert.equal(me.status, 200);
    assert.equal((await me.json()).configured, false);
    const study = await fetch(base + '/api?__route=study');
    assert.equal(study.status, 503);
    assert.ok((await study.json()).error);
    console.log('Compiled API smoke passed: cold start, rewrites, unconfigured response');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { server.close(); server.closeAllConnections(); }
});
`)
  const env = { ...process.env, APP_ORIGIN: 'https://yixuebiji.top', VERCEL: '1' }
  for (const key of ['DATABASE_URL', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'ADMIN_GITHUB_IDS']) delete env[key]
  const result = spawnSync(process.execPath, [runner], { cwd: root, env, encoding: 'utf8', timeout: 30000 })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) throw new Error('Compiled API failed to start')
} finally {
  if (path.dirname(output) !== cache) throw new Error('Unexpected smoke output directory')
  fs.rmSync(output, { recursive: true, force: true })
}
