const { Pool } = require('pg');

const pgPool = new Pool({
  host: 'psql.fr-roub1.bengt.wasmernet.com',
  port: 20184,
  database: 'videosql',
  user: 'user_7b829204',
  password: 'pw_tg5oTgn1on6IZzimgSG8M5EJFPK9oY9j',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS video (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255),
        mime_type VARCHAR(100),
        data BYTEA,
        size BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Table created successfully");
    
    const res = await pgPool.query("SELECT count(*) FROM video");
    console.log("Count:", res.rows[0].count);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await pgPool.end();
  }
}

run();
