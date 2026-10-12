#!/usr/bin/env node
// Fails when production dependencies have high or critical advisories that
// are not listed in audit-allowlist.json (or whose allowlist entry expired).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const allowlist = existsSync('audit-allowlist.json')
  ? JSON.parse(readFileSync('audit-allowlist.json', 'utf8'))
  : [];
const today = new Date().toISOString().slice(0, 10);
const allowed = new Map(
  allowlist.filter((a) => !a.expires || a.expires >= today).map((a) => [a.id, a]),
);

let raw;
try {
  raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (err) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  raw = err.stdout;
}
const report = JSON.parse(raw);
if (report.error) {
  console.error('npm audit failed:', report.error.summary ?? report.error);
  process.exit(2);
}

const findings = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url).split('/').pop();
    findings.set(id, { id, severity: via.severity, pkg: via.name, title: via.title });
  }
}

const blocking = [...findings.values()].filter((f) => !allowed.has(f.id));
for (const f of findings.values()) {
  const tag = allowed.has(f.id) ? 'ALLOWED' : 'BLOCKING';
  console.log(`${tag} ${f.severity} ${f.pkg} ${f.id} ${f.title}`);
}
for (const a of allowlist) {
  if (a.expires && a.expires < today) console.log(`EXPIRED allowlist entry ${a.id} (${a.expires})`);
}
console.log(`${findings.size} high/critical advisories, ${blocking.length} blocking.`);
process.exit(blocking.length ? 1 : 0);
