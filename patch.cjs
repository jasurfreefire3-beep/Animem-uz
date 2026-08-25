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
                <div className="flex md:hidden flex-wrap items-center gap-2 mb-2 mt-2">
                  <span className="text-white/80 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-sm border border-white/5">TV Serial</span>
                  <span className="text-white/80 text-[10px] font-medium bg-white/10 px-2 py-0.5 rounded-sm border border-white/5">{anime.yil || '2026'}</span>
                  <span className="text-[#ff006a] text-[10px] font-bold uppercase">{anime.holati === 'Yakunlangan' ? 'YAKUNLANGAN' : 'EFIRDA'}</span>
                </div>
                   
                <div className="hidden md:block text-white/40 text-xs font-medium mb-5">Original nomi · TV Serial</div>`;

content = content.replace(target, replacement);

const target2 = `                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-[#ff006a] text-white text-[9px] uppercase font-bold rounded-sm tracking-wider shadow-[0_0_12px_rgba(255,0,106,0.4)]">
                    {anime.holati === 'Yakunlangan' ? 'YAKUNLANGAN' : 'EFIRDA'}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold px-2.5 py-1 bg-black/60 rounded-sm border border-white/5">
                    <Star className="w-3 h-3 fill-current" /> {anime.rating ? Number(anime.rating).toFixed(1) : '9.2'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5">
                    <Calendar className="w-3 h-3" /> {anime.yil || '2026'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5 max-w-[150px] truncate">
                    <Building className="w-3 h-3" /> {anime.studiyasi || 'Studio'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5">
                    <Eye className="w-3.5 h-3.5 text-[#ff006a]" /> {anime.korishlar || 0} ta ko'rish
                  </span>
                </div>`;

const replacement2 = `                <div className="hidden md:flex flex-wrap items-center justify-start gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-[#ff006a] text-white text-[9px] uppercase font-bold rounded-sm tracking-wider shadow-[0_0_12px_rgba(255,0,106,0.4)]">
                    {anime.holati === 'Yakunlangan' ? 'YAKUNLANGAN' : 'EFIRDA'}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold px-2.5 py-1 bg-black/60 rounded-sm border border-white/5">
                    <Star className="w-3 h-3 fill-current" /> {anime.rating ? Number(anime.rating).toFixed(1) : '9.2'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5">
                    <Calendar className="w-3 h-3" /> {anime.yil || '2026'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5 max-w-[150px] truncate">
                    <Building className="w-3 h-3" /> {anime.studiyasi || 'Studio'}
                  </span>
                  <span className="text-white/80 text-xs font-medium flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-sm border border-white/5">
                    <Eye className="w-3.5 h-3.5 text-[#ff006a]" /> {anime.korishlar || 0} ta ko'rish
                  </span>
                </div>`;

content = content.replace(target2, replacement2);

fs.writeFileSync('./src/pages/AnimeDetails.tsx', content);
