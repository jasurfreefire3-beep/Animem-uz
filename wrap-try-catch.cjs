const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Replace upload-start
const startRegex = /app\.post\("\/api\/reels\/upload-start", authenticateToken, \(req: any, res: any\) => {([\s\S]*?)res\.json\({ uploadId }\);\n}\);/m;
const startMatch = content.match(startRegex);
if (startMatch) {
  content = content.replace(startRegex, `app.post("/api/reels/upload-start", authenticateToken, (req: any, res: any) => {\n  try {${startMatch[1]}res.json({ uploadId });\n  } catch (err: any) {\n    res.status(500).json({ error: "Start upload error: " + err.message });\n  }\n});`);
}

// Replace upload-chunk
const chunkRegex = /app\.post\("\/api\/reels\/upload-chunk", authenticateToken, upload\.single\("chunk"\), \(req: any, res: any\) => {([\s\S]*?)res\.json\({ success: true, progress: Math\.round\(\(uploadInfo\.receivedChunks\.size \/ uploadInfo\.expectedChunks\) \* 100\) }\);\n}\);/m;
const chunkMatch = content.match(chunkRegex);
if (chunkMatch) {
  content = content.replace(chunkRegex, `app.post("/api/reels/upload-chunk", authenticateToken, upload.single("chunk"), (req: any, res: any) => {\n  try {${chunkMatch[1]}res.json({ success: true, progress: Math.round((uploadInfo.receivedChunks.size / uploadInfo.expectedChunks) * 100) });\n  } catch (err: any) {\n    res.status(500).json({ error: "Chunk upload error: " + err.message });\n  }\n});`);
}

fs.writeFileSync('server.ts', content);
console.log('Wrapped endpoints in try/catch');
