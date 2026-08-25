const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Add state for turnstile error
  content = content.replace(
    /const \[turnstileToken, setTurnstileToken\] = useState<string>\(''\);/,
    `const [turnstileToken, setTurnstileToken] = useState<string>('');\n  const [turnstileError, setTurnstileError] = useState<string>('');`
  );

  fs.writeFileSync(filepath, content);
}

patchFile('./src/pages/Login.tsx');
patchFile('./src/pages/Register.tsx');
