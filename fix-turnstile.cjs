const fs = require('fs');

let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

// Some Turnstile wrappers need explicit resetting or specific theme options to work smoothly in React
loginContent = loginContent.replace(
  /<Turnstile \n                      siteKey="0x4AAAAAAAEWOjx-FejLjanh8"\n                      onSuccess=\{\(token\) => setTurnstileToken\(token\)\}\n                    \/>/g,
  `<Turnstile 
                      siteKey="0x4AAAAAAAEWOjx-FejLjanh8"
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={(err) => console.error("Turnstile error:", err)}
                      onExpire={() => setTurnstileToken("")}
                      theme="dark"
                    />`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);

let regContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

regContent = regContent.replace(
  /<Turnstile \n                      siteKey="0x4AAAAAAAEWOjx-FejLjanh8"\n                      onSuccess=\{\(token\) => setTurnstileToken\(token\)\}\n                    \/>/g,
  `<Turnstile 
                      siteKey="0x4AAAAAAAEWOjx-FejLjanh8"
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={(err) => console.error("Turnstile error:", err)}
                      onExpire={() => setTurnstileToken("")}
                      theme="dark"
                    />`
);

fs.writeFileSync('./src/pages/Register.tsx', regContent);
