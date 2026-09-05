// Add this below app.post("/api/reels/upload"...

const activeReelUploads = new Map<string, {
  userId: number;
  totalSize: number;
  tempPath: string;
  expectedChunks: number;
  receivedChunks: Set<number>;
  mimeType: string;
}>();

app.post("/api/reels/upload-start", authenticateToken, (req: any, res: any) => {
  const { filename, totalSize, mimeType } = req.body;
  const isAdmin = req.user?.role === "admin";
  const maxUserSize = 15 * 1024 * 1024; // 15 MB

  if (!isAdmin && totalSize > maxUserSize) {
    const currentMB = (totalSize / (1024 * 1024)).toFixed(1);
    return res.status(400).json({ 
      error: `Oddiy foydalanuvchilar uchun maksimal video hajmi 15 MB. Siz tanlagan video hajmi: ${currentMB} MB. Iltimos 15 MB dan kichik video yuklang!` 
    });
  }

  const uploadId = "upl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  const mediaDir = path.join(process.cwd(), "data", "media");
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }
  
  const tempPath = path.join(mediaDir, `${uploadId}.temp`);
  
  activeReelUploads.set(uploadId, {
    userId: req.user.id,
    totalSize,
    tempPath,
    expectedChunks: 0, // Will be known as chunks arrive
    receivedChunks: new Set(),
    mimeType: mimeType || 'video/mp4'
  });

  res.json({ uploadId });
});

app.post("/api/reels/upload-chunk", authenticateToken, upload.single("chunk"), (req: any, res: any) => {
  const { uploadId, chunkIndex, totalChunks } = req.body;
  const uploadInfo = activeReelUploads.get(uploadId);
  
  if (!uploadInfo || uploadInfo.userId !== req.user.id) {
    return res.status(404).json({ error: "Upload not found or expired" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Chunk missing" });
  }

  uploadInfo.expectedChunks = Number(totalChunks);
  
  const chunkBuffer = fs.readFileSync(req.file.path);
  const startPos = Number(chunkIndex) * (1024 * 1024); // Assuming 1MB chunks (but client will send smaller, wait, client sends exact chunk, we can't assume offset unless we append sequentially or seek).
  // Actually, append sequentially isn't safe if chunks arrive out of order.
  // Better to write to file descriptor at specific offset.
  
  // To avoid complexity, we can write chunk to disk: `tempPath_chunkIndex`
  const chunkPath = `${uploadInfo.tempPath}_${chunkIndex}`;
  fs.renameSync(req.file.path, chunkPath);
  
  uploadInfo.receivedChunks.add(Number(chunkIndex));
  
  res.json({ success: true, progress: Math.round((uploadInfo.receivedChunks.size / uploadInfo.expectedChunks) * 100) });
});

app.post("/api/reels/upload-finish", authenticateToken, async (req: any, res: any) => {
  const { uploadId } = req.body;
  const uploadInfo = activeReelUploads.get(uploadId);
  
  if (!uploadInfo || uploadInfo.userId !== req.user.id) {
    return res.status(404).json({ error: "Upload not found" });
  }
  
  if (uploadInfo.receivedChunks.size !== uploadInfo.expectedChunks) {
    return res.status(400).json({ error: "Missing chunks" });
  }
  
  const finalPath = uploadInfo.tempPath + ".mp4";
  const hlsDir = uploadInfo.tempPath + "_hls";
  
  try {
    // Combine chunks
    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < uploadInfo.expectedChunks; i++) {
      const chunkPath = `${uploadInfo.tempPath}_${i}`;
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      fs.unlinkSync(chunkPath); // Clean up
    }
    writeStream.end();
    
    await new Promise((resolve) => writeStream.on("finish", resolve));
    
    // Now convert to HLS via ffmpeg
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    
    const hlsPlaylistPath = path.join(hlsDir, 'video.m3u8');
    
    await new Promise((resolve, reject) => {
      ffmpeg(finalPath)
        .outputOptions([
          '-profile:v baseline',
          '-level 3.0',
          '-start_number 0',
          '-hls_time 10',
          '-hls_list_size 0',
          '-f hls'
        ])
        .output(hlsPlaylistPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Once done, delete finalPath (the raw mp4) to save space, or keep it. Let's keep it just in case, or delete. User asked for mp4 and hls.
    // "mp4 bolib yuklansin ffpmeg orqali hls namoish etilsin" (upload as mp4, show as hls via ffmpeg).

    const mediaId = uploadId;
    
    // Store in database
    const [result] = await db.execute(
      "INSERT INTO media (id, mime_type, file_size, data) VALUES (?, ?, ?, ?)",
      [mediaId, 'application/x-mpegURL', uploadInfo.totalSize, null]
    );
    
    activeReelUploads.delete(uploadId);
    
    res.status(201).json({ url: `/api/media/hls/${mediaId}/video.m3u8`, success: true });
    
  } catch (err: any) {
    console.error("HLS conversion error:", err);
    res.status(500).json({ error: "Videoni qayta ishlashda xatolik: " + err.message });
  }
});


app.get("/api/media/hls/:id/:file", (req: any, res: any) => {
  const { id, file } = req.params;
  const mediaDir = path.join(process.cwd(), "data", "media");
  const filePath = path.join(mediaDir, `${id}.temp_hls`, file);
  
  if (fs.existsSync(filePath)) {
    if (file.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/x-mpegURL');
    } else if (file.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/MP2T');
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send("Not found");
  }
});
