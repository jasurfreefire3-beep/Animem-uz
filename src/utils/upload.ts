async function parseApiResponse(res: Response, defaultErrorMsg: string) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!text || !text.trim()) {
    if (!res.ok) throw new Error(defaultErrorMsg);
    return {};
  }

  const looksLikeHtml =
    contentType.includes("text/html") ||
    text.trim().startsWith("<") ||
    text.includes("<!DOCTYPE") ||
    text.includes("<html");

  if (looksLikeHtml) {
    if (res.status === 401) {
      throw new Error("Tizimga kirish huquqi yo'q. Iltimos qayta kiring.");
    }
    if (res.status === 403) {
      throw new Error("Sessiya yaroqsiz yoki muddati tugagan. Iltimos qayta kiring.");
    }
    throw new Error(defaultErrorMsg + " (Server HTML javob qaytardi. API yo'li yoki sessiya noto'g'ri bo'lishi mumkin.)");
  }

  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(defaultErrorMsg + " (Server noto'g'ri formatda javob qaytardi)");
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
