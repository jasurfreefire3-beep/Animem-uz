const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

// Also remove ffmpeg imports since we don't need them
content = content.replace(/import ffmpeg from "fluent-ffmpeg";\n/g, '');
content = content.replace(/import ffmpegInstaller from "@ffmpeg-installer\/ffmpeg";\n/g, '');
content = content.replace(/ffmpeg\.setFfmpegPath\(ffmpegInstaller\.path\);\n/g, '');

// Update mediaDir to use /tmp/media
content = content.replace(/const mediaDir = path\.join\(process\.cwd\(\), "data", "media"\);/g, 'const mediaDir = path.join(os.tmpdir(), "media");');
// Need to ensure os is imported
if (!content.includes('import os from')) {
    content = 'import os from "os";\n' + content;
}

fs.writeFileSync('server.ts', content);
console.log('Fixed imports and mediaDir');
