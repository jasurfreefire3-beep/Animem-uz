const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const pgPoolCode = `
// PostgreSQL Database Pool Connection for Videos
const pgPool = new PgPool({
  host: 'psql.fr-roub1.bengt.wasmernet.com',
  port: 20184,
  database: 'videosql',
  user: 'user_7b829204',
  password: 'pw_tg5oTgn1on6IZzimgSG8M5EJFPK9oY9j',
});

// Initialize PostgreSQL Video Table
async function initPgDb() {
  try {
    await pgPool.query(\`
      CREATE TABLE IF NOT EXISTS video (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255),
        mime_type VARCHAR(100),
        data BYTEA,
        size BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);
    console.log("Verified video table in PostgreSQL.");
  } catch (err) {
    console.error("Failed to initialize PostgreSQL video table:", err);
  }
}
initPgDb();
`;

content = content.replace('const pool = mysql.createPool({', pgPoolCode + '\nconst pool = mysql.createPool({');
fs.writeFileSync('server.ts', content);
console.log('Added pgPool code');
