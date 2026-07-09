/**
 * Loads Apple's root CA certificates for offline StoreKit 2 JWS verification.
 * Drop Apple's root .cer files into server/iap-verify/certs/ (see README) — this
 * reads every .cer/.pem/.der in that folder as a Buffer.
 */
const fs = require('fs');
const path = require('path');

let cached = null;

function loadAppleRootCerts() {
  if (cached) return cached;
  const dir = path.join(__dirname, '..', 'certs');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(cer|pem|der|crt)$/i.test(f));
  } catch {
    throw new Error(
      'Apple root certs missing. Download Apple root CAs into server/iap-verify/certs/ (see README).',
    );
  }
  if (files.length === 0) {
    throw new Error('No Apple root certs found in server/iap-verify/certs/.');
  }
  cached = files.map((f) => fs.readFileSync(path.join(dir, f)));
  return cached;
}

module.exports = { loadAppleRootCerts };
