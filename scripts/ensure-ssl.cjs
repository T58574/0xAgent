const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

function getAppDir() {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  return path.join(home, '.0xagent');
}

function getLocalLanIps() {
  const ips = ['127.0.0.1'];
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

async function ensureCertificates() {
  const certsDir = path.join(getAppDir(), 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  const certPath = path.join(certsDir, 'cert.pem');
  const keyPath = path.join(certsDir, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const c = fs.readFileSync(certPath, 'utf8');
      const k = fs.readFileSync(keyPath, 'utf8');
      if (c.trim().length > 0 && k.trim().length > 0) {
        return; // Certs already exist and are valid
      }
    } catch {}
  }

  const lanIps = getLocalLanIps();
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    { type: 7, ip: '::1' },
    ...lanIps.filter((ip) => ip !== '127.0.0.1').map((ip) => ({ type: 7, ip })),
  ];

  const attrs = [{ name: 'commonName', value: '0xAgent Local Development CA' }];
  const pems = await selfsigned.generate(attrs, {
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

  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, 'utf8');
}

ensureCertificates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[SSL PRE-BOOT ERROR]', err);
    process.exit(0); // non-fatal fallback
  });
