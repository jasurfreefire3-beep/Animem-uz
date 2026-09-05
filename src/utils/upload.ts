const CHUNK_SIZE = 512 * 1024; // 512KB to bypass Nginx 1M limits

export const uploadVideoInChunks = async (
  file: File, 
  token: string, 
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  // 1. Start upload
  onProgress(0, "Video serverga tayyorlanmoqda...");
  const startRes = await fetch("/api/reels/upload-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size,
      mimeType: file.type
    })
  });
  
  if (!startRes.ok) {
    const errorData = await startRes.json();
    throw new Error(errorData.error || "Video yuklashni boshlashda xatolik");
  }
  
  const { uploadId } = await startRes.json();
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // 2. Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append("uploadId", uploadId);
    formData.append("chunkIndex", i.toString());
    formData.append("totalChunks", totalChunks.toString());
    formData.append("chunk", chunk);
    
    const chunkRes = await fetch("/api/reels/upload-chunk", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    
    if (!chunkRes.ok) {
      const errorData = await chunkRes.json();
      throw new Error(errorData.error || "Chunk yuklashda xatolik");
    }
    
    const progress = Math.round(((i + 1) / totalChunks) * 100);
    // Don't reach 100 yet, because processing takes time
    const displayProgress = Math.min(progress, 99);
    onProgress(displayProgress, `Video qismlari yuklanmoqda... ${displayProgress}%`);
  }
  
  // 3. Finish and convert
  onProgress(99, "Video FFmpeg orqali HLS formatga o'tkazilmoqda. Kuting...");
  const finishRes = await fetch("/api/reels/upload-finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ uploadId })
  });
  
  if (!finishRes.ok) {
    const errorData = await finishRes.json();
    throw new Error(errorData.error || "Videoni HLS formatiga o'tkazishda xatolik");
  }
  
  const data = await finishRes.json();
  onProgress(100, "Muvaffaqiyatli yakunlandi!");
  return data.url;
};
