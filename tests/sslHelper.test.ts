import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { getOrCreateSslCertificates, getLocalLanIps } from '../server/sslHelper';

describe('SSL & Local HTTPS Helper Subsystem', () => {
  it('should retrieve list of local IPv4 network interfaces', () => {
    const ips = getLocalLanIps();
    assert.ok(Array.isArray(ips));
    assert.ok(ips.includes('127.0.0.1'));
  });

  it('should generate or load valid X.509 SSL certificate and RSA key', () => {
    const ssl = getOrCreateSslCertificates();
    assert.ok(ssl.key);
    assert.ok(ssl.cert);
    assert.ok(ssl.cert.includes('BEGIN CERTIFICATE'));
    assert.ok(ssl.key.includes('BEGIN RSA PRIVATE KEY') || ssl.key.includes('BEGIN PRIVATE KEY'));
    assert.ok(fs.existsSync(ssl.certPath));
    assert.ok(fs.existsSync(ssl.keyPath));
  });
});
