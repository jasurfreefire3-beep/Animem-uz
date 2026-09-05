const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Replace upload-finish response
content = content.replace(
  'res.status(201).json({ url: `/api/media/hls/${mediaId}/video.m3u8`, success: true });',
  'res.status(201).json({ url: `/api/video/${mediaId}`, success: true });'
);

// Replace reels upload response
content = content.replace(
  'const m3u8Url = `/api/reels/stream/${mediaId}.m3u8`;',
  'const m3u8Url = `/api/video/${mediaId}`;'
);

fs.writeFileSync('server.ts', content);
console.log('Fixed responses');
