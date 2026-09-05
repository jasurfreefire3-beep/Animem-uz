const fs = require('fs');
let content = fs.readFileSync('src/pages/Profil.tsx', 'utf8');

const search = `                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Muqova (Poster / Thumbnail) Rasm URL (Ixtiyoriy)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={reelThumbnailUrl}
                    onChange={(e) => setReelThumbnailUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>`;
                
const replace = `                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    Muqova (Poster) Rasm (Ixtiyoriy)
                  </label>
                  <label className="flex items-center justify-center p-3 rounded-xl border border-dashed border-white/20 hover:border-pink-500 bg-white/5 cursor-pointer transition-colors text-white/60 text-xs text-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Rasm tanlash (JPG/PNG)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if(!file) return;
                        const fd = new FormData();
                        fd.append('file', file);
                        try {
                          const res = await fetch('/api/media/upload', {
                            method: 'POST',
                            headers: { Authorization: \`Bearer \${token}\` },
                            body: fd
                          });
                          if(res.ok) {
                            const d = await res.json();
                            setReelThumbnailUrl(d.url);
                          }
                        } catch(err) {}
                      }}
                    />
                  </label>
                  {reelThumbnailUrl && (
                    <div className="mt-2 flex items-center justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-[10px] text-emerald-400 truncate flex-1">✓ Rasm saqlandi</span>
                      <img src={reelThumbnailUrl} alt="Thumb" className="h-8 w-8 object-cover rounded ml-2" />
                    </div>
                  )}
                </div>`;
                
content = content.replace(search, replace);
fs.writeFileSync('src/pages/Profil.tsx', content);

let content2 = fs.readFileSync('src/pages/Reels.tsx', 'utf8');

const search2 = `              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Muqova (Poster / Thumbnail) Rasm URL (Ixtiyoriy)
                </label>
                <div className="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <LinkIcon className="w-4 h-4 text-white/40 shrink-0" />
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newThumbnailUrl}
                    onChange={(e) => setNewThumbnailUrl(e.target.value)}
                    className="w-full bg-transparent text-sm text-white focus:outline-none"
                  />
                </div>
              </div>`;
              
const replace2 = `              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">
                  Muqova (Poster) Rasm (Ixtiyoriy)
                </label>
                <label className="flex items-center justify-center p-3 rounded-xl border border-dashed border-white/20 hover:border-pink-500 bg-white/5 cursor-pointer transition-colors text-white/60 text-xs text-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Rasm tanlash (JPG/PNG)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if(!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      try {
                        const token = localStorage.getItem('token');
                        const res = await fetch('/api/media/upload', {
                          method: 'POST',
                          headers: { Authorization: \`Bearer \${token}\` },
                          body: fd
                        });
                        if(res.ok) {
                          const d = await res.json();
                          setNewThumbnailUrl(d.url);
                        }
                      } catch(err) {}
                    }}
                  />
                </label>
                {newThumbnailUrl && (
                  <div className="mt-2 flex items-center justify-between bg-white/5 rounded-lg p-2">
                    <span className="text-[10px] text-emerald-400 truncate flex-1">✓ Rasm saqlandi</span>
                    <img src={newThumbnailUrl} alt="Thumb" className="h-8 w-8 object-cover rounded ml-2" />
                  </div>
                )}
              </div>`;

content2 = content2.replace(search2, replace2);

// Let's also add progress UI to Reels.tsx
const search3 = `                  {newVideoUrl && (`;
const replace3 = `                  {isUploading && uploadProgressText && (
                    <div className="mt-2 text-xs font-semibold text-pink-400 bg-pink-500/10 rounded-xl px-3 py-2 border border-pink-500/20 text-center animate-pulse">
                      {uploadProgressText}
                    </div>
                  )}
                  {newVideoUrl && (`;
content2 = content2.replace(search3, replace3);

fs.writeFileSync('src/pages/Reels.tsx', content2);
