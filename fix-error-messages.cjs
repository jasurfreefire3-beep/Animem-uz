const fs = require('fs');

let content = fs.readFileSync('./server.ts', 'utf8');

// Replace error messages
content = content.replace(/Turnstile tasdiqlanmadi/g, 'Captcha tasdiqlanmadi');

fs.writeFileSync('./server.ts', content);
