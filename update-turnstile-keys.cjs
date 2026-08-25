const fs = require('fs');

// 1. Update Server (Secret Key)
let serverContent = fs.readFileSync('./server.ts', 'utf8');
serverContent = serverContent.replace(
  /const TURNSTILE_SECRET = "0x4AAAAAAC_bMp56mgWP9ZSud3cuRHbq-Kw";/g,
  'const TURNSTILE_SECRET = "0x4AAAAAAAEWOjz2Rdd8gOSjdUE7kLiJN8kg";'
);
fs.writeFileSync('./server.ts', serverContent);

// 2. Update Login (Site Key)
let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');
loginContent = loginContent.replace(
  /siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"/g,
  'siteKey="0x4AAAAAAAEWOjx-FejLjanh8"'
);
fs.writeFileSync('./src/pages/Login.tsx', loginContent);

// 3. Update Register (Site Key)
let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');
regContent = regContent.replace(
  /siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"/g,
  'siteKey="0x4AAAAAAAEWOjx-FejLjanh8"'
);
fs.writeFileSync('./src/pages/Register.tsx', regContent);
