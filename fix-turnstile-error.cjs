const fs = require('fs');

let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

// The error 400020 usually means invalid sitekey format or mismatch.
// I will ensure the sitekey string is totally clean and wrapped correctly without any hidden characters.
const cleanSiteKey = "0x4AAAAAAAEWOjx-FejLjanh8";

loginContent = loginContent.replace(
  /siteKey="0x4AAAAAAAEWOjx-FejLjanh8"/g,
  `siteKey="${cleanSiteKey}"`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);

let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

regContent = regContent.replace(
  /siteKey="0x4AAAAAAAEWOjx-FejLjanh8"/g,
  `siteKey="${cleanSiteKey}"`
);

fs.writeFileSync('./src/pages/Register.tsx', regContent);
