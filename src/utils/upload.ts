const CHUNK_SIZE = 512 * 1024; // 512KB chunks to prevent any size limits

async function parseApiResponse(res: Response, defaultErrorMsg: string) {
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!res.ok || text.trim().startsWith("<") || text.includes("<!DOCTYPE")) {
      throw new Error(defaultErrorMsg + " (Server xatosi yoki video hajmi juda katta)");
    }
    throw new Error(defaultErrorMsg);
  }
  if (!res.ok) {
    throw new Error(data.error || defaultErrorMsg);
  }
  return data;
}

export const uploadVideoInChunks = async (
  file: File, 
  token: string, 
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  // 1. Start upload
  onProgress(0, "Video yuklashga tayyorlanmoqda...");
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

    const progress = Math.round(((i + 1) / totalChunks) * 100);
    const displayProgress = Math.min(progress, 99);
    onProgress(displayProgress, `Video qismlari yuklanmoqda... ${displayProgress}% (${i + 1}/${totalChunks})`);
  }

  // 3. Finish and store
  onProgress(99, "Video qismlari birlashtirilmoqda va bazaga saqlanmoqda...");
  const finishRes = await fetch("/api/reels/upload-finish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ uploadId })
  });

  const finishData = await parseApiResponse(finishRes, "Videoni yakunlashda xatolik");
  onProgress(100, "Muvaffaqiyatli yakunlandi!");
  return finishData.url;
};
