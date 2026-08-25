const fs = require('fs');

const RECAPTCHA_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"; // Google test site key

function replaceWithRecaptcha(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace imports
  content = content.replace(
    /import HCaptcha from '@hcaptcha\/react-hcaptcha';/g,
    `import ReCAPTCHA from 'react-google-recaptcha';`
  );

  // Replace Component block
  // This regex matches <HCaptcha ... /> across multiple lines
  content = content.replace(/<HCaptcha[\s\S]*?\/>/g,
    `<ReCAPTCHA\n  sitekey="${RECAPTCHA_SITE_KEY}"\n  onChange={(token) => setCaptchaToken(token || '')}\n  onExpired={() => setCaptchaToken('')}\n  onErrored={() => setCaptchaError('ReCAPTCHA xatosi')}\n  theme="dark"\n/>`
  );

  // Replace state variable names
  content = content.replace(/turnstileToken/g, 'captchaToken');
  content = content.replace(/setTurnstileToken/g, 'setCaptchaToken');
  content = content.replace(/turnstileError/g, 'captchaError');
  content = content.replace(/setTurnstileError/g, 'setCaptchaError');

  fs.writeFileSync(filePath, content);
}

replaceWithRecaptcha('./src/pages/Login.tsx');
replaceWithRecaptcha('./src/pages/Register.tsx');

// Handle server.ts
let serverContent = fs.readFileSync('./server.ts', 'utf8');

// Replace state variables & functions
serverContent = serverContent.replace(/turnstileToken/g, 'captchaToken');
serverContent = serverContent.replace(/verifyTurnstileToken/g, 'verifyCaptchaToken');
serverContent = serverContent.replace(/HCAPTCHA_SECRET/g, 'RECAPTCHA_SECRET');

// Replace the secret key with the test secret key from Google
serverContent = serverContent.replace(
  /const RECAPTCHA_SECRET = process\.env\.RECAPTCHA_SECRET \|\| ".*?";/g,
  `const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";`
);

// Replace verification endpoint
serverContent = serverContent.replace(
  /https:\/\/hcaptcha\.com\/siteverify/g,
  'https://www.google.com/recaptcha/api/siteverify'
);

fs.writeFileSync('./server.ts', serverContent);
