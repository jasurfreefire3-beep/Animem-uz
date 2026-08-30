import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, CheckCircle2, X, RefreshCw, Database } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: 'poster' | 'banner' | 'square' | 'auto';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  className?: string;
}

export default function ImageUploader({
  label,
  value,
  onChange,
  aspectRatio = 'auto',
  placeholder = 'https://...',
  required = false,
  helpText,
  className = ''
}: ImageUploaderProps) {
  const [mode, setMode] = useState<'upload' | 'url'>(value && !value.startsWith('/api/media/') && !value.startsWith('data:') ? 'url' : 'upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case 'poster':
        return 'aspect-[2/3] max-w-[170px]';
      case 'banner':
        return 'aspect-[21/9] sm:aspect-[16/6] w-full max-h-[220px]';
      case 'square':
        return 'aspect-square max-w-[160px]';
      default:
        return 'min-h-[140px] max-h-[260px] w-full';
    }
  };

  const uploadFileToMySQL = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError("Faqat rasm fayllarini yuklash mumkin (JPG, PNG, WebP, GIF)");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("Rasm hajmi 20MB dan oshmasligi kerak");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadError(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload', true);
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
            if (data.url) {
              setUploadProgress(100);
              onChange(data.url);
            } else {
              setUploadError("Server javobida rasm havolasi topilmadi");
            }
          } catch {
            setUploadError("Server javobini o'qib bo'lmadi");
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            setUploadError(errData.error || "Rasmni MySQL bazasiga yuklashda xatolik");
          } catch {
            setUploadError("Rasmni MySQL bazasiga yuklashda xatolik");
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
    if (e.target.files && e.target.files[0]) {
      uploadFileToMySQL(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFileToMySQL(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files[0]) {
      e.preventDefault();
      uploadFileToMySQL(e.clipboardData.files[0]);
    }
  };

  const handleClear = () => {
    onChange('');
    setUploadError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and mode switch */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-white/70 uppercase tracking-wide flex items-center gap-1.5">
          <ImageIcon size={14} className="text-[#ff006a]" />
          {label} {required && <span className="text-[#ff006a]">*</span>}
        </label>
        <div className="flex items-center gap-1 bg-[#1a1a1e] p-0.5 rounded border border-[#333]">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`text-[11px] px-2.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
              mode === 'upload'
                ? 'bg-[#ff006a] text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Upload size={11} /> Qurilmadan
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`text-[11px] px-2.5 py-0.5 rounded font-bold transition-all flex items-center gap-1 cursor-pointer ${
              mode === 'url'
                ? 'bg-[#ff006a] text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <LinkIcon size={11} /> URL havola
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-2">
        {mode === 'upload' ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {value ? (
              /* Image Preview Card */
              <div className="relative group bg-[#0a0a0d] border border-[#333] rounded overflow-hidden">
                <div className={`relative flex items-center justify-center bg-black/40 overflow-hidden ${getAspectRatioClasses()}`}>
                  <img
                    src={value}
                    alt="Yuklangan rasm"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x600/18181c/ff006a?text=Rasm+topilmadi';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleClear}
                        className="bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-full transition-transform hover:scale-110 shadow-lg cursor-pointer"
                        title="Rasmni o'chirish"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-black/80 hover:bg-[#ff006a] text-white text-xs font-bold px-3 py-1.5 rounded border border-white/20 hover:border-[#ff006a] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw size={12} /> Almashtirish
                      </button>
                      {value.startsWith('/api/media/') && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-bold px-2 py-0.5 rounded">
                          <Database size={10} /> MySQL
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-[#121215] border-t border-[#222] flex items-center justify-between text-[11px] text-white/60">
                  <span className="truncate max-w-[200px] font-mono text-[10px]">
                    {value.startsWith('/api/media/') ? 'MySQL ma\'lumotlar bazasida saqlangan' : value}
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#ff006a] hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Boshqa rasm yuklash
                  </button>
                </div>
              </div>
            ) : (
              /* Drop / Upload Zone */
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onPaste={handlePaste}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded p-4 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#ff006a] bg-[#ff006a]/10 scale-[0.99]'
                    : 'border-[#333] hover:border-[#ff006a]/50 bg-[#0d0d10] hover:bg-[#121216]'
                } ${isUploading ? 'pointer-events-none opacity-80' : ''}`}
              >
                {isUploading ? (
                  <div className="py-4 space-y-2">
                    <div className="w-8 h-8 mx-auto border-2 border-[#ff006a] border-t-transparent rounded-full animate-spin" />
                    <div className="text-xs font-bold text-white">MySQL bazasiga yuklanmoqda... {uploadProgress}%</div>
                    <div className="w-48 max-w-full mx-auto bg-[#222] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#ff006a] h-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-3 space-y-1.5">
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#18181c] border border-[#333] flex items-center justify-center text-[#ff006a]">
                      <Upload size={18} />
                    </div>
                    <div className="text-xs font-bold text-white">
                      Qurilmadan rasm tanlang yoki shu yerga tashlang
                    </div>
                    <div className="text-[11px] text-white/40 flex items-center justify-center gap-2">
                      <span>JPG, PNG, WebP, GIF (20MB gacha)</span>
                      <span className="text-emerald-400 font-bold inline-flex items-center gap-0.5">
                        <Database size={10} /> MySQL saqlash
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* URL Input Mode */
          <div className="space-y-2">
            <div className="relative">
              <input
                type="url"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                className="w-full bg-[#0d0d10] border border-[#333] rounded px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#ff006a] transition-colors"
              />
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {value && (
              <div className="relative bg-[#0a0a0d] border border-[#333] rounded overflow-hidden max-w-sm">
                <div className={`relative flex items-center justify-center bg-black/40 overflow-hidden ${getAspectRatioClasses()}`}>
                  <img
                    src={value}
                    alt="Havola ko'rinishi"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x600/18181c/ff006a?text=URL+noto%27g%27ri';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-500/30 p-2 rounded flex items-center justify-between">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-red-400 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {helpText && (
          <p className="text-[11px] text-white/40">{helpText}</p>
        )}
      </div>
    </div>
  );
}
