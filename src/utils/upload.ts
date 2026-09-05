const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for much faster uploads

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

// Ultra-fast direct video upload using single connection and native XHR onprogress
export const uploadReelDirect = (
  file: File,
  token: string,
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("video", file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(98, Math.round((event.loaded / event.total) * 100));
        const loadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (event.total / (1024 * 1024)).toFixed(1);
        onProgress(percent, `Video yuklanmoqda... ${percent}% (${loadedMB} / ${totalMB} MB)`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data && data.url) {
            onProgress(100, "Muvaffaqiyatli yuklandi! 100%");
            resolve(data.url);
          } else {
            reject(new Error("Serverdan video havolasi olinmadi"));
          }
        } catch (e) {
          reject(new Error("Server javobini o'qishda xatolik yuz berdi"));
        }
      } else {
        let errMessage = "Video yuklashda xatolik";
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error) errMessage = errData.error;
        } catch (_) {}
        reject(new Error(errMessage));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Tarmoq xatosi (Internet aloqasini tekshiring)"));
    };

    xhr.onabort = () => {
      reject(new Error("Video yuklash bekor qilindi"));
    };

    onProgress(1, "Video yuborilmoqda... 1%");
    xhr.open("POST", "/api/reels/upload-direct");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

export const uploadVideoInChunks = async (
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

  // 2. Upload chunks sequentially with continuous progress calculation
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
    onProgress(displayProgress, `Video qismlari yuklanmoqda... ${displayProgress}% (${loadedMB}/${totalMB} MB)`);
  }

  // 3. Finish and store
  onProgress(98, "Video serverda birlashtirilmoqda... 98%");
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

// Unified video upload: attempts ultra-fast direct upload first, falls back to chunked
export const uploadReelVideo = async (
  file: File,
  token: string,
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  try {
    return await uploadReelDirect(file, token, onProgress);
  } catch (directErr: any) {
    console.warn("Direct upload error, switching to chunked upload:", directErr?.message || directErr);
    return await uploadVideoInChunks(file, token, onProgress);
  }
};

