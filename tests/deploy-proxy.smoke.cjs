// Requires Docker and a locally built production image (PROXY_TEST_IMAGE).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const image = process.env.PROXY_TEST_IMAGE || 'thaikana-sales-frontend:test';
const nonce = `thaikana-proxy-${Date.now()}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), nonce));
const containers = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  docker('network', 'create', nonce);
  try {
    for (const color of ['blue', 'green']) {
      fs.writeFileSync(path.join(dir, `${color}.conf`), `server { listen 8080; client_max_body_size 21m; location / { default_type application/json; add_header Set-Cookie "probe=ok; Secure; HttpOnly"; return 200 '{"server":"${color}","uri":"$request_uri","method":"$request_method","auth":"$http_authorization","proto":"$http_x_forwarded_proto"}'; } }`);
    }
    const start = color => {
      const name = `${nonce}-${color}`;
      docker('run', '-d', '--name', name, '--network', nonce, '--network-alias', 'thaikana-api', '-v', `${path.join(dir, `${color}.conf`)}:/etc/nginx/conf.d/default.conf:ro`, '--entrypoint', 'nginx', image, '-g', 'daemon off;');
      containers.push(name);
      return name;
    };
    const blue = start('blue');
    const proxy = `${nonce}-web`;
    docker('run', '-d', '--name', proxy, '--network', nonce, '-p', '127.0.0.1::8080', '-e', 'PORT=8080', '-e', 'NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1', '-e', 'API_UPSTREAM=http://thaikana-api:8080', '-v', `${path.resolve(__dirname, '../deploy/default.conf.template')}:/etc/nginx/templates/default.conf.template:ro`, image);
    containers.push(proxy);
    const port = docker('port', proxy, '8080/tcp').split(':').pop();
    const probe = async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/probe?station=laser`, { method: 'POST', headers: { Authorization: 'Bearer smoke', 'X-Forwarded-Proto': 'https' }, body: '{"quantity":2}', signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('set-cookie'), /Secure; HttpOnly/);
      const body = await response.json();
      assert.equal(body.uri, '/api/v1/probe?station=laser');
      assert.equal(body.method, 'POST');
      assert.equal(body.auth, 'Bearer smoke');
      assert.equal(body.proto, 'https');
      return body.server;
    };
    await sleep(1500);
    assert.equal(await probe(), 'blue');
    const upload = await fetch(`http://127.0.0.1:${port}/api/v1/probe`, { method: 'POST', body: Buffer.alloc(13 * 1024 * 1024), signal: AbortSignal.timeout(15000) });
    assert.equal(upload.status, 200, 'Proxy must not reject API-supported uploads above the old 12 MiB proxy limit');
    start('green');
    docker('network', 'disconnect', nonce, blue);
    let changed = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      try { if (await probe() === 'green') { changed = true; break; } } catch {}
    }
    assert.ok(changed, 'Proxy must resolve the replacement API without restarting');
    console.log('PASS: method, URI/query, auth, forwarded protocol, cookie and DNS replacement');
  } finally {
    for (const name of containers.reverse()) docker('rm', '-f', name);
    docker('network', 'rm', nonce);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
