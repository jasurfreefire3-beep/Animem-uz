const fs = require('fs');
const file = 'src/components/ChatWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/useEffect\(\(\) => \{\s*if \(\!isOpen\) return;/g,
`useEffect(() => {
    // We remove early return so chat data is fetched in background and socket is ready instantly.`);

// Change dependency from [isOpen] to []
code = code.replace(/\}, \[isOpen\]\);/g, `}, []);`);

fs.writeFileSync(file, code);
