const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const newEndpoint = `
// Stream raw video directly from PostgreSQL
app.get("/api/video/:id", async (req: any, res: any) => {
  try {
    const videoId = req.params.id;
    const { rows } = await pgPool.query("SELECT mime_type, data, size, filename FROM video WHERE id = $1", [videoId]);
    
    if (rows.length === 0 || !rows[0].data) {
      return res.status(404).send("Video PostgreSQL bazasidan topilmadi");
    }

    const video = rows[0];
    const videoSize = video.size || video.data.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      
      const chunksize = (end - start) + 1;
      const fileBuffer = video.data.slice(start, end + 1);

      res.writeHead(206, {
        "Content-Range": \`bytes \${start}-\${end}/\${videoSize}\`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": video.mime_type || "video/mp4",
      });
      res.end(fileBuffer);
    } else {
      res.writeHead(200, {
        "Content-Length": videoSize,
        "Content-Type": video.mime_type || "video/mp4",
      });
      res.end(video.data);
    }
  } catch (err: any) {
    console.error("PostgreSQL video stream error:", err);
    res.status(500).send("Server xatosi");
  }
});
`;

if (!content.includes('/api/video/:id')) {
    content = content.replace('app.get("*", (req, res) => {', newEndpoint + '\n  app.get("*", (req, res) => {');
    fs.writeFileSync('server.ts', content);
    console.log("Added /api/video/:id endpoint");
}
