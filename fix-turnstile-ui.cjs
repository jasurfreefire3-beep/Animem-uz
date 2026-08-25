const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Add state for turnstile error if not exists
  if (!content.includes('turnstileError')) {
     content = content.replace(
       /const \[turnstileToken, setTurnstileToken\] = useState\(''\);/,
       `const [turnstileToken, setTurnstileToken] = useState('');\n  const [turnstileError, setTurnstileError] = useState('');`
     );
  }

  // Replace console.error with state update to stop auto-triggering the AI agent
  content = content.replace(
    /onError=\{\(err\) => console\.error\("Turnstile error:", err\)\}/g,
    `onError={(err) => {
        if (String(err) === '400020') {
           setTurnstileError("Turnstile xatosi (400020): Domen bloklandi. Dasturni AI Studio ichida ochganingiz uchun shunday bo'lmoqda. Iltimos, tepa o'ng burchakdagi 'Open in new tab ↗️' tugmasi orqali dasturni yangi oynada oching!");
        } else {
           setTurnstileError("Turnstile xatosi: " + err);
        }
     }}`
  );

  // Display the error above the Turnstile widget
  if (!content.includes('turnstileError &&')) {
     content = content.replace(
       /<Turnstile/g,
       `{turnstileError && (
          <div className="p-3 mb-4 text-sm text-red-900 bg-red-100 border border-red-300 rounded-lg">
            <b>{turnstileError}</b>
          </div>
        )}
        <Turnstile`
     );
  }

  fs.writeFileSync(filepath, content);
}

patchFile('./src/pages/Login.tsx');
patchFile('./src/pages/Register.tsx');
