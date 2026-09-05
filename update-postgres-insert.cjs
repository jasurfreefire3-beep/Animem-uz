const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `    // Store in PostgreSQL database
    try {
      await pgPool.query(
        "INSERT INTO video (id, filename, mime_type, data, size) VALUES ($1, $2, $3, $4, $5)",
        [mediaId, "video.mp4", 'application/x-mpegURL', null, uploadInfo.totalSize]
      );
    } catch(dbErr) {
      console.error("PostgreSQL DB insert error:", dbErr);
    }`;

const newStr = `    // Store raw video directly in PostgreSQL database
    try {
      const fileBuffer = fs.readFileSync(finalPath);
      await pgPool.query(
        "INSERT INTO video (id, filename, mime_type, data, size) VALUES ($1, $2, $3, $4, $5)",
        [mediaId, "video.mp4", 'video/mp4', fileBuffer, uploadInfo.totalSize]
      );
    } catch(dbErr) {
      console.error("PostgreSQL DB insert error:", dbErr);
    }`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('server.ts', content);
console.log('Fixed postgres insert');
