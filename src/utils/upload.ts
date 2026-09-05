export const uploadReelVideo = (
  file: File,
  token: string,
  onProgress: (progress: number, text: string) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        const loadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (event.total / (1024 * 1024)).toFixed(1);
        onProgress(percent, `Video yuklanmoqda... ${percent}% (${loadedMB} / ${totalMB} MB)`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const resultText = xhr.responseText;
        if (resultText && resultText.trim().startsWith("http")) {
          onProgress(100, "Muvaffaqiyatli yuklandi! 100%");
          resolve(resultText.trim());
        } else {
          reject(new Error("Catbox xatoligi: Noto'g'ri javob qaytdi."));
        }
      } else {
        if (xhr.status === 413) {
          reject(new Error("HTTP_413_PAYLOAD_TOO_LARGE: Video hajmi juda katta"));
        } else {
          reject(new Error(`Yuklashda xatolik yuz berdi (HTTP ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Tarmoq xatosi yoki CORS cheklovi (Internet aloqasini tekshiring)"));
    };

    xhr.onabort = () => {
      reject(new Error("Video yuklash bekor qilindi"));
    };

    onProgress(1, "Video catbox.moe ga yuklanmoqda... 1%");
    
    // Upload directly to catbox.moe (Bypassing our backend completely!)
    xhr.open("POST", "https://catbox.moe/user/api.php");
    // NOTE: Do NOT set Authorization header for catbox, otherwise it will trigger CORS preflight which will fail.
    xhr.send(formData);
  });
};
