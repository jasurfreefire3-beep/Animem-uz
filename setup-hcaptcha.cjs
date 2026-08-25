const fs = require('fs');

const HCAPTCHA_SITEKEY = "94d25f7e-2150-4d7e-b706-999c84ee305e";

function replaceTurnstileWithHCaptcha(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace import
  content = content.replace(
    /import \{ Turnstile \} from '@marsidev\/react-turnstile';/g,
    `import HCaptcha from '@hcaptcha/react-hcaptcha';`
  );

  // Replace Component
  // We need to replace all `<Turnstile ... />` blocks.
  // Using a regex to match the entire block can be tricky due to newlines, so we replace parts.
  
  content = content.replace(/<Turnstile /g, '<HCaptcha ');
  content = content.replace(/siteKey="0x4AAAAAAAEWOjx-FejLjanh8"/g, `sitekey="${HCAPTCHA_SITEKEY}"`);
  
  // Replace event handlers
  content = content.replace(/onSuccess=\{\(token\) => setTurnstileToken\(token\)\}/g, `onVerify={(token) => setTurnstileToken(token)}`);
  
  // Remove Turnstile specific stuff we added
  content = content.replace(/onError=\{\(err\) => \{[\s\S]*?\}\}/g, `onError={(err) => setTurnstileError("Captcha error: " + err)}`);
  content = content.replace(/onExpire=\{\(\) => setTurnstileToken\(""\)\}/g, `onExpire={() => setTurnstileToken("")}`);
  // Remove theme="dark" since it's handled differently or can be kept
  content = content.replace(/theme="dark"/g, 'theme="dark"');

  // Update error message state texts just in case
  content = content.replace(/Turnstile xatosi/g, 'Captcha xatosi');

  fs.writeFileSync(filePath, content);
}

replaceTurnstileWithHCaptcha('./src/pages/Login.tsx');
replaceTurnstileWithHCaptcha('./src/pages/Register.tsx');

// Server
let serverContent = fs.readFileSync('./server.ts', 'utf8');

serverContent = serverContent.replace(
  /const TURNSTILE_SECRET = "0x4AAAAAAAEWOjz2Rdd8gOSjdUE7kLiJN8kg";/g,
  `const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || "YOUR_HCAPTCHA_SECRET_HERE";`
);
serverContent = serverContent.replace(/TURNSTILE_SECRET/g, 'HCAPTCHA_SECRET');

serverContent = serverContent.replace(
  /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/g,
  `https://hcaptcha.com/siteverify`
);

fs.writeFileSync('./server.ts', serverContent);

