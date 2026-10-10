// The API address is public configuration, not a credential.
const fs = require('node:fs');
const path = require('node:path');

function apiOrigin(value = '') {
  value = value.trim();
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('MOON_CAMPUS_API_BASE must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

if (require.main === module) {
  const value = apiOrigin(process.env.MOON_CAMPUS_API_BASE);
  fs.writeFileSync(path.join(__dirname, 'config.js'), '// Public API origin. Server secrets must never be placed here.\nwindow.MOON_CAMPUS_API_BASE = ' + JSON.stringify(value) + ';\n');
  console.log(value ? 'Configured the public HTTPS API origin.' : 'No API origin configured; connected login remains disabled.');
}
module.exports = {apiOrigin};
