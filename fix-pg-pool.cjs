const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldStr = `const pgPool = new PgPool({
  host: 'psql.fr-roub1.bengt.wasmernet.com',
  port: 20184,
  database: 'videosql',
  user: 'user_7b829204',
  password: 'pw_tg5oTgn1on6IZzimgSG8M5EJFPK9oY9j',
});`;

const newStr = `const pgPool = new PgPool({
  host: 'psql.fr-roub1.bengt.wasmernet.com',
  port: 20184,
  database: 'videosql',
  user: 'user_7b829204',
  password: 'pw_tg5oTgn1on6IZzimgSG8M5EJFPK9oY9j',
  ssl: { rejectUnauthorized: false }
});`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('server.ts', content);
console.log('Fixed pgPool config');
