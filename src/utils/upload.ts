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
  onProgress(20, "Video yuklanmoqda...");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/reels/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  onProgress(90, "Video bazaga saqlanmoqda...");
  const data = await parseApiResponse(res, "Video yuklashda xatolik");
  
  onProgress(100, "Muvaffaqiyatli yakunlandi!");
  return data.url;
};
