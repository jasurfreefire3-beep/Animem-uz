const CHUNK_SIZE = 512 * 1024; // 512KB chunks

async function parseApiResponse(res: Response, defaultErrorMsg: string) {
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!res.ok) {
      if (res.status === 413) throw new Error("HTTP_413_PAYLOAD_TOO_LARGE");
      throw new Error(defaultErrorMsg + ` (HTTP ${res.status})`);
    }
  }
  if (!res.ok) throw new Error(data.error || defaultErrorMsg);
  return data;
}

export const uploadReelVideo = async (
  file: File,
  token: string,
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  // 1. Start upload
  onProgress(2, "Video yuklashga tayyorlanmoqda... 2%");
  const startRes = await fetch("/api/reels/upload-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size,
      mimeType: file.type || "video/mp4"
    })
  });

  const startData = await parseApiResponse(startRes, "Video yuklashni boshlashda xatolik");
  const { uploadId } = startData;
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
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    await parseApiResponse(chunkRes, "Chunk yuklashda xatolik");

    const progress = Math.round(((i + 1) / totalChunks) * 95);
    const displayProgress = Math.min(progress, 96);
    const loadedMB = (Math.min(end, file.size) / (1024 * 1024)).toFixed(1);
    const totalMB = (file.size / (1024 * 1024)).toFixed(1);
    
    onProgress(displayProgress, `Video yuklanmoqda... ${displayProgress}% (${loadedMB}/${totalMB} MB)`);
  }

  // 3. Finish upload
  onProgress(98, "Video yakunlanmoqda... 98%");
  const finishRes = await fetch("/api/reels/upload-finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ uploadId })
  });

  const finishData = await parseApiResponse(finishRes, "Videoni yakunlashda xatolik");
  
  onProgress(100, "Muvaffaqiyatli yakunlandi! 100%");
  return finishData.url;
};
