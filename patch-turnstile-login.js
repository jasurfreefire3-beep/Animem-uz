const fs = require('fs');
let content = fs.readFileSync('./src/pages/Login.tsx', 'utf8');

// Add import
if (!content.includes('import { Turnstile } from \'@marsidev/react-turnstile\';')) {
  content = content.replace('import { motion } from \'motion/react\';', 'import { motion } from \'motion/react\';\nimport { Turnstile } from \'@marsidev/react-turnstile\';');
}

// Add state
if (!content.includes('const [turnstileToken, setTurnstileToken] = useState')) {
  content = content.replace('const [loading, setLoading] = useState(false);', 'const [loading, setLoading] = useState(false);\n  const [turnstileToken, setTurnstileToken] = useState<string>(\'\');');
}

// Add check to handleSubmit for standard login
content = content.replace(
  /const handleSubmit = async \(e: React.FormEvent\) => \{\n    e.preventDefault\(\);\n    setError\(''\);\n    setLoading\(true\);/g,
  `const handleSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setError('');\n    if (!turnstileToken) {\n      setError('Iltimos, siz robot emasligingizni tasdiqlang!');\n      return;\n    }\n    setLoading(true);`
);

// Add check for handleForgotSendEmailCode
content = content.replace(
  /const handleForgotSendEmailCode = async \(e: React.FormEvent\) => \{\n    e.preventDefault\(\);\n    setError\(''\);\n    setForgotLoading\(true\);/g,
  `const handleForgotSendEmailCode = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setError('');\n    if (!turnstileToken) {\n      setError('Iltimos, robot emasligingizni tasdiqlang!');\n      return;\n    }\n    setForgotLoading(true);`
);

// We should find where the submit button for normal login is and place the turnstile widget right above it
const loginBtnMatch = content.indexOf('<button\\n                    type="submit"\\n                    disabled={loading}');
if (content.includes('Tizimga kirish\\n                  </button>')) {
  content = content.replace(
    '<button\n                    type="submit"\n                    disabled={loading}',
    `<div className="flex justify-center mb-4">\n                    <Turnstile \n                      siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"\n                      onSuccess={(token) => setTurnstileToken(token)}\n                    />\n                  </div>\n                  <button\n                    type="submit"\n                    disabled={loading || !turnstileToken}`
  );
}

// Add turnstile to forgot password (email step)
const forgotBtnMatch = content.indexOf('<button\\n                  type="submit"\\n                  disabled={forgotLoading}');
if (content.includes('Kodni yuborish\\n                  </button>')) {
  content = content.replace(
    '<button\n                  type="submit"\n                  disabled={forgotLoading}',
    `<div className="flex justify-center mb-4">\n                    <Turnstile \n                      siteKey="0x4AAAAAAAC_bMoaIUWmn54Wj"\n                      onSuccess={(token) => setTurnstileToken(token)}\n                    />\n                  </div>\n                  <button\n                  type="submit"\n                  disabled={forgotLoading || !turnstileToken}`
  );
}

fs.writeFileSync('./src/pages/Login.tsx', content);
