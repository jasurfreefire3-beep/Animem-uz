const fs = require('fs');

let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

loginContent = loginContent.replace(
  /import \{ Turnstile \} from '@marsidev\/react-turnstile';/g,
  `import Turnstile from 'react-turnstile';`
);

// react-turnstile uses onVerify instead of onSuccess
loginContent = loginContent.replace(
  /onSuccess=\{\(token\) => setTurnstileToken\(token\)\}/g,
  `onVerify={(token) => setTurnstileToken(token)}`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);

let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

regContent = regContent.replace(
  /import \{ Turnstile \} from '@marsidev\/react-turnstile';/g,
  `import Turnstile from 'react-turnstile';`
);

regContent = regContent.replace(
  /onSuccess=\{\(token\) => setTurnstileToken\(token\)\}/g,
  `onVerify={(token) => setTurnstileToken(token)}`
);

fs.writeFileSync('./src/pages/Register.tsx', regContent);
