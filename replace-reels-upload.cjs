const fs = require('fs');
let content = fs.readFileSync('src/pages/Reels.tsx', 'utf8');

const search = `  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setAddError("Reel yuklash uchun avval tizimga kiring!");
      return;
    }

    const isAdmin = currentUser?.role === 'admin';
    const MAX_USER_SIZE = 15 * 1024 * 1024; // 15 MB
    if (!isAdmin && file.size > MAX_USER_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setAddError(\`Oddiy foydalanuvchilar uchun maksimal video hajmi 15 MB. Siz tanlagan fayl hajmi: \${sizeMB} MB. Iltimos 15 MB dan kichik video tanlang!\`);
      return;
    }

    setIsUploading(true);
    setAddError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reels/upload', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${token}\`,
        },
        body: formData,
      });

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(res.status === 413 ? "Video hajmi juda katta!" : (text.slice(0, 80) || "Serverda xatolik yuz berdi"));
      }

      if (res.ok && data?.url) {
        setNewVideoUrl(data.url);
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1);
        setSelectedFileName(\`\${file.name} (\${sizeFormatted} MB)\`);
      } else {
        setAddError(data?.error || "Video yuklashda xatolik");
      }
    } catch (err: any) {
      setAddError(err?.message || "Video yuklashda xatolik");
    } finally {
      setIsUploading(false);
    }
  };`;

const insertState = `  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setAddError("Reel yuklash uchun avval tizimga kiring!");
      return;
    }

    const isAdmin = currentUser?.role === 'admin';
    const MAX_USER_SIZE = 15 * 1024 * 1024; // 15 MB
    if (!isAdmin && file.size > MAX_USER_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setAddError(\`Oddiy foydalanuvchilar uchun maksimal video hajmi 15 MB. Siz tanlagan fayl hajmi: \${sizeMB} MB. Iltimos 15 MB dan kichik video tanlang!\`);
      return;
    }

    setIsUploading(true);
    setAddError('');
    setUploadProgressPercent(0);
    setUploadProgressText("Boshlanmoqda...");

    try {
      const finalUrl = await uploadVideoInChunks(file, token, (progress, text) => {
        setUploadProgressPercent(progress);
        setUploadProgressText(text);
      });

      setNewVideoUrl(finalUrl);
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1);
      setSelectedFileName(\`\${file.name} (\${sizeFormatted} MB)\`);
    } catch (err: any) {
      setAddError(err?.message || "Video yuklashda xatolik");
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      setUploadProgressPercent(0);
      if (e.target) e.target.value = '';
    }
  };`;

content = content.replace(search, insertState);
fs.writeFileSync('src/pages/Reels.tsx', content);
