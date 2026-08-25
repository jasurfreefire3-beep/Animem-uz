const fs = require('fs');

let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

loginContent = loginContent.replace(
  /import Turnstile from 'react-turnstile';/g,
  `import { Turnstile } from '@marsidev/react-turnstile';`
);

// Switch back to onSuccess and siteKey
loginContent = loginContent.replace(
  /onVerify=\{\(token\) => setTurnstileToken\(token\)\}/g,
  `onSuccess={(token) => setTurnstileToken(token)}`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);

let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

regContent = regContent.replace(
  /import Turnstile from 'react-turnstile';/g,
  `import { Turnstile } from '@marsidev/react-turnstile';`
);

regContent = regContent.replace(
  /onVerify=\{\(token\) => setTurnstileToken\(token\)\}/g,
  `onSuccess={(token) => setTurnstileToken(token)}`
);

fs.writeFileSync('./src/pages/Register.tsx', regContent);
