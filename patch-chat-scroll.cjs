const fs = require('fs');
const file = 'src/components/ChatWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

const scrollEffect = `
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    }
  }, [isOpen]);
`;

code = code.replace(/const scrollToBottom = \(\) => \{/g, scrollEffect + '\n  const scrollToBottom = () => {');

fs.writeFileSync(file, code);
