const fs = require('fs');
const file = 'src/pages/Chat.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/useEffect\(\(\) => \{\s*if \(\!user\) return;/g, 
`useEffect(() => {`);
// Change dependency back to []
code = code.replace(/\}, \[user\]\);/g, `}, []);`);

fs.writeFileSync(file, code);
