import React, { useState, useRef } from 'react';
import { Upload, Layers, Plus, Trash2, ArrowUp, ArrowDown, Database, Link as LinkIcon, FileText, CheckCircle2, X } from 'lucide-react';

interface MangaPagesUploaderProps {
  pages: string[];
  onChange: (pages: string[]) => void;
}

export default function MangaPagesUploader({ pages, onChange }: MangaPagesUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [rawText, setRawText] = useState(pages.join('\n'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync text when switching or typing
  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const lines = text
      .split('\n')
      .flatMap((l) => l.split(','))
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    onChange(lines);
  };

  const uploadMultipleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setUploadError("Iltimos, faqat rasm fayllarini tanlang (JPG, PNG, WebP, GIF)");
      return;
    }

    // Sort files by name naturally (e.g. 1.jpg, 2.jpg, 10.jpg)
    fileArray.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      fileArray.forEach((file) => {
        formData.append('files', file);
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload-multiple', true);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 90);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.files && Array.isArray(data.files)) {
              const newUrls = data.files.map((f: any) => f.url);
              const combined = [...pages, ...newUrls];
              onChange(combined);
              setRawText(combined.join('\n'));
              setUploadProgress(100);
            } else {
              setUploadError("Serverdan sahifalar ro'yxati olinmadi");
            }
          } catch {
            setUploadError("Server javobida xatolik yuz berdi");
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            setUploadError(errData.error || "Rasmlarni MySQL bazasiga yuklashda xatolik");
          } catch {
            setUploadError("Rasmlarni MySQL bazasiga yuklashda xatolik");
          }
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadError("Tarmoq xatosi yuz berdi");
      };

      xhr.send(formData);
    } catch (err: any) {
      setIsUploading(false);
      setUploadError(err?.message || "Yuklashda xatolik");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMultipleFiles(e.target.files);
    }
  };

  const removePage = (index: number) => {
    const updated = pages.filter((_, i) => i !== index);
    onChange(updated);
    setRawText(updated.join('\n'));
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    const updated = [...pages];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
    setRawText(updated.join('\n'));
  };

  const clearAllPages = () => {
    onChange([]);
    setRawText('');
  };

  return (
    <div className="space-y-3">
      {/* Header and Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-white/70 uppercase tracking-wide flex items-center gap-1.5">
          <Layers size={14} className="text-[#ff006a]" />
          Bob Sahifalari Rasmlari ({pages.length} ta sahifa) *
        </label>
        <div className="flex items-center gap-1 bg-[#1a1a1e] p-0.5 rounded border border-[#333]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`text-[11px] px-2.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-[#ff006a] text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Upload size={11} /> Qurilmadan yuklash
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('text');
              setRawText(pages.join('\n'));
            }}
            className={`text-[11px] px-2.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'text'
                ? 'bg-[#ff006a] text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <FileText size={11} /> Matn / URL ro'yxat
          </button>
        </div>
      </div>

      {activeTab === 'upload' ? (
        <div className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="image/*"
            className="hidden"
          />

          {/* Multiple File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                uploadMultipleFiles(e.dataTransfer.files);
              }
            }}
            className={`border-2 border-dashed border-[#333] hover:border-[#ff006a] bg-[#0d0d10] hover:bg-[#121216] rounded-lg p-5 text-center cursor-pointer transition-all ${
              isUploading ? 'opacity-80 pointer-events-none' : ''
            }`}
          >
            {isUploading ? (
              <div className="py-4 space-y-2">
                <div className="w-8 h-8 mx-auto border-2 border-[#ff006a] border-t-transparent rounded-full animate-spin" />
                <div className="text-xs font-bold text-white">
                  Sahifalar MySQL bazasiga yuklanmoqda... {uploadProgress}%
                </div>
                <div className="w-64 max-w-full mx-auto bg-[#222] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#ff006a] h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="py-2 space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#18181c] border border-[#333] flex items-center justify-center text-[#ff006a]">
                  <Upload size={18} />
                </div>
                <div className="text-xs font-bold text-white">
                  Qurilmadan bob sahifalarini tanlang (Bir vaqtda bir nechta rasm)
                </div>
                <p className="text-[11px] text-white/40 max-w-md mx-auto">
                  Rasmlar fayl nomlari tartibi bo'yicha (1.jpg, 2.jpg...) avtomatik tartiblanadi va to'g'ridan-to'g'ri <strong className="text-emerald-400 font-bold">MySQL bazasiga</strong> saqlanadi.
                </p>
              </div>
            )}
          </div>

          {/* Uploaded Pages Grid Preview */}
          {pages.length > 0 && (
            <div className="space-y-2 bg-[#0a0a0d] border border-[#222] rounded-lg p-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#222]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Yuklangan sahifalar ({pages.length} ta)
                  </span>
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                    <Database size={10} /> MySQL
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs bg-[#18181c] hover:bg-[#25252c] text-white font-bold px-2.5 py-1 rounded border border-[#333] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Yana sahifa qo'shish
                  </button>
                  <button
                    type="button"
                    onClick={clearAllPages}
                    className="text-xs bg-red-950/40 hover:bg-red-900/60 text-red-400 px-2.5 py-1 rounded border border-red-500/30 transition-colors cursor-pointer"
                  >
                    Barchasini tozalash
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 pt-2 max-h-[360px] overflow-y-auto pr-1">
                {pages.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="group relative bg-[#121216] border border-[#333] rounded overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-[2/3] w-full bg-black/60 overflow-hidden">
                      <img
                        src={url}
                        alt={`${idx + 1}-sahifa`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://placehold.co/200x300/18181c/ff006a?text=Xato';
                        }}
                      />
                      <span className="absolute top-1 left-1 bg-black/80 text-white text-[10px] font-mono font-black px-1.5 py-0.5 rounded border border-white/20">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePage(idx)}
                        className="absolute top-1 right-1 bg-red-600/90 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>

                    <div className="p-1 bg-[#18181c] flex items-center justify-between border-t border-[#222]">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => movePage(idx, idx - 1)}
                        className="text-white/40 hover:text-white disabled:opacity-20 p-0.5 cursor-pointer disabled:cursor-not-allowed"
                        title="Oldinga siljitish"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <span className="text-[10px] text-white/50 font-bold">{idx + 1}</span>
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => movePage(idx, idx + 1)}
                        className="text-white/40 hover:text-white disabled:opacity-20 p-0.5 cursor-pointer disabled:cursor-not-allowed"
                        title="Keyinga siljitish"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Text / URL list textarea mode */
        <div className="space-y-2">
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => handleRawTextChange(e.target.value)}
            placeholder={"https://example.com/p1.jpg\nhttps://example.com/p2.jpg\nhttps://example.com/p3.jpg"}
            className="w-full bg-[#0d0d10] border border-[#333] rounded p-3 text-white text-xs font-mono focus:outline-none focus:border-[#ff006a]"
          />
          <p className="text-[11px] text-white/40">
            Har bir sahifa havolasini yangi qatordan yoki vergul bilan ajratib yozing.
          </p>
        </div>
      )}

      {/* Error display */}
      {uploadError && (
        <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 p-2.5 rounded flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-white cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
