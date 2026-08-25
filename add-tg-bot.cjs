const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

// 1. Add the Telegram function at the top (after imports or somewhere safe)
const tgFunction = `
// --- TELEGRAM NOTIFICATION BOT ---
const TG_BOT_TOKEN = "8838457415:AAEKau5X5g-yj1ghMq00zsS-uzolghL9-LI";
const TG_CHANNEL_ID = "-1004310971743";

async function notifyTelegramNewAnime(animeId: number, episodeNumber: number | null = null) {
  try {
    let animeData: any = null;
    try {
      const [rows]: any = await dbQuery("SELECT * FROM animes WHERE id = ?", [animeId]);
      if (rows && rows.length > 0) {
        animeData = rows[0];
      }
    } catch (dbErr) {
      const store = loadLocalStore();
      animeData = (store.animes || []).find((a: any) => String(a.id) === String(animeId));
    }

    if (!animeData) {
      console.error("Could not find animeData for notification:", animeId);
      return;
    }

    const toSlugLocal = (text: string): string => {
      if (!text) return "";
      return text
        .toLowerCase()
        .replace(/o['’\`‘]/g, "o")
        .replace(/g['’\`‘]/g, "g")
        .replace(/[^a-z0-9\\u0400-\\u04FF]+/gi, "-")
        .replace(/^-+|-+$/g, "");
    };

    const slug = toSlugLocal(animeData.title);
    const link = \`https://animem.uz/anime/\${slug}\`;
    const epString = episodeNumber ? \`🔢Qism: \${episodeNumber}\` : \`🔢Qism: \${animeData.qismlar_soni || 1}\`;
    const safeTitle = animeData.title.replace(/[_*\`\\[\\]]/g, '');
    let yiliStr = animeData.yil ? \`\\n📅Yili: \${animeData.yil}\` : "";
    
    const caption = \`🎬Yangi Qoshildi!\\n\\n📺Anime: *\${safeTitle}*\${yiliStr}\\n\${epString}\\n\\n🇺🇿O'zbek Tilida!\\n\\n▶️[Tomosha qilish!](\${link})\`;
    
    let imageUrl = animeData.image_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = \`https://animem.uz\${imageUrl}\`;
    }

    const res = await fetch(\`https://api.telegram.org/bot\${TG_BOT_TOKEN}/sendPhoto\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHANNEL_ID,
        photo: imageUrl || "https://animem.uz/logo.png",
        caption: caption,
        parse_mode: "Markdown"
      })
    });
    
    const result = await res.json();
    if (!result.ok) {
       console.error("Telegram API error:", result);
    } else {
       console.log("Telegram notification sent successfully!");
    }
  } catch (error) {
    console.error("Telegram notify failed:", error);
  }
}
// ---------------------------------
`;

if (!serverContent.includes('notifyTelegramNewAnime')) {
  // Find a good place to insert, like before the first route
  serverContent = serverContent.replace('app.post("/api/integrations/animebot/episode"', tgFunction + '\napp.post("/api/integrations/animebot/episode"');
}

// 2. Insert into app.post("/api/animes")
// Find where it succeeds in creating an anime
const animeAddSuccess = `      if (result && result.insertId) {
        insertId = result.insertId;
      }`;
const newAnimeAddSuccess = `      if (result && result.insertId) {
        insertId = result.insertId;
      }
      
      // Notify Telegram
      notifyTelegramNewAnime(insertId, qismlar_soni || null);`;
serverContent = serverContent.replace(animeAddSuccess, newAnimeAddSuccess);

// 3. Insert into app.post("/api/animes/:animeId/episodes")
const episodeAddSuccess = `      } else {
        const [result]: any = await dbQuery(
          "INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)",
          [anime_id, epNum, video_url]
        );
        if (result && result.insertId) epId = result.insertId;
      }`;
const newEpisodeAddSuccess = `      } else {
        const [result]: any = await dbQuery(
          "INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)",
          [anime_id, epNum, video_url]
        );
        if (result && result.insertId) epId = result.insertId;
        
        // Notify Telegram
        notifyTelegramNewAnime(anime_id, epNum);
      }`;
serverContent = serverContent.replace(episodeAddSuccess, newEpisodeAddSuccess);

fs.writeFileSync('server.ts', serverContent);
