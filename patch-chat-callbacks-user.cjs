const fs = require('fs');
function fixUser(file) {
  let code = fs.readFileSync(file, 'utf8');

  code = code.replace(/setSelectedMsgForAction\(msg\);\s*\}, \[\]\);/g, 
  `setSelectedMsgForAction(msg);
  }, [user]);`);

  fs.writeFileSync(file, code);
}

fixUser('src/components/ChatWidget.tsx');
fixUser('src/pages/Chat.tsx');
