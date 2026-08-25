const fs = require('fs');
let content = fs.readFileSync('./src/pages/AnimeDetails.tsx', 'utf8');

const target1 = `      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full h-[320px] min-[400px]:h-[380px] sm:h-[450px] md:h-[55vh] md:min-h-[450px] bg-[#09090b] flex flex-col justify-end pt-16 md:pt-24 pb-4 md:pb-0"
      >`;

const replacement1 = `      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full min-h-[440px] sm:min-h-[500px] md:h-[55vh] md:min-h-[450px] bg-[#09090b] flex flex-col justify-end pt-16 md:pt-24 pb-4 md:pb-0"
      >`;

content = content.replace(target1, replacement1);

const target2 = `        {/* Mobile Top Controls */}
        <div className="absolute top-20 left-4 right-4 flex justify-between items-center z-20 md:hidden">`;

const replacement2 = `        {/* Mobile Top Controls */}
        <div className="w-full px-4 pt-4 flex justify-between items-center z-20 md:hidden mb-auto">`;

content = content.replace(target2, replacement2);

fs.writeFileSync('./src/pages/AnimeDetails.tsx', content);
