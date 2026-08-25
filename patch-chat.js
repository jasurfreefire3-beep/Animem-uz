const fs = require('fs');
const file = 'src/components/ChatWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix localStorage stringify in setMessages
code = code.replace(/setMessages\(\(prev\) => \{\s*if \(prev\.some[^\n]+\n\s*const updated = \[\.\.\.prev, newMsg\];\s*try \{\s*localStorage\.setItem\('cached_chat_messages', JSON\.stringify\(updated\)\);\s*\} catch \(e\) \{\}\s*return updated;\s*\}\);/g, 
`setMessages((prev) => {
        if (prev.some(m => String(m.id) === String(newMsg.id))) return prev;
        return [...prev, newMsg];
      });`);

code = code.replace(/setMessages\(\(prev\) => \{\s*const updated = prev\.filter[^\n]+\n\s*try \{\s*localStorage\.setItem\('cached_chat_messages', JSON\.stringify\(updated\)\);\s*\} catch \(e\) \{\}\s*return updated;\s*\}\);/g,
`setMessages((prev) => prev.filter(msg => String(msg.id) !== String(deletedId)));`);

// 2. Add useEffect to save to localStorage
code = code.replace(/const \[showEmojiPicker, setShowEmojiPicker\] = useState\(false\);/, 
`const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    try {
      if (messages.length > 0) {
        // Only cache the last 50 messages to keep it fast
        localStorage.setItem('cached_chat_messages', JSON.stringify(messages.slice(-50)));
      }
    } catch(e) {}
  }, [messages]);`);

fs.writeFileSync(file, code);
