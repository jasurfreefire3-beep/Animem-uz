const fs = require('fs');
const file = 'src/components/ChatWidget.tsx';
let code = fs.readFileSync(file, 'utf8');

// handleDeleteMessage
code = code.replace(/const handleDeleteMessage = async \(msgId: string \| number\) => \{[\s\S]*?console\.error\("Failed to delete message", e\);\s*\}\s*\};/, 
`const handleDeleteMessage = useCallback(async (msgId: string | number) => {
    try {
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msgId)));
      setSelectedMsgForAction(null);
      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const authToken = token || localStorage.getItem('token') || '';
      await fetch(\`\${API_BASE}/api/chat/messages/\${msgId}\`, {
        method: 'DELETE',
        headers: {
          ...(authToken ? { 'Authorization': \`Bearer \${authToken}\` } : {})
        }
      });
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  }, [token]);`);

// handleContextMenu
code = code.replace(/const handleContextMenu = \(e: React\.MouseEvent, msg: Message\) => \{[\s\S]*?setSelectedMsgForAction\(msg\);\s*\};/, 
`const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setSelectedMsgForAction(msg);
  }, [user]);`);

// handleTouchStart
code = code.replace(/const handleTouchStart = \(msg: Message\) => \{[\s\S]*?\}, 450\);\s*\};/,
`const handleTouchStart = useCallback((msg: Message) => {
    if (!user) return;
    touchTimeoutRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch (e) {}
      }
      setSelectedMsgForAction(msg);
    }, 450);
  }, [user]);`);

// handleTouchEnd
code = code.replace(/const handleTouchEnd = \(\) => \{[\s\S]*?touchTimeoutRef\.current = null;\s*\}\s*\};/,
`const handleTouchEnd = useCallback(() => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  }, []);`);

fs.writeFileSync(file, code);
