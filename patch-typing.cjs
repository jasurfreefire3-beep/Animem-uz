const fs = require('fs');
const file = 'server.ts';
let code = fs.readFileSync(file, 'utf8');

const typingEvents = `
  socket.on("typing", (data) => {
    // broadcast to all other clients except sender
    socket.broadcast.emit("userTyping", data);
  });

  socket.on("stopTyping", (data) => {
    socket.broadcast.emit("userStoppedTyping", data);
  });
`;

code = code.replace(/socket\.on\("sendMessage", async \(data\) => \{/, typingEvents + '\n  socket.on("sendMessage", async (data) => {');

fs.writeFileSync(file, code);
