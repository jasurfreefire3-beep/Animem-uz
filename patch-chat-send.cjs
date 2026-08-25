const fs = require('fs');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');

  const oldSendLogic = /let sent = false;[\s\S]*?if \(!sent && socketRef\.current\) \{[\s\S]*?console\.error\("Socket send also failed:", socketErr\);\s*\}\s*\}/;

  const newSendLogic = `let sent = false;
    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.emit('sendMessage', payload);
        sent = true;
      } catch (socketErr) {
        console.error("Socket send failed:", socketErr);
      }
    }

    if (!sent) {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
        const authToken = token || localStorage.getItem('token') || '';
        const res = await fetch(\`\${API_BASE}/api/chat/messages\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': \`Bearer \${authToken}\` } : {})
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          sent = true;
        }
      } catch (err) {
        console.warn("REST API send fallback failed:", err);
      }
    }`;

  code = code.replace(oldSendLogic, newSendLogic);
  fs.writeFileSync(file, code);
}

patchFile('src/components/ChatWidget.tsx');
patchFile('src/pages/Chat.tsx');
