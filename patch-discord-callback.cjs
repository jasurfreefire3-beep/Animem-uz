const fs = require('fs');
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

const oldCallback = /const sendCallback = \("DISCORD_AUTH_SUCCESS" \| "DISCORD_AUTH_ERROR", payload: Record<string, unknown>\) => \{[\s\S]*?res\.send\(`<!doctype html><html><body><script>\s*const message = \$\{JSON\.stringify\(\{ type, \.\.\.payload \}\)\};\s*if \(window\.opener\) \{\s*window\.opener\.postMessage\(message, window\.location\.origin\);\s*window\.close\(\);\s*\} else \{\s*window\.location\.replace\('\/login'\);\s*\}\s*<\/script><\/body><\/html>`\);\s*\};/;

code = code.replace(/const sendCallback = \(type: "DISCORD_AUTH_SUCCESS" \| "DISCORD_AUTH_ERROR", payload: Record<string, unknown>\) => \{[\s\S]*?res\.send\([\s\S]*?<\/html>\`\);\s*\};/, 
`const sendCallback = (type: "DISCORD_AUTH_SUCCESS" | "DISCORD_AUTH_ERROR", payload: Record<string, unknown>) => {
    res.send(\`<!doctype html><html><body><script>
      const message = \${JSON.stringify({ type, ...payload })};
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
        window.close();
      } else {
        if (type === "DISCORD_AUTH_SUCCESS") {
          window.location.href = '/?token=' + encodeURIComponent(message.token || '') + '&user=' + encodeURIComponent(JSON.stringify(message.user || {}));
        } else {
          window.location.href = '/login?error=' + encodeURIComponent(message.error || 'auth_failed');
        }
      }
    </script></body></html>\`);
  };`);

fs.writeFileSync(file, code);
