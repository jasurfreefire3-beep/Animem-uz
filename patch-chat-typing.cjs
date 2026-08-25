const fs = require('fs');

function patchFile(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Add state
  const stateRegex = /const \[showScrollBottom, setShowScrollBottom\] = useState\(false\);/;
  const newState = `const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ id: string | number; name: string }[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);`;
  code = code.replace(stateRegex, newState);

  // Add socket events
  const socketOnDeleted = /socket\.on\('messageDeleted', \(deletedId: any\) => \{[\s\S]*?\}\);/;
  const typingSocketEvents = `
    socket.on('userTyping', (typingUser: { id: string | number; name: string }) => {
      setTypingUsers((prev) => {
        if (prev.find(u => String(u.id) === String(typingUser.id))) return prev;
        return [...prev, typingUser];
      });
    });

    socket.on('userStoppedTyping', (typingUser: { id: string | number; name: string }) => {
      setTypingUsers((prev) => prev.filter(u => String(u.id) !== String(typingUser.id)));
    });
`;
  code = code.replace(socketOnDeleted, (match) => match + '\n' + typingSocketEvents);

  // Replace setInputValue in handleSend to also clear timeout
  const handleSendRegex = /setInputValue\(''\);/;
  const handleSendReplace = `setInputValue('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (user && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("stopTyping", { id: user.id, name: user.name });
    }`;
  code = code.replace(handleSendRegex, handleSendReplace);

  // Add handleInputChange
  const handleInputChangeFn = `
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    if (user && socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("typing", { id: user.id, name: user.name });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("stopTyping", { id: user.id, name: user.name });
        }
      }, 2000);
    }
  };
  `;
  const handleSendDef = /const handleSend = async/;
  code = code.replace(handleSendDef, handleInputChangeFn + '\n  const handleSend = async');

  // Replace input onChange
  const inputOnChange = /onChange=\{\(e\) => setInputValue\(e\.target\.value\)\}/g;
  code = code.replace(inputOnChange, `onChange={handleInputChange}`);

  // Inject typing UI
  const inputAreaRegex = /\{\/\* Chat Input Area \*\/\}\s*<div className="p-3 border-t border-\[\#1a1a1a\] bg-\[\#0c0c0e\] relative shrink-0">/;
  const typingUI = `
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="absolute bottom-full left-0 w-full px-4 py-1.5 bg-gradient-to-t from-[#0c0c0e] to-transparent pointer-events-none z-10 flex items-center gap-2">
                <div className="flex gap-0.5 mt-0.5">
                  <span className="w-1 h-1 bg-[#ff006a] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-[#ff006a] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-[#ff006a] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] font-medium text-[#ff006a] italic">
                  {typingUsers.map(u => u.name).join(', ')} {typingUsers.length > 1 ? 'yozishmoqda...' : 'yozmoqda...'}
                </span>
              </div>
            )}
  `;
  code = code.replace(inputAreaRegex, (match) => typingUI + '\n' + match);

  fs.writeFileSync(file, code);
}

patchFile('src/components/ChatWidget.tsx');
patchFile('src/pages/Chat.tsx');
