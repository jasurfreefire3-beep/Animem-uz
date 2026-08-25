const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const target = `    store.animes.unshift(newObj);
    saveLocalStore(store);

    res.status(201).json({ id: insertId });`;

const replacement = `    store.animes.unshift(newObj);
    saveLocalStore(store);

    // Notify Telegram
    notifyTelegramNewAnime(insertId, qismlar_soni ? Number(qismlar_soni) : null);

    res.status(201).json({ id: insertId });`;

if(content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('server.ts', content);
  console.log("Patched correctly!");
} else {
  console.log("Target not found!");
}
