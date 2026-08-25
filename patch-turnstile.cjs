const fs = require('fs');

// Patch Login.tsx
let loginContent = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

if (!loginContent.includes('import { Turnstile } from \'@marsidev/react-turnstile\';')) {
  loginContent = loginContent.replace('import { motion } from \'motion/react\';', 'import { motion } from \'motion/react\';\nimport { Turnstile } from \'@marsidev/react-turnstile\';');
}

if (!loginContent.includes('const [turnstileToken, setTurnstileToken] = useState')) {
  loginContent = loginContent.replace('const [loading, setLoading] = useState(false);', 'const [loading, setLoading] = useState(false);\n  const [turnstileToken, setTurnstileToken] = useState<string>(\'\');');
}

// Add turnstile check to normal login
const handleSubmitRe = /const handleSubmit = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n\s*setError\(''\);\n\s*setLoading\(true\);/;
if (loginContent.match(handleSubmitRe)) {
  loginContent = loginContent.replace(
    handleSubmitRe,
    `const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setError('');\n    if (!turnstileToken) {\n      setError('Iltimos, robot emasligingizni tasdiqlang!');\n      return;\n    }\n    setLoading(true);`
  );
}

// Add turnstile check to forgot password
const handleForgotRe = /const handleForgotSendEmailCode = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n\s*setError\(''\);\n\s*setForgotLoading\(true\);/;
if (loginContent.match(handleForgotRe)) {
  loginContent = loginContent.replace(
    handleForgotRe,
    `const handleForgotSendEmailCode = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setError('');\n    if (!turnstileToken) {\n      setError('Iltimos, robot emasligingizni tasdiqlang!');\n      return;\n    }\n    setForgotLoading(true);`
  );
}

// Add Turnstile widget to normal login form
// Find the submit button in viewMode === 'login'
loginContent = loginContent.replace(
  /<button\n\s*type="submit"\n\s*disabled=\{loading\}\n\s*className="w-full/g,
  `<div className="flex justify-center mb-4">\n                    <Turnstile \n                      siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"\n                      onSuccess={(token) => setTurnstileToken(token)}\n                    />\n                  </div>\n                  <button\n                    type="submit"\n                    disabled={loading || !turnstileToken}\n                    className="w-full`
);

// Add Turnstile widget to forgot password form
loginContent = loginContent.replace(
  /<button\n\s*type="submit"\n\s*disabled=\{forgotLoading\}\n\s*className="w-full/g,
  `<div className="flex justify-center mb-4">\n                    <Turnstile \n                      siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"\n                      onSuccess={(token) => setTurnstileToken(token)}\n                    />\n                  </div>\n                  <button\n                    type="submit"\n                    disabled={forgotLoading || !turnstileToken}\n                    className="w-full`
);

fs.writeFileSync('./src/pages/Login.tsx', loginContent);


// Patch Register.tsx
let registerContent = fs.readFileSync('./src/pages/Register.tsx', 'utf8');

if (!registerContent.includes('import { Turnstile } from \'@marsidev/react-turnstile\';')) {
  registerContent = registerContent.replace('import { motion } from \'motion/react\';', 'import { motion } from \'motion/react\';\nimport { Turnstile } from \'@marsidev/react-turnstile\';');
}

if (!registerContent.includes('const [turnstileToken, setTurnstileToken] = useState')) {
  registerContent = registerContent.replace('const [loading, setLoading] = useState(false);', 'const [loading, setLoading] = useState(false);\n  const [turnstileToken, setTurnstileToken] = useState<string>(\'\');');
}

const handleRegSubmitRe = /const handleSubmit = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n\s*setError\(''\);\n\s*setLoading\(true\);/;
if (registerContent.match(handleRegSubmitRe)) {
  registerContent = registerContent.replace(
    handleRegSubmitRe,
    `const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setError('');\n    if (!turnstileToken) {\n      setError('Iltimos, robot emasligingizni tasdiqlang!');\n      return;\n    }\n    setLoading(true);`
  );
}

registerContent = registerContent.replace(
  /<button\n\s*type="submit"\n\s*disabled=\{loading\}\n\s*className="w-full/g,
  `<div className="flex justify-center mb-4">\n                    <Turnstile \n                      siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"\n                      onSuccess={(token) => setTurnstileToken(token)}\n                    />\n                  </div>\n                  <button\n                    type="submit"\n                    disabled={loading || !turnstileToken}\n                    className="w-full`
);

fs.writeFileSync('./src/pages/Register.tsx', registerContent);
