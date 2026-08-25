const fs = require('fs');

let serverContent = fs.readFileSync('./server.ts', 'utf8');

const TURNSTILE_SECRET = '0x4AAAAAAC_bMp56mgWP9ZSud3cuRHbq-Kw';

const verifyTurnstileFn = `
// --- TURNSTILE VERIFICATION ---
const TURNSTILE_SECRET = "${TURNSTILE_SECRET}";

async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', token);
    formData.append('remoteip', ip);
    
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });
    
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}
`;

// Insert the verification function after imports/constants
if (!serverContent.includes('verifyTurnstileToken')) {
  serverContent = serverContent.replace(
    'const JWT_SECRET = process.env.JWT_SECRET ||', 
    verifyTurnstileFn + '\nconst JWT_SECRET = process.env.JWT_SECRET ||'
  );
}

// 1. Patch /api/auth/register
const registerRouteRe = /(app\.post\("\/api\/auth\/register",\s*async\s*\(req,\s*res\)\s*=>\s*\{\s*try\s*\{\s*const\s*\{\s*email,\s*password,\s*name)(\s*\})/;
if (serverContent.match(registerRouteRe)) {
  serverContent = serverContent.replace(
    registerRouteRe,
    `$1, turnstileToken } = req.body;\n\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
} else {
  // If destructuring differently
  serverContent = serverContent.replace(
    /app\.post\("\/api\/auth\/register", async \(req, res\) => \{\n  try \{\n    const \{ email, password, name \} = req\.body;/,
    `app.post("/api/auth/register", async (req, res) => {\n  try {\n    const { email, password, name, turnstileToken } = req.body;\n\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
}

// 2. Patch /api/auth/login
const loginRouteRe = /app\.post\("\/api\/auth\/login", async \(req, res\) => \{\n\s*try \{\n\s*const \{ email, password \} = req\.body;/;
if (serverContent.match(loginRouteRe)) {
  serverContent = serverContent.replace(
    loginRouteRe,
    `app.post("/api/auth/login", async (req, res) => {\n  try {\n    const { email, password, turnstileToken } = req.body;\n\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
}

// 3. Patch /api/auth/phone-login
const phoneLoginRouteRe = /app\.post\("\/api\/auth\/phone-login", async \(req, res\) => \{\n\s*try \{\n\s*const \{ phone, password \} = req\.body;/;
if (serverContent.match(phoneLoginRouteRe)) {
  serverContent = serverContent.replace(
    phoneLoginRouteRe,
    `app.post("/api/auth/phone-login", async (req, res) => {\n  try {\n    const { phone, password, turnstileToken } = req.body;\n\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
}

// 4. Patch /api/auth/forgot-password-send-code
const forgotEmailRouteRe = /app\.post\("\/api\/auth\/forgot-password-send-code", async \(req, res\) => \{\n\s*try \{\n\s*const \{ email \} = req\.body;/;
if (serverContent.match(forgotEmailRouteRe)) {
  serverContent = serverContent.replace(
    forgotEmailRouteRe,
    `app.post("/api/auth/forgot-password-send-code", async (req, res) => {\n  try {\n    const { email, turnstileToken } = req.body;\n\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
}

// 5. Patch /api/auth/phone-send-code
const phoneSendCodeRouteRe = /app\.post\("\/api\/auth\/phone-send-code", async \(req, res\) => \{\n\s*try \{\n\s*const \{ phone, type \} = req\.body;/;
if (serverContent.match(phoneSendCodeRouteRe)) {
  serverContent = serverContent.replace(
    phoneSendCodeRouteRe,
    `app.post("/api/auth/phone-send-code", async (req, res) => {\n  try {\n    const { phone, type, turnstileToken } = req.body;\n\n    // Only require turnstile for register and forgot (since those are initial actions)\n    if (!turnstileToken) {\n      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });\n    }\n    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';\n    const isHuman = await verifyTurnstileToken(turnstileToken, ip as string);\n    if (!isHuman) {\n      return res.status(400).json({ error: "Turnstile tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });\n    }`
  );
}

fs.writeFileSync('./server.ts', serverContent);
