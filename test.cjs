const http = require('http');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const payloadSize = 2 * 1024 * 1024; // 2MB
const buffer = Buffer.alloc(payloadSize, 'a');

const bodyHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\n`;
const bodyFooter = `\r\n--${boundary}--\r\n`;

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/reels/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(bodyHeader) + buffer.length + Buffer.byteLength(bodyFooter),
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.write(bodyHeader);
req.write(buffer);
req.write(bodyFooter);
req.end();
