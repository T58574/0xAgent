import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import selfsigned from 'selfsigned';
import { getAppDir } from './config';

export interface SslCertificates {
  key: string;
  cert: string;
  certPath: string;
  keyPath: string;
  lanIps: string[];
}

export function getLocalLanIps(): string[] {
  const ips: string[] = ['127.0.0.1'];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return Array.from(new Set(ips));
}

export function getCertsDir(): string {
  const dir = path.join(getAppDir(), 'certs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getOrCreateSslCertificates(): SslCertificates {
  const certsDir = getCertsDir();
  const certPath = path.join(certsDir, 'cert.pem');
  const keyPath = path.join(certsDir, 'key.pem');
  const lanIps = getLocalLanIps();

  // If certificates already exist and are non-empty, load them
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const cert = fs.readFileSync(certPath, 'utf-8');
      const key = fs.readFileSync(keyPath, 'utf-8');
      if (cert.trim().length > 0 && key.trim().length > 0) {
        return { key, cert, certPath, keyPath, lanIps };
      }
    } catch {}
  }

  // Generate fresh Subject Alternative Names (SAN) for localhost + all local LAN IPs
  const altNames: any[] = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' },
    ...lanIps.filter((ip) => ip !== '127.0.0.1').map((ip) => ({ type: 7, ip })),
  ];

  const attrs: Array<{ name: string; value: string }> = [{ name: 'commonName', value: '0xAgent Local Development CA' }];
  const pems: any = (selfsigned as any).generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: 'subjectAltName',
        altNames,
      },
    ],
  });

  fs.writeFileSync(certPath, pems.cert, 'utf-8');
  fs.writeFileSync(keyPath, pems.private, 'utf-8');

  return {
    key: pems.private,
    cert: pems.cert,
    certPath,
    keyPath,
    lanIps,
  };
}
