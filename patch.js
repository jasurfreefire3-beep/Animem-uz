const fs = require('fs');
let content = fs.readFileSync('./src/pages/AnimeDetails.tsx', 'utf8');

const target = `                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-2 leading-tight tracking-tight uppercase">
                  {anime.title}
                </h1>
                   
                <div className="text-white/40 text-xs font-medium mb-5">Original nomi · TV Serial</div>`;

const replacement = `                <h1 className="text-xl min-[400px]:text-2xl sm:text-3xl md:text-5xl font-black text-white mb-2 leading-tight tracking-tight uppercase line-clamp-2 md:line-clamp-none">
                  {anime.title}
                </h1>

                {/* Mobile Meta Row */}
                <div className="flex md:hidden flex-wrap items-center gap-2 mb-2">
                  <span className="text-white/80 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-sm border border-white/5">TV Serial</span>
                  <span className="text-white/80 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-sm border border-white/5">{anime.yil || '2026'}</span>
                  <span className="text-[#ff006a] text-[10px] font-bold uppercase">{anime.holati === 'Yakunlangan' ? 'YAKUNLANGAN' : 'EFIRDA'}</span>
                </div>
                   
                <div className="hidden md:block text-white/40 text-xs font-medium mb-5">Original nomi · TV Serial</div>`;

content = content.replace(target, replacement);
fs.writeFileSync('./src/pages/AnimeDetails.tsx', content);
