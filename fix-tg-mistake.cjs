const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The incorrect insertion in comments:
const incorrect = `      if (result && result.insertId) {
        insertId = result.insertId;
      }
      
      // Notify Telegram
      notifyTelegramNewAnime(insertId, qismlar_soni || null);`;
const correctForComments = `      if (result && result.insertId) {
        insertId = result.insertId;
      }`;
      
content = content.replace(incorrect, correctForComments);

fs.writeFileSync('server.ts', content);
