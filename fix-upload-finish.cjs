const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const regex = /\/\/ Now convert to HLS via ffmpeg[\s\S]*?\/\/ Once done, delete finalPath \(the raw mp4\) to save space, or keep it\. Let's keep it just in case, or delete\. User asked for mp4 and hls\./;

content = content.replace(regex, '');

fs.writeFileSync('server.ts', content);
console.log('Removed ffmpeg');
