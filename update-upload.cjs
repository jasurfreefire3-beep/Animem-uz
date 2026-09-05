const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Replace MySQL insert for reels/upload-finish
const oldFinishInsert = `    // Store in database
    const [result] = await pool.execute(
      "INSERT INTO media (id, mime_type, file_size, data) VALUES (?, ?, ?, ?)",
      [mediaId, 'application/x-mpegURL', uploadInfo.totalSize, null]
    );`;

const newFinishInsert = `    // Store in PostgreSQL database
    try {
      await pgPool.query(
        "INSERT INTO video (id, filename, mime_type, data, size) VALUES ($1, $2, $3, $4, $5)",
        [mediaId, "video.mp4", 'application/x-mpegURL', null, uploadInfo.totalSize]
      );
    } catch(dbErr) {
      console.error("PostgreSQL DB insert error:", dbErr);
    }`;
    
content = content.replace(oldFinishInsert, newFinishInsert);

// Replace MySQL insert for reels/upload
const oldDirectInsert = `      await dbQuery(
        \`INSERT INTO media_files (id, filename, mime_type, data, size) VALUES (?, ?, ?, ?, ?)\`,
        [mediaId, filename, mimeType, base64String, fileSize]
      );`;

const newDirectInsert = `      // Store raw bytes to postgresql
      await pgPool.query(
        "INSERT INTO video (id, filename, mime_type, data, size) VALUES ($1, $2, $3, $4, $5)",
        [mediaId, filename, mimeType, fileBuffer, fileSize]
      );`;

content = content.replace(oldDirectInsert, newDirectInsert);

fs.writeFileSync('server.ts', content);
console.log('Update complete');
