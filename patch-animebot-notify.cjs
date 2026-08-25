const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

const targetStr = `"INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)", [animeId, episodeNumber, telegram_url]
      );`;

const replacement = `"INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)", [animeId, episodeNumber, telegram_url]
      );
      
      // Notify Telegram channel
      notifyTelegramNewAnime(animeId, episodeNumber);`;

if(serverContent.includes(targetStr)) {
  serverContent = serverContent.replace(targetStr, replacement);
  fs.writeFileSync('server.ts', serverContent);
  console.log("Patched successfully!");
} else {
  console.log("Target string not found in animebot route");
}
