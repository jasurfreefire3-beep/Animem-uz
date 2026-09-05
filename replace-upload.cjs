const fs = require('fs');

function replaceUpload(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  const search = `  const handleUploadReelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
  
  const insertState = `  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(0);

  const handleUploadReelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
  
  content = content.replace(search, insertState);
  
  const fetchSearch = `    setUploadingReel(true);
    setReelUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reels/upload', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${token}\`
        },
        body: formData
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
        setReelVideoUrl(data.url);
        const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1);
        setSelectedReelFileName(\`\${file.name} (\${sizeFormatted} MB)\`);
      } else {
        setReelUploadError(data?.error || "Video yuklashda xatolik yuz berdi");
      }`;
      
  const fetchReplace = `    setUploadingReel(true);
    setReelUploadError('');
    setUploadProgressPercent(0);
    setUploadProgressText("Boshlanmoqda...");

    try {
      const finalUrl = await uploadVideoInChunks(file, token, (progress, text) => {
        setUploadProgressPercent(progress);
        setUploadProgressText(text);
      });

      setReelVideoUrl(finalUrl);
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(1);
      setSelectedReelFileName(\`\${file.name} (\${sizeFormatted} MB)\`);`;
      
  content = content.replace(fetchSearch, fetchReplace);
  
  const finalSearch = `    } finally {
      setUploadingReel(false);
      e.target.value = '';
    }`;
    
  const finalReplace = `    } finally {
      setUploadingReel(false);
      setUploadProgressText('');
      setUploadProgressPercent(0);
      if (e.target) e.target.value = '';
    }`;
    
  content = content.replace(finalSearch, finalReplace);
  
  fs.writeFileSync(file, content);
}

replaceUpload('src/pages/Profil.tsx');
replaceUpload('src/pages/Reels.tsx');
