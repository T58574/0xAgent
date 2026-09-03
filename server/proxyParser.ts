import net from 'node:net';
import { ProxyProtocol, ProxyAuth } from '../src/types';

export interface ParsedProxyString {
  host: string;
  port: number;
  protocol?: ProxyProtocol;
  auth?: ProxyAuth;
  expires_at?: number | null;
  tag?: string;
}

/**
 * 1. Parse proxy strings in formats:
 *    - ip:port
 *    - ip:port:user:pass
 *    - user:pass@ip:port
 *    - http://user:pass@ip:port
 *    - socks5://ip:port:user:pass
 *    - ip:port:user:pass:expires_timestamp
 */
export function parseProxyLine(raw: string): ParsedProxyString | null {
  if (!raw) return null;
  let line = raw.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

  let protocol: ProxyProtocol | undefined = undefined;
  let expires_at: number | null = null;
  let tag: string | undefined = undefined;

  // Check URL scheme prefix
  const protoMatch = line.match(/^(https?|socks5|socks4):\/\//i);
  if (protoMatch) {
    const protoStr = protoMatch[1].toLowerCase();
    protocol = protoStr === 'https' ? 'https' : protoStr.startsWith('socks') ? 'socks5' : 'http';
    line = line.substring(protoMatch[0].length);
  }

  // Check trailing tags or expiration in brackets e.g. [tag] or {exp:123}
  const tagMatch = line.match(/\[(.*?)\]/);
  if (tagMatch) {
    tag = tagMatch[1].trim();
    line = line.replace(/\[(.*?)\]/, '').trim();
  }

  // Format 1: user:pass@host:port
  if (line.includes('@')) {
    const [authPart, hostPortPart] = line.split('@');
    const authParts = authPart.split(':');
    const hostPortParts = hostPortPart.split(':');
    const host = hostPortParts[0]?.trim();
    const port = parseInt(hostPortParts[1]?.trim() || '', 10);

    if (!host || isNaN(port) || port <= 0 || port > 65535) {
      return null;
    }

    const auth: ProxyAuth = {
      username: decodeURIComponent(authParts[0] || ''),
      password: decodeURIComponent(authParts.slice(1).join(':') || ''),
    };

    if (hostPortParts.length > 2) {
      const expVal = parseInt(hostPortParts[2], 10);
      if (!isNaN(expVal) && expVal > 0) {
        expires_at = expVal < 10000000000 ? expVal * 1000 : expVal;
      }
    }

    return { host, port, protocol, auth, expires_at, tag };
  }

  // Format 2: Colon delimited parts: host:port[:user:pass[:expires]]
  const parts = line.split(':').map((p) => p.trim());
  if (parts.length < 2) return null;

  const host = parts[0];
  const port = parseInt(parts[1], 10);

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    return null;
  }

  let auth: ProxyAuth | undefined = undefined;
  if (parts.length >= 4) {
    auth = {
      username: parts[2],
      password: parts[3],
    };
    if (parts.length >= 5) {
      const expVal = parseInt(parts[4], 10);
      if (!isNaN(expVal) && expVal > 0) {
        expires_at = expVal < 10000000000 ? expVal * 1000 : expVal;
      }
    }
  } else if (parts.length === 3) {
    // Check if 3rd part is expiration timestamp or auth
    const expVal = parseInt(parts[2], 10);
    if (!isNaN(expVal) && expVal > 1500000000) {
      expires_at = expVal < 10000000000 ? expVal * 1000 : expVal;
    }
  }

  return { host, port, protocol, auth, expires_at, tag };
}

/**
 * 2. Probe protocol on host:port by testing SOCKS5 handshake vs HTTP CONNECT / HTTP GET
 */
export async function detectProtocol(
  host: string,
  port: number,
  auth?: ProxyAuth | null,
  timeoutMs = 4000
): Promise<{ protocol: ProxyProtocol; latencyMs: number } | null> {
  // Test SOCKS5 first
  const socks5Res = await testSocks5Handshake(host, port, auth, timeoutMs);
  if (socks5Res.success) {
    return { protocol: 'socks5', latencyMs: socks5Res.latencyMs };
  }

  // Test HTTP/HTTPS Proxy
  const httpRes = await testHttpProxy(host, port, auth, timeoutMs);
  if (httpRes.success) {
    return { protocol: httpRes.isHttps ? 'https' : 'http', latencyMs: httpRes.latencyMs };
  }

  return null;
}

/**
 * Perform a lightweight native SOCKS5 handshake (RFC 1928)
 */
export function testSocks5Handshake(
  host: string,
  port: number,
  auth?: ProxyAuth | null,
  timeoutMs = 3500
): Promise<{ success: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    const finish = (success: boolean) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ success, latencyMs: Date.now() - start });
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));

    socket.connect(port, host, () => {
      // SOCKS5 greeting: VER=5, NMETHODS=1 (or 2 if auth), METHODS=[0x00, 0x02]
      if (auth?.username && auth?.password) {
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));
      } else {
        socket.write(Buffer.from([0x05, 0x01, 0x00]));
      }
    });

    socket.on('data', (data) => {
      // SOCKS5 response: VER=5, METHOD chosen
      if (data.length >= 2 && data[0] === 0x05) {
        const method = data[1];
        if (method === 0x00) {
          // No authentication required
          finish(true);
        } else if (method === 0x02 && auth?.username && auth?.password) {
          // Username/Password authentication subnegotiation (RFC 1929)
          const uBytes = Buffer.from(auth.username, 'utf-8');
          const pBytes = Buffer.from(auth.password, 'utf-8');
          const authBuf = Buffer.concat([
            Buffer.from([0x01, uBytes.length]),
            uBytes,
            Buffer.from([pBytes.length]),
            pBytes,
          ]);
          socket.write(authBuf);
        } else if (method === 0xff) {
          // No acceptable methods
          finish(false);
        } else {
          finish(false);
        }
      } else if (data.length >= 2 && data[0] === 0x01 && data[1] === 0x00) {
        // RFC 1929 auth success (status = 0x00)
        finish(true);
      } else {
        finish(false);
      }
    });
  });
}

/**
 * Test HTTP / HTTPS forward proxy via HTTP CONNECT or HTTP HEAD
 */
export function testHttpProxy(
  host: string,
  port: number,
  auth?: ProxyAuth | null,
  timeoutMs = 3500
): Promise<{ success: boolean; isHttps: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    const finish = (success: boolean, isHttps = false) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({ success, isHttps, latencyMs: Date.now() - start });
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));

    socket.connect(port, host, () => {
      let authHeader = '';
      if (auth?.username && auth?.password) {
        const creds = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        authHeader = `Proxy-Authorization: Basic ${creds}\r\n`;
      }

      // Send standard HTTP CONNECT to test SSL tunneling capability
      const req = `CONNECT 1.1.1.1:443 HTTP/1.1\r\nHost: 1.1.1.1:443\r\n${authHeader}User-Agent: 0xAgent-ProxyCheck/1.0\r\n\r\n`;
      socket.write(req);
    });

    socket.on('data', (data) => {
      const resp = data.toString('utf-8');
      if (resp.startsWith('HTTP/1.0 200') || resp.startsWith('HTTP/1.1 200')) {
        finish(true, true);
      } else if (resp.includes('407 Proxy Authentication Required')) {
        // Server responded as proxy, but auth failed or required
        finish(true, false);
      } else if (resp.startsWith('HTTP/1.1') || resp.startsWith('HTTP/1.0')) {
        // Responded as HTTP proxy
        finish(true, false);
      } else {
        finish(false);
      }
    });
  });
}
