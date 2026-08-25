const fs = require('fs');

const OLD_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const NEW_SITE_KEY = "6LdADY8tAAAAAJeHBsf1HLV-ArmkHgRNvQgZfClP";

const OLD_SECRET_KEY = "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";
const NEW_SECRET_KEY = "6LdADY8tAAAAADio9AzwRTgqDCKluKa3pspF6aE3";

function replaceKey(filePath, oldKey, newKey) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(oldKey).join(newKey);
  fs.writeFileSync(filePath, content);
}

// Update Frontend (Site Key)
replaceKey('./src/pages/Login.tsx', OLD_SITE_KEY, NEW_SITE_KEY);
replaceKey('./src/pages/Register.tsx', OLD_SITE_KEY, NEW_SITE_KEY);

// Update Backend (Secret Key)
replaceKey('./server.ts', OLD_SECRET_KEY, NEW_SECRET_KEY);

console.log("Keys replaced successfully.");
