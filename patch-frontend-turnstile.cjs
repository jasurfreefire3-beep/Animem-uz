const fs = require('fs');

let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

// Patch email login fetch
loginContent = loginContent.replace(
  /body: JSON\.stringify\(\{ email, password \}\),/g,
  `body: JSON.stringify({ email, password, turnstileToken }),`
);

// Patch phone login fetch
loginContent = loginContent.replace(
  /body: JSON\.stringify\(\{ phone: formatted, password \}\),/g,
  `body: JSON.stringify({ phone: formatted, password, turnstileToken }),`
);

// Patch forgot password email send code
loginContent = loginContent.replace(
  /body: JSON\.stringify\(\{ email: resetEmail \}\),/g,
  `body: JSON.stringify({ email: resetEmail, turnstileToken }),`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);

let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

// Patch email register fetch
regContent = regContent.replace(
  /body: JSON\.stringify\(\{ email, password, name \}\),/g,
  `body: JSON.stringify({ email, password, name, turnstileToken }),`
);

// Patch phone send code register
regContent = regContent.replace(
  /body: JSON\.stringify\(\{ phone: formatted, type: 'register' \}\),/g,
  `body: JSON.stringify({ phone: formatted, type: 'register', turnstileToken }),`
);

fs.writeFileSync('./src/pages/Register.tsx', regContent);
