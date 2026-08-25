const fs = require('fs');
const file = 'src/components/ChatWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

const importRegex = /import React, \{ useState, useRef, useEffect, memo \} from 'react';/;
code = code.replace(importRegex, `import React, { useState, useRef, useEffect, memo, useCallback } from 'react';`);

code = code.replace(/const handleDeleteMessage = async \(msgId: string \| number\) => \{/g, `const handleDeleteMessage = useCallback(async (msgId: string | number) => {`);
// wait, we need to close the useCallback properly for handleDeleteMessage.
