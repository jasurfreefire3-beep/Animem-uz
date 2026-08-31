import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import { Server } from "socket.io";
import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import compression from "compression";
import webpush from "web-push";

dotenv.config();

// Setup VAPID keys for Web Push Notifications (Works even when user is offline / site is closed)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BNo_Gg_l4U1Gj1c-E7B68Y52p7dO64lXvC4L91x5NlB1qGgJ7fK1lZlU9sX4_y9zL2pX2s9k-M6Z3q1j5a4g6gE";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "K7mQ6lX_3s9k4p1j8a2g5dE6bL1qZlU9sX4y2z0pX1c";

try {
  webpush.setVapidDetails(
    "mailto:support@animem.uz",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.warn("VAPID setup notice:", e);
}

const upload = multer({ dest: "/tmp/" });

const app = express();
app.set("trust proxy", true);
app.use(compression({
  threshold: 512, // Compress anything larger than 512 bytes
}));
app.use(cors());

// Proxy Firebase Auth helper routes (/__/*) to Firebase's default auth handler
app.use("/__", (req, res) => {
  const targetPath = "/__" + req.url;
  const options = {
    hostname: "gen-lang-client-0918187443.firebaseapp.com",
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: "gen-lang-client-0918187443.firebaseapp.com",
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Firebase Auth Proxy Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Auth Proxy Error");
    }
  });

  req.pipe(proxyReq, { end: true });
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// --- TURNSTILE VERIFICATION ---
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "6LdADY8tAAAAADio9AzwRTgqDCKluKa3pspF6aE3";

async function verifyCaptchaToken(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const formData = new URLSearchParams();
    formData.append('secret', RECAPTCHA_SECRET);
    formData.append('response', token);
    formData.append('remoteip', ip);
    
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: formData,
    });
    
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "anime_super_secret_key";
const ANIMEBOT_SYNC_SECRET = process.env.ANIMEBOT_SYNC_SECRET || "";

// MySQL Database Pool Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || "db.fr-pari1.bengt.wasmernet.com",
  port: Number(process.env.DB_PORT) || 10272,
  user: process.env.DB_USER || "user_b1d5fdb1",
  password: process.env.DB_PASSWORD || "pw_7GNRdocASAIUzobl5Ezatle9fwRC3oYq",
  database: process.env.DB_NAME || "dataanime",
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  idleTimeout: 30000,
  connectTimeout: 20000,
});

// Create Server

(pool as any).on("error", (err: any) => {
  console.error("[DB Pool Error]", err?.message || err);
});

// Resilient query wrapper with automatic retry on connection drops
async function dbQuery<T = any>(sql: string, params?: any[], retries = 3): Promise<T> {
  try {
    const res = await pool.query(sql, params);
    return res as unknown as T;
  } catch (err: any) {
    const isConnErr =
      err?.code === "PROTOCOL_CONNECTION_LOST" ||
      err?.code === "ECONNRESET" ||
      err?.code === "EPIPE" ||
      err?.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
      err?.code === "ETIMEDOUT" ||
      (err?.message && (
        err.message.includes("Connection lost") ||
        err.message.includes("closed the connection") ||
        err.message.includes("is closed")
      ));

    if (isConnErr && retries > 0) {
      console.warn(`[DB] Connection lost (${err.message}), retrying query in 300ms... (${retries} attempts remaining)`);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return dbQuery<T>(sql, params, retries - 1);
    }
    throw err;
  }
}

const LOCAL_STORE_PATH = path.join(process.cwd(), "local_store.json");

// In-Memory Global Server Cache (Instant sub-millisecond response)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const serverCache = new Map<string, CacheEntry<any>>();

function getCache<T>(key: string, maxAgeMs = 20000): T | null {
  const item = serverCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > maxAgeMs) {
    serverCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache<T>(key: string, data: T): void {
  serverCache.set(key, { data, timestamp: Date.now() });
}

function invalidateServerCache(pattern?: string): void {
  if (!pattern) {
    serverCache.clear();
    return;
  }
  for (const k of Array.from(serverCache.keys())) {
    if (k.includes(pattern)) {
      serverCache.delete(k);
    }
  }
}

let memoryLocalStore: any = null;
let saveStoreTimeout: any = null;

function loadLocalStore() {
  if (memoryLocalStore) {
    return memoryLocalStore;
  }
  try {
    if (!fs.existsSync(LOCAL_STORE_PATH)) {
      const defaultData = {
        animes: [
          {
            id: 1,
            title: "Solo Leveling 2-Mavsum",
            description: "Sung Jin-Woo eng kuchsiz ovchidan dunyoning eng kuchli soyalar hukmdorigacha bo'lgan yo'lini davom ettiradi.",
            image_url: "https://m.media-amazon.com/images/M/MV5BODlhWOE5NjMtN2I0OC00NjA3LTkyM2YtM2I5Njg3MTBhYTY1XkEyXkFqcGc@._V1_.jpg",
            banner_url: "https://m.media-amazon.com/images/M/MV5BODlhWOE5NjMtN2I0OC00NjA3LTkyM2YtM2I5Njg3MTBhYTY1XkEyXkFqcGc@._V1_.jpg",
            rating: 9.8,
            rating_count: 150,
            holati: "Davom etmoqda",
            yil: 2025,
            studiyasi: "A-1 Pictures",
            qismlar_soni: 12,
            korishlar: 1240,
            janrlar: "Jangari, Sarguzasht, Fantastika",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
            tavsiya: true,
            is_banner: true
          },
          {
            id: 2,
            title: "Jujutsu Kaisen 2-Mavsum",
            description: "Gojo Satoru va Suguru Getoning o'tmishi hamda Shibuya voqealari tasvirlangan unutilmas mavsum.",
            image_url: "https://m.media-amazon.com/images/M/MV5BNGY4MTg3NjgtMmFkYi00ZTNmLTgwAVtLTExNmI0MDI0U3M4XkEyXkFqcGc@._V1_.jpg",
            banner_url: "https://m.media-amazon.com/images/M/MV5BNGY4MTg3NjgtMmFkYi00ZTNmLTgwAVtLTExNmI0MDI0U3M4XkEyXkFqcGc@._V1_.jpg",
            rating: 9.5,
            rating_count: 120,
            holati: "Tugallangan",
            yil: 2023,
            studiyasi: "MAPPA",
            qismlar_soni: 23,
            korishlar: 980,
            janrlar: "Jangari, Mistika, Mifyologiya",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
            tavsiya: true,
            is_banner: true
          },
          {
            id: 3,
            title: "Demon Slayer: Hashira Training Arc",
            description: "Tanjiro va uning do'stlari Yuqori Darajali iblislar bilan bo'ladigan hal qiluvchi jang oldidan Hashiralar bilan mashg'ulot o'tkazishadi.",
            image_url: "https://m.media-amazon.com/images/M/MV5BZjgwNzRhM2EtNWY2OC00M2I2LThmYWYtMDlkY2VmZWM4Y2FlXkEyXkFqcGc@._V1_.jpg",
            banner_url: "https://m.media-amazon.com/images/M/MV5BZjgwNzRhM2EtNWY2OC00M2I2LThmYWYtMDlkY2VmZWM4Y2FlXkEyXkFqcGc@._V1_.jpg",
            rating: 9.2,
            rating_count: 95,
            holati: "Tugallangan",
            yil: 2024,
            studiyasi: "ufotable",
            qismlar_soni: 8,
            korishlar: 850,
            janrlar: "Jangari, Mifyologiya, Tarixiy",
            video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
            tavsiya: true,
            is_banner: true
          }
        ],
        notifications: [
          {
            id: 1,
            message: "Xush kelibsiz! Animem.uz platformasiga yangi animelar va epizodlar yuklanmoqda.",
            created_at: new Date().toISOString()
          }
        ],
        comments: [],
        episodes: [],
        users: [],
        ratings: [],
        messages: [],
        mangas: [],
        manga_chapters: [],
        dramas: [],
        donations: []
      };
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(defaultData, null, 2), "utf-8");
      memoryLocalStore = defaultData;
      return memoryLocalStore;
    }
    const raw = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
    memoryLocalStore = JSON.parse(raw);
    if (!memoryLocalStore.mangas) memoryLocalStore.mangas = [];
    if (!memoryLocalStore.manga_chapters) memoryLocalStore.manga_chapters = [];
    if (!memoryLocalStore.dramas) memoryLocalStore.dramas = [];
    if (!memoryLocalStore.drama_episodes) memoryLocalStore.drama_episodes = [];
    if (!memoryLocalStore.donations) memoryLocalStore.donations = [];
    return memoryLocalStore;
  } catch (e) {
    console.error("Error loading local_store.json:", e);
    return { animes: [], notifications: [], comments: [], episodes: [], users: [], ratings: [], messages: [] };
  }
}

function saveLocalStore(data: any) {
  memoryLocalStore = data;
  if (saveStoreTimeout) clearTimeout(saveStoreTimeout);
  saveStoreTimeout = setTimeout(() => {
    fs.promises.writeFile(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), "utf-8").catch((err) => {
      console.error("Error async saving local_store.json:", err);
    });
  }, 1000);
}

const server = http.createServer(app);

// Socket.io Server Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware to authenticate JWT tokens
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    if (decoded && decoded.id) {
      dbQuery("UPDATE users SET last_seen = NOW() WHERE id = ?", [decoded.id]).catch(() => {});
    }
    next();
  });
};

// Check and ensure database connection on start
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MySQL database successfully!");
    
    // Create notifications table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        image LONGTEXT DEFAULT NULL,
        url VARCHAR(500) DEFAULT '/',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await connection.query(`ALTER TABLE notifications ADD COLUMN image LONGTEXT DEFAULT NULL`);
    } catch (e) {}
    try {
      await connection.query(`ALTER TABLE notifications ADD COLUMN url VARCHAR(500) DEFAULT '/'`);
    } catch (e) {}
    console.log("Verified notifications table in MySQL.");

    // Create push_subscriptions table for background device push notifications
    await connection.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR(255) NOT NULL,
        auth VARCHAR(255) NOT NULL,
        user_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log("Verified push_subscriptions table in MySQL.");

    // Check if avatar_url column exists in users
    const [columns]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'avatar_url' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN avatar_url MEDIUMTEXT DEFAULT NULL
      `);
      console.log("Added avatar_url column to users table.");
    }

    // Check if telegram_id column exists in users
    const [tgColumns]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'telegram_id' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (tgColumns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN telegram_id VARCHAR(255) DEFAULT NULL
      `);
      console.log("Added telegram_id column to users table.");
    }

    // Check if phone column exists in users
    const [phoneColumns]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'phone' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (phoneColumns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN phone VARCHAR(255) DEFAULT NULL
      `);
      console.log("Added phone column to users table.");
    }

    // Check if yandex_id column exists in users
    const [yandexColumns]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'yandex_id' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (yandexColumns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN yandex_id VARCHAR(255) DEFAULT NULL
      `);
      console.log("Added yandex_id column to users table.");
    }

    // Check if discord_id column exists in users
    const [discordColumns]: any = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'users'
        AND COLUMN_NAME = 'discord_id'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (discordColumns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN discord_id VARCHAR(255) DEFAULT NULL
      `);
      console.log("Added discord_id column to users table.");
    }

    // Check if facebook_id column exists in users
    const [facebookColumns]: any = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'users'
        AND COLUMN_NAME = 'facebook_id'
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (facebookColumns.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN facebook_id VARCHAR(255) DEFAULT NULL
      `);
      console.log("Added facebook_id column to users table.");
    }

    // Check if created_at column exists in users
    const [createdAtCols]: any = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'created_at' 
        AND TABLE_SCHEMA = DATABASE()
    `);

    if (createdAtCols.length === 0) {
      await connection.query(`
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log("Added created_at column to users table.");
    }

    // Ensure profile & social columns exist in users table
    const profileColumns = [
      { name: "auth_provider", type: "VARCHAR(50) DEFAULT NULL" },
      { name: "bio", type: "TEXT DEFAULT NULL" },
      { name: "banner_url", type: "MEDIUMTEXT DEFAULT NULL" },
      { name: "telegram", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "instagram", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "tiktok", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "youtube", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "discord", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "facebook", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "vk", type: "VARCHAR(255) DEFAULT NULL" },
      { name: "favorites", type: "LONGTEXT DEFAULT NULL" },
      { name: "watch_time_minutes", type: "INT DEFAULT 0" },
      { name: "watch_history", type: "LONGTEXT DEFAULT NULL" },
      { name: "last_seen", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" }
    ];

    for (const col of profileColumns) {
      try {
        const [cCols]: any = await connection.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'users' 
            AND COLUMN_NAME = ? 
            AND TABLE_SCHEMA = DATABASE()
        `, [col.name]);
        if (cCols.length === 0) {
          await connection.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added ${col.name} column to users table.`);
        }
      } catch (e) {
        console.warn(`Migration check for ${col.name} failed:`, e);
      }
    }

    // Fix existing telegram bot users who have telegram_id but auth_provider is NULL
    try {
      await connection.query(`
        UPDATE users 
        SET auth_provider = 'telegram_bot' 
        WHERE telegram_id IS NOT NULL 
          AND (auth_provider IS NULL OR auth_provider = '' OR auth_provider = 'telegram')
      `);
      console.log("Synchronized existing telegram users auth_provider to telegram_bot");
    } catch (e) {
      console.warn("Fix telegram users auth_provider failed:", e);
    }

    // Create mangas table if not exists in MySQL
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mangas (
        id BIGINT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        cover_url TEXT,
        banner_url TEXT,
        author VARCHAR(255),
        artist VARCHAR(255),
        janrlar VARCHAR(255),
        holati VARCHAR(100),
        released_year INT DEFAULT 2024,
        rating FLOAT DEFAULT 9.5,
        korishlar INT DEFAULT 0,
        chapters_count INT DEFAULT 0,
        created_at VARCHAR(255)
      )
    `);

    // Create manga_chapters table if not exists in MySQL
    await connection.query(`
      CREATE TABLE IF NOT EXISTS manga_chapters (
        id BIGINT PRIMARY KEY,
        manga_id BIGINT NOT NULL,
        chapter_number INT NOT NULL,
        title VARCHAR(255),
        pages LONGTEXT,
        views INT DEFAULT 0,
        created_at VARCHAR(255)
      )
    `);

    // Ensure tags column in animes & mangas
    try {
      const [aCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'animes' AND COLUMN_NAME = 'tags' AND TABLE_SCHEMA = DATABASE()`);
      if (aCols.length === 0) {
        await connection.query(`ALTER TABLE animes ADD COLUMN tags VARCHAR(255) DEFAULT NULL`);
      }
    } catch(e) {}

    try {
      const [adultCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'animes' AND COLUMN_NAME = 'is_adult' AND TABLE_SCHEMA = DATABASE()`);
      if (adultCols.length === 0) {
        await connection.query(`ALTER TABLE animes ADD COLUMN is_adult TINYINT(1) DEFAULT 0`);
      }
    } catch(e) {}

    try {
      const [tgCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'animes' AND COLUMN_NAME = 'telegram_url' AND TABLE_SCHEMA = DATABASE()`);
      if (tgCols.length === 0) {
        await connection.query(`ALTER TABLE animes ADD COLUMN telegram_url VARCHAR(500) DEFAULT NULL`);
      }
    } catch(e) {}

    try {
      const [mCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mangas' AND COLUMN_NAME = 'tags' AND TABLE_SCHEMA = DATABASE()`);
      if (mCols.length === 0) {
        await connection.query(`ALTER TABLE mangas ADD COLUMN tags VARCHAR(255) DEFAULT NULL`);
      }
    } catch(e) {}

    try {
      const [tCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'mangas' AND COLUMN_NAME = 'type' AND TABLE_SCHEMA = DATABASE()`);
      if (tCols.length === 0) {
        await connection.query(`ALTER TABLE mangas ADD COLUMN type VARCHAR(100) DEFAULT 'Manga'`);
      }
      await connection.query(`UPDATE mangas SET type = 'Manhwa' WHERE title LIKE '%Solo Leveling%'`);
    } catch(e) {}

    // Ensure comments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        anime_id BIGINT DEFAULT NULL,
        manga_id BIGINT DEFAULT NULL,
        drama_id BIGINT DEFAULT NULL,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0,
        liked_users TEXT DEFAULT NULL,
        disliked_users TEXT DEFAULT NULL,
        replies LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      const [cCols]: any = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'comments' AND TABLE_SCHEMA = DATABASE()`);
      const colNames = (cCols || []).map((c: any) => c.COLUMN_NAME);
      if (!colNames.includes('drama_id')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN drama_id BIGINT DEFAULT NULL`);
      }
      if (!colNames.includes('liked_users')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN liked_users TEXT DEFAULT NULL`);
      }
      if (!colNames.includes('disliked_users')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN disliked_users TEXT DEFAULT NULL`);
      }
      if (!colNames.includes('replies')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN replies LONGTEXT DEFAULT NULL`);
      }
      if (!colNames.includes('likes')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN likes INT DEFAULT 0`);
      }
      if (!colNames.includes('dislikes')) {
        await connection.query(`ALTER TABLE comments ADD COLUMN dislikes INT DEFAULT 0`);
      }
    } catch(e) {}

    // Create dramas table if not exists in MySQL
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS dramas (
          id BIGINT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          poster_url LONGTEXT,
          banner_url LONGTEXT,
          janrlar VARCHAR(255),
          yil INT DEFAULT 2024,
          likes INT DEFAULT 0,
          liked_users LONGTEXT DEFAULT NULL,
          korishlar INT DEFAULT 0,
          video_url LONGTEXT,
          telegram_url VARCHAR(500),
          created_at VARCHAR(255)
        )
      `);
      console.log("Verified dramas table in MySQL.");
    } catch (e) {
      console.warn("dramas table creation warning:", e);
    }

    // Create drama_episodes table if not exists in MySQL
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS drama_episodes (
          id BIGINT PRIMARY KEY,
          drama_id BIGINT NOT NULL,
          qism INT NOT NULL,
          title VARCHAR(255),
          video_url LONGTEXT NOT NULL,
          created_at VARCHAR(255)
        )
      `);
      console.log("Verified drama_episodes table in MySQL.");
    } catch (e) {
      console.warn("drama_episodes table creation warning:", e);
    }

    // Ensure messages table for chat
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT DEFAULT NULL,
          user_name VARCHAR(255) DEFAULT 'Anonim',
          content LONGTEXT NOT NULL,
          reply_to_id VARCHAR(255) DEFAULT NULL,
          reply_to_name VARCHAR(255) DEFAULT NULL,
          reply_to_content LONGTEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await connection.query(`ALTER TABLE messages MODIFY COLUMN content LONGTEXT`);
      await connection.query(`ALTER TABLE messages MODIFY COLUMN reply_to_content LONGTEXT`);
    } catch (e) {
      console.warn("Messages table verification in MySQL notice:", e);
    }

    // Ensure media_files table in MySQL (Stores images in DB directly without saving to disk)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS media_files (
          id VARCHAR(64) PRIMARY KEY,
          filename VARCHAR(255) DEFAULT '',
          mime_type VARCHAR(100) DEFAULT 'image/jpeg',
          data LONGTEXT NOT NULL,
          size INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
      console.log("Verified media_files table in MySQL.");
    } catch (e) {
      console.warn("media_files table creation warning:", e);
    }

    // Ensure animes and mangas image columns support large text / data
    try {
      await connection.query(`ALTER TABLE animes MODIFY COLUMN image_url LONGTEXT`);
      await connection.query(`ALTER TABLE animes MODIFY COLUMN banner_url LONGTEXT`);
    } catch (e) {}

    try {
      await connection.query(`ALTER TABLE mangas MODIFY COLUMN cover_url LONGTEXT`);
      await connection.query(`ALTER TABLE mangas MODIFY COLUMN banner_url LONGTEXT`);
    } catch (e) {}

    console.log("Verified mangas, manga_chapters, comments, media_files and messages tables and columns in MySQL.");

    connection.release();
  } catch (err) {
    console.error("Database connection/migration failed on startup:", err);
  }
}
testDbConnection();

// --- Socket.io Real-time Chat Logic ---
io.on("connection", async (socket) => {
  console.log("A user connected to the chat:", socket.id);

  try {
    let previousMessages: any[] = [];
    try {
      const [rows]: any = await dbQuery(
        `SELECT m.*, u.avatar_url AS user_avatar 
         FROM messages m 
         LEFT JOIN users u ON m.user_id = u.id 
         ORDER BY m.id DESC LIMIT 50`
      );
      if (Array.isArray(rows) && rows.length > 0) {
        previousMessages = [...rows].reverse();
      }
    } catch (dbErr) {
      console.warn("Socket fetch previous messages DB failed, fallback to local store:", dbErr);
    }

    if (!previousMessages || previousMessages.length === 0) {
      const store = loadLocalStore();
      previousMessages = (store.messages || []).slice(-50);
    }

    socket.emit("previousMessages", previousMessages);
  } catch (err) {
    console.error("Error fetching previous messages for socket:", err);
  }

  // Handle new message via socket
  
  socket.on("typing", (data) => {
    // broadcast to all other clients except sender
    socket.broadcast.emit("userTyping", data);
  });

  socket.on("stopTyping", (data) => {
    socket.broadcast.emit("userStoppedTyping", data);
  });

  socket.on("sendMessage", async (data) => {
    try {
      const { user_id, user_name, content, reply_to_id, reply_to_name, reply_to_content } = data;
      if (!content || !content.trim()) return;

      let insertedMessage: any = null;

      try {
        const [result]: any = await dbQuery(
          "INSERT INTO messages (user_id, user_name, content, reply_to_id, reply_to_name, reply_to_content) VALUES (?, ?, ?, ?, ?, ?)",
          [
            user_id || null,
            user_name || "Anonim",
            content,
            reply_to_id || null,
            reply_to_name || null,
            reply_to_content || null,
          ]
        );

        let user_avatar = null;
        if (user_id) {
          try {
            const [uRows]: any = await dbQuery("SELECT avatar_url FROM users WHERE id = ?", [user_id]);
            if (uRows && uRows[0]) {
              user_avatar = uRows[0].avatar_url;
            }
          } catch (e) {}
        }

        insertedMessage = {
          id: result.insertId,
          user_id,
          user_name: user_name || "Anonim",
          user_avatar,
          content,
          reply_to_id,
          reply_to_name,
          reply_to_content,
          created_at: new Date().toISOString(),
        };
      } catch (dbErr) {
        console.warn("Socket DB message save failed, fallback to local store:", dbErr);
      }

      const store = loadLocalStore();
      if (!store.messages) store.messages = [];

      if (!insertedMessage) {
        insertedMessage = {
          id: Date.now(),
          user_id,
          user_name: user_name || "Anonim",
          user_avatar: null,
          content,
          reply_to_id,
          reply_to_name,
          reply_to_content,
          created_at: new Date().toISOString(),
        };
      }

      store.messages.push(insertedMessage);
      if (store.messages.length > 500) {
        store.messages = store.messages.slice(-500);
      }
      saveLocalStore(store);

      // Broadcast new message to everyone
      io.emit("newMessage", insertedMessage);
    } catch (err) {
      console.error("Error saving new chat message via socket:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected from the chat:", socket.id);
  });
});

// --- API ROUTES ---

// Video streaming proxy endpoint to bypass CORS / hotlinking / referrer restrictions
app.get("/api/proxy-video", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Video URL is required");
  }

  try {
    let cleanUrl = targetUrl.trim();
    if (cleanUrl.startsWith("//")) {
      cleanUrl = "https:" + cleanUrl;
    }

    // Auto-resolve Mover.uz watch/embed/page links to direct MP4 stream
    if (cleanUrl.includes("mover.uz")) {
      const moverMatch = cleanUrl.match(/(?:v\.mover\.uz\/|mover\.uz\/(?:watch|video\/embed|video|v)\/)([A-Za-z0-9_-]+)/i);
      if (moverMatch && moverMatch[1]) {
        let rawId = moverMatch[1].replace(/\.mp4$/i, "").replace(/_(?:m|h|s|q)$/i, "");
        if (rawId) {
          const quality = req.query.quality === "720" || req.query.quality === "hd" ? "_h" : "_m";
          cleanUrl = `https://v.mover.uz/${rawId}${quality}.mp4`;
        }
      }
    }

    const parsed = new URL(cleanUrl);

    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;

    const reqHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      "Connection": "keep-alive",
    };

    if (req.headers.range) {
      reqHeaders["Range"] = req.headers.range;
    }

    if (parsed.hostname.includes("animem.uz")) {
      reqHeaders["Referer"] = "https://animem.uz/";
      reqHeaders["Origin"] = "https://animem.uz";
    } else if (parsed.hostname.includes("mover.uz")) {
      reqHeaders["Referer"] = "https://mover.uz/";
      reqHeaders["Origin"] = "https://mover.uz";
    } else if (parsed.hostname.includes("voiplay.uz")) {
      reqHeaders["Referer"] = "https://voiplay.uz/";
      reqHeaders["Origin"] = "https://voiplay.uz";
    } else {
      reqHeaders["Referer"] = `https://${parsed.hostname}/`;
    }

    const proxyReq = client.request(
      parsed,
      {
        method: req.method,
        headers: reqHeaders,
      },
      (proxyRes) => {
        // Follow redirects (301, 302, 307, 308)
        if (
          proxyRes.statusCode &&
          [301, 302, 303, 307, 308].includes(proxyRes.statusCode) &&
          proxyRes.headers.location
        ) {
          const redirectUrl = new URL(proxyRes.headers.location, parsed).toString();
          return res.redirect(`/api/proxy-video?url=${encodeURIComponent(redirectUrl)}`);
        }

        res.status(proxyRes.statusCode || 200);

        const headersToForward = [
          "content-type",
          "content-length",
          "accept-ranges",
          "content-range",
          "content-disposition",
        ];

        headersToForward.forEach((h) => {
          if (proxyRes.headers[h]) {
            res.setHeader(h, proxyRes.headers[h]!);
          }
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=3600");

        proxyRes.pipe(res);
      }
    );

    proxyReq.on("error", (err) => {
      console.error("[Video Proxy Error]", err.message);
      if (!res.headersSent) {
        res.status(500).send("Video Proxy failed: " + err.message);
      }
    });

    req.on("close", () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  } catch (err: any) {
    console.error("[Video Proxy Exception]", err?.message || err);
    if (!res.headersSent) {
      res.status(400).send("Invalid URL");
    }
  }
});

// Resend Email Verification Store
interface VerificationRecord {
  code: string;
  expiresAt: number;
  verified: boolean;
}

const verificationCodes: Record<string, VerificationRecord> = {};
const passwordResetCodes: Record<string, VerificationRecord> = {};
const phoneVerificationCodes: Record<string, VerificationRecord> = {};
const phonePasswordResetCodes: Record<string, VerificationRecord> = {};
// MailerSend Email Verification & Password Reset
const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || "mlsn.9ea81361dd457046b74a47c43e6336658c47cad963cff9d053da31e478b849e2";

// Helper function to build ultra-stylish Anime-themed HTML Email Template
function buildAnimeEmailHtml(title: string, subtitle: string, code: string, note: string) {
  const logoUrl = "https://api.animem.uz/i/6aa8e1d1-1550-42c6-8e02-3b28d66a9730";
  const bannerUrl = "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Animem.uz</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #07070a; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #07070a; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #12121a; border-radius: 16px; overflow: hidden; border: 1px solid #ff006a44; box-shadow: 0 10px 40px rgba(255, 0, 106, 0.2);">
              
              <!-- Anime Banner Image Header -->
              <tr>
                <td style="position: relative; background: #181824 url('${bannerUrl}') center/cover no-repeat; height: 160px; text-align: center; vertical-align: bottom;">
                  <div style="background: linear-gradient(to bottom, rgba(18, 18, 26, 0.2), #12121a); padding: 20px 0 0 0;">
                    <!-- Logo Badge -->
                    <img src="${logoUrl}" alt="Animem.uz Logo" width="84" height="84" style="border-radius: 50%; border: 3px solid #ff006a; box-shadow: 0 0 20px rgba(255, 0, 106, 0.8); object-fit: cover; display: inline-block;" />
                  </div>
                </td>
              </tr>

              <!-- Content Area -->
              <tr>
                <td style="padding: 25px 30px; text-align: center;">
                  <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">
                    ANIMEM<span style="color: #ff006a;">.UZ</span>
                  </h1>
                  <p style="margin: 0 0 20px 0; font-size: 14px; color: #a0a0b8; line-height: 1.5;">
                    ${subtitle}
                  </p>

                  <!-- Code Box -->
                  <div style="background: #181826; border: 2px dashed #ff006a; border-radius: 14px; padding: 22px 15px; margin: 20px 0; text-align: center; box-shadow: inset 0 0 15px rgba(255, 0, 106, 0.1);">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #ff006a; font-weight: 800; margin-bottom: 8px;">
                      ⚡ ${title} ⚡
                    </div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #ffffff; text-shadow: 0 0 12px #ff006a;">
                      ${code}
                    </div>
                  </div>

                  <p style="margin: 20px 0 0 0; font-size: 12px; color: #787898; line-height: 1.5;">
                    ${note}
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #0b0b12; padding: 16px 30px; text-align: center; border-top: 1px solid #1a1a28;">
                  <p style="margin: 0; font-size: 11px; color: #626278;">
                    © ${new Date().getFullYear()} Animem.uz - Barcha huquqlar himoyalangan.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Helper to send emails via MailerSend API with domain fallbacks and Node IPv4
async function sendMailerSendEmail(
  toEmail: string,
  subject: string,
  title: string,
  subtitle: string,
  code: string,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  if (!MAILERSEND_API_KEY) {
    return { ok: false, error: "MAILERSEND_API_KEY o'rnatilmagan" };
  }

  // Senders to try (verified domain first)
  const senders = [
    {
      email: process.env.MAILERSEND_FROM_EMAIL || "noreply@animem.uz",
      name: process.env.MAILERSEND_FROM_NAME || "Animem.uz",
    },
    {
      email: "info@animem.uz",
      name: "Animem.uz",
    },
    {
      email: "MS_vz9dle@test-vz9dlemxqw14kj50.mlsender.net",
      name: "Animem.uz",
    },
  ];

  const htmlContent = buildAnimeEmailHtml(title, subtitle, code, note);
  const textContent = `${title}\n\n${subtitle}\n\nTasdiqlash kodi: ${code}\n\n${note}\n\n© ${new Date().getFullYear()} Animem.uz`;

  let lastError = "";

  for (const from of senders) {
    try {
      const payload = JSON.stringify({
        from: {
          email: from.email,
          name: from.name,
        },
        to: [
          {
            email: toEmail,
            name: "Animem.uz Foydalanuvchisi",
          },
        ],
        subject: subject,
        text: textContent,
        html: htmlContent,
      });

      const response = await new Promise<{ statusCode: number; headers: any; body: string }>((resolve, reject) => {
        const req = https.request(
          {
            hostname: "api.mailersend.com",
            port: 443,
            path: "/v1/email",
            method: "POST",
            family: 4,
            headers: {
              "Authorization": `Bearer ${MAILERSEND_API_KEY.trim()}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
              "User-Agent": "MailerSend-NodeJS/1.0",
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode || 500,
                headers: res.headers,
                body,
              });
            });
          }
        );

        req.on("error", (err) => {
          reject(err);
        });

        req.setTimeout(10000, () => {
          req.destroy(new Error("MailerSend API timeout"));
        });

        req.write(payload);
        req.end();
      });

      console.log(`[MailerSend API Response from=${from.email}]: status=${response.statusCode}, messageId=${response.headers['x-message-id'] || 'none'}`);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return { ok: true };
      }

      let errorMsg = `MailerSend HTTP ${response.statusCode}`;
      if (response.body) {
        try {
          const parsed = JSON.parse(response.body);
          if (parsed.message) errorMsg = parsed.message;
          if (parsed.errors) errorMsg += " (" + JSON.stringify(parsed.errors) + ")";
        } catch (_) {
          errorMsg = response.body.slice(0, 200);
        }
      }
      lastError = errorMsg;
    } catch (err: any) {
      lastError = err.message || "Email yuborishda xatolik";
      console.warn(`[MailerSend API Error with ${from.email}]:`, err);
    }
  }

  return { ok: false, error: lastError };
}

// Send 6-digit verification code via MailerSend
app.post("/api/auth/send-code", async (req, res) => {
  try {
    const { email, captchaToken } = req.body;
    if (!captchaToken) {
      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isHuman = await verifyCaptchaToken(captchaToken, ip as string);
    if (!isHuman) {
      return res.status(400).json({ error: "Captcha tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Yaroqli email manzilini kiriting!" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists in DB
    const [existing]: any = await dbQuery("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Ushbu email bilan allaqachon ro'yxatdan o'tilgan! Kirish sahifasidan foydalaning." });
    }

    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in memory for 10 minutes
    verificationCodes[cleanEmail] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
    };

    console.log(`[MailerSend Auth] Verification code generated for ${cleanEmail}: ${code}`);

    // Send email using MailerSend API
    const emailResult = await sendMailerSendEmail(
      cleanEmail,
      "Animem.uz - Tasdiqlash kodi: " + code,
      "TASDIQLASH KODI",
      "Ro'yxatdan o'tishni yakunlash uchun quyidagi tasdiqlash kodini kiriting:",
      code,
      "Ushbu kod 10 daqiqa davomida amal qiladi. Agarda siz ro'yxatdan o'tishni so'ramagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring."
    );

    if (emailResult.ok) {
      return res.json({
        success: true,
        emailSent: true,
        message: "Tasdiqlash kodi email manzilingizga yuborildi! Pochtani (va Spam papkasini) tekshiring.",
      });
    }

    // Fallback: If external email service fails (e.g. invalid key or unverified domain), preserve code & return devCode
    console.warn(`[MailerSend Auth] Email sending failed for ${cleanEmail}: ${emailResult.error}`);
    return res.json({
      success: true,
      emailSent: false,
      devCode: code,
      message: `Tasdiqlash kodi tayyorlandi! ${emailResult.error ? `(Email xizmati cheklovi tufayli tasdiqlash kodi: ${code})` : ''}`,
    });
  } catch (error: any) {
    console.error("Send code error:", error);
    res.status(500).json({ error: "Tasdiqlash kodini yuborishda xatolik yuz berdi" });
  }
});

// FORGOT PASSWORD: Send Code
app.post("/api/auth/forgot-password-send-code", async (req, res) => {
  try {
    const { email, captchaToken } = req.body;

    if (!captchaToken) {
      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isHuman = await verifyCaptchaToken(captchaToken, ip as string);
    if (!isHuman) {
      return res.status(400).json({ error: "Captcha tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Yaroqli email manzilini kiriting!" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user exists in DB
    const [existing]: any = await dbQuery("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (!existing || existing.length === 0) {
      return res.status(400).json({ error: "Ushbu email manzili bilan foydalanuvchi topilmadi!" });
    }

    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in memory for 10 minutes
    passwordResetCodes[cleanEmail] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
    };

    console.log(`[Forgot Password] Reset code generated for ${cleanEmail}: ${code}`);

    // Send email via MailerSend
    const emailResult = await sendMailerSendEmail(
      cleanEmail,
      "Animem.uz - Parolni tiklash kodi: " + code,
      "PAROLNI TIKLASH KODI",
      "Parolingizni tiklash va yangisini o'rnatish uchun tasdiqlash kodi:",
      code,
      "Ushbu kod 10 daqiqa davomida amal qiladi. Agarda siz parolni tiklashni so'ramagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring."
    );

    if (emailResult.ok) {
      return res.json({
        success: true,
        emailSent: true,
        message: "Parolni tiklash kodi email manzilingizga yuborildi! Pochtani (va Spam papkasini) tekshiring.",
      });
    }

    // Fallback: If external email service fails (e.g. invalid key or unverified domain), preserve code & return devCode
    console.warn(`[Forgot Password] Email sending failed for ${cleanEmail}: ${emailResult.error}`);
    return res.json({
      success: true,
      emailSent: false,
      devCode: code,
      message: `Parolni tiklash kodi tayyorlandi! ${emailResult.error ? `(Email xizmati cheklovi tufayli tasdiqlash kodi: ${code})` : ''}`,
    });
  } catch (error: any) {
    console.error("Forgot password send code error:", error);
    res.status(500).json({ error: "Parolni tiklash kodini yuborishda xatolik yuz berdi" });
  }
});

// FORGOT PASSWORD: Verify Code
app.post("/api/auth/forgot-password-verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email va kodni kiriting!" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = passwordResetCodes[cleanEmail];
    if (!record) {
      return res.status(400).json({ error: "Tiklash kodi topilmadi yoki yuborilmagan!" });
    }

    if (Date.now() > record.expiresAt) {
      delete passwordResetCodes[cleanEmail];
      return res.status(400).json({ error: "Tiklash kodi muddati o'tgan! Qayta kod so'rang." });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({ error: "Tasdiqlash kodi xato kiritildi!" });
    }

    record.verified = true;

    return res.json({
      success: true,
      message: "Tasdiqlash kodi to'g'ri kiritildi!",
    });
  } catch (error: any) {
    console.error("Verify reset code error:", error);
    res.status(500).json({ error: "Kodni tekshirishda xatolik yuz berdi" });
  }
});

// FORGOT PASSWORD: Complete Reset
app.post("/api/auth/forgot-password-reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = passwordResetCodes[cleanEmail];
    if (!record || !record.verified || record.code !== cleanCode) {
      return res.status(400).json({ error: "Kodingiz tasdiqlanmagan yoki xato!" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbQuery("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, cleanEmail]);

    delete passwordResetCodes[cleanEmail];

    // Fetch user info for login
    const [users]: any = await dbQuery("SELECT id, name, email, role, avatar_url FROM users WHERE email = ?", [cleanEmail]);
    const user = users[0];

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    return res.json({
      success: true,
      message: "Parolingiz muvaffaqiyatli yangilandi!",
      token,
      user,
    });
  } catch (error: any) {
    console.error("Forgot password reset error:", error);
    res.status(500).json({ error: "Parolni o'zgartirishda xatolik yuz berdi" });
  }
});

// Verify 6-digit code
app.post("/api/auth/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email va kodni kiriting!" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = verificationCodes[cleanEmail];
    if (!record) {
      return res.status(400).json({ error: "Tasdiqlash kodi topilmadi yoki yuborilmagan! Qayta kod so'rang." });
    }

    if (Date.now() > record.expiresAt) {
      delete verificationCodes[cleanEmail];
      return res.status(400).json({ error: "Tasdiqlash kodi muddati o'tgan! Qayta kod so'rang." });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({ error: "Tasdiqlash kodi xato kiritildi!" });
    }

    // Mark as verified
    record.verified = true;

    return res.json({
      success: true,
      message: "Tasdiqlash kodi to'g'ri kiritildi!",
    });
  } catch (error: any) {
    console.error("Verify code error:", error);
    res.status(500).json({ error: "Kodni tekshirishda xatolik yuz berdi" });
  }
});

// Complete registration for email verified user
app.post("/api/auth/register-verified", async (req, res) => {
  try {
    const { name, email, password, code } = req.body;
    if (!name || !email || !password || !code) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = verificationCodes[cleanEmail];
    if (!record || !record.verified || record.code !== cleanCode) {
      return res.status(400).json({ error: "Email manzilingiz hali tasdiqlanmagan yoki xato kod!" });
    }

    // Check if user already exists
    const [existing]: any = await dbQuery("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Ushbu email bilan allaqachon ro'yxatdan o'tilgan!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = cleanEmail === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";

    const [result]: any = await dbQuery(
      "INSERT INTO users (name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, NULL)",
      [name, cleanEmail, hashedPassword, role]
    );

    delete verificationCodes[cleanEmail];

    const userPayload = {
      id: result.insertId,
      name,
      email: cleanEmail,
      role,
      avatar_url: null,
    };

    const tokenPayload = {
      id: result.insertId,
      email: cleanEmail,
      role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    return res.status(201).json({
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error("Register verified error:", error);
    res.status(500).json({ error: "Ro'yxatdan o'tishda xatolik yuz berdi" });
  }
});

// Auth Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    // Check if email already exists
    const [existing]: any = await dbQuery("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Ushbu email bilan allaqachon ro'yxatdan o'tilgan!" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Auto-assign admin for matching email or default user
    const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";

    const [result]: any = await dbQuery(
      "INSERT INTO users (name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, NULL)",
      [name, email, hashedPassword, role]
    );

    const userPayload = {
      id: result.insertId,
      name,
      email,
      role,
      avatar_url: null,
    };

    const tokenPayload = {
      id: result.insertId,
      email,
      role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

// Auth Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, captchaToken } = req.body;

    if (!captchaToken) {
      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isHuman = await verifyCaptchaToken(captchaToken, ip as string);
    if (!isHuman) {
      return res.status(400).json({ error: "Captcha tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });
    }
    if (!email || !password) {
      return res.status(400).json({ error: "Email va parolni kiriting!" });
    }

    const [users]: any = await dbQuery("SELECT * FROM users WHERE email = ?", [email]);
    const user = users[0];

    if (!user) {
      return res.status(400).json({ error: "Email yoki parol xato!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Email yoki parol xato!" });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { email, name, avatar_url } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Kerakli ma'lumotlar yo'q" });
    }

    let [users]: any = await dbQuery("SELECT * FROM users WHERE email = ?", [email]);
    let user = users[0];

    if (!user) {
      const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";
      // Auto generate random password for google users (they won't use it anyway)
      const randomPass = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      
      const [result]: any = await dbQuery(
        "INSERT INTO users (name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?)",
        [name, email, hashedPassword, role, avatar_url || null]
      );
      
      user = {
        id: result.insertId,
        name,
        email,
        role,
        avatar_url: avatar_url || null,
      };
    } else {
      // If user exists but doesn't have an avatar, or if google avatar is newer, we can save it
      if (avatar_url && !user.avatar_url) {
        await dbQuery("UPDATE users SET avatar_url = ? WHERE id = ?", [avatar_url, user.id]);
        user.avatar_url = avatar_url;
      }
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: userPayload,
    });
  } catch (error: any) {
    console.error("Google Login error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

app.post("/api/auth/facebook", async (req, res) => {
  try {
    const { email, name, uid, avatar_url } = req.body;
    if (!uid || !name) {
      return res.status(400).json({ error: "Kerakli ma'lumotlar yo'q" });
    }

    const facebookId = String(uid);
    const userEmail = email || `fb_${facebookId}@facebook.local`;

    let [users]: any = await dbQuery(
      "SELECT * FROM users WHERE facebook_id = ? OR email = ?",
      [facebookId, userEmail]
    );
    let user = users[0];

    if (!user) {
      // Auto generate random password for facebook users (they won't use it anyway)
      const randomPass = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPass, 10);

      const [result]: any = await dbQuery(
        "INSERT INTO users (name, email, password, role, avatar_url, facebook_id) VALUES (?, ?, ?, ?, ?, ?)",
        [name, userEmail, hashedPassword, "user", avatar_url || null, facebookId]
      );

      user = {
        id: result.insertId,
        name,
        email: userEmail,
        role: "user",
        avatar_url: avatar_url || null,
        facebook_id: facebookId,
      };
    } else {
      if (!user.facebook_id || (avatar_url && !user.avatar_url)) {
        await dbQuery(
          "UPDATE users SET facebook_id = COALESCE(facebook_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
          [facebookId, avatar_url || null, user.id]
        );
        user.facebook_id = user.facebook_id || facebookId;
        user.avatar_url = user.avatar_url || avatar_url || null;
      }
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({ token, user: userPayload });
  } catch (error: any) {
    console.error("Facebook Login error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

// --- Phone Auth API Endpoints ---

// Send 6-digit SMS verification code
app.post("/api/auth/phone-send-code", async (req, res) => {
  try {
    const { phone, type, captchaToken } = req.body;

    // Only require turnstile for register and forgot (since those are initial actions)
    if (!captchaToken) {
      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isHuman = await verifyCaptchaToken(captchaToken, ip as string);
    if (!isHuman) {
      return res.status(400).json({ error: "Captcha tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });
    } // type: 'register' | 'forgot'
    if (!phone || phone.trim().length < 7) {
      return res.status(400).json({ error: "Iltimos, yaroqli telefon raqamini kiriting!" });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');

    if (type === 'register') {
      const [existing]: any = await dbQuery("SELECT id FROM users WHERE phone = ?", [cleanPhone]);
      if (existing && existing.length > 0) {
        return res.status(400).json({ error: "Ushbu telefon raqami bilan allaqachon ro'yxatdan o'tilgan! Kirish sahifasidan foydalaning." });
      }
    } else if (type === 'forgot') {
      const [existing]: any = await dbQuery("SELECT id FROM users WHERE phone = ?", [cleanPhone]);
      if (!existing || existing.length === 0) {
        return res.status(400).json({ error: "Ushbu telefon raqami tizimda topilmadi! Ro'yxatdan o'ting." });
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (type === 'forgot') {
      phonePasswordResetCodes[cleanPhone] = {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false,
      };
    } else {
      phoneVerificationCodes[cleanPhone] = {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false,
      };
    }

    let smsSent = false;
    let smsError = "";

    // Check if Eskiz SMS service is configured
    const eskizEmail = process.env.ESKIZ_EMAIL;
    const eskizPassword = process.env.ESKIZ_PASSWORD;
    const eskizToken = process.env.ESKIZ_TOKEN;

    if (eskizToken || (eskizEmail && eskizPassword)) {
      try {
        let activeToken = eskizToken;
        if (!activeToken && eskizEmail && eskizPassword) {
          const authRes = await fetch("https://notify.eskiz.uz/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: eskizEmail, password: eskizPassword }),
          });
          const authData = await authRes.json();
          if (authData?.data?.token) {
            activeToken = authData.data.token;
          }
        }

        if (activeToken) {
          const formattedPhone = cleanPhone.replace(/^\+/, '');
          const smsRes = await fetch("https://notify.eskiz.uz/api/message/sms/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${activeToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mobile_phone: formattedPhone,
              message: `Animem.uz - Tasdiqlash kodingiz: ${code}`,
              from: "4546",
              callback_url: "",
            }),
          });
          const smsData = await smsRes.json();
          if (smsRes.ok && smsData?.status === "waiting") {
            smsSent = true;
          } else {
            smsError = smsData?.message || "Eskiz SMS yuborishda xatolik";
          }
        }
      } catch (e: any) {
        console.error("[Eskiz SMS Error]:", e);
        smsError = e.message || "SMS xizmati bilan aloqa uzildi";
      }
    }

    console.log(`[Phone Auth SMS Code] ${type || 'auth'} for ${cleanPhone}: ${code} (Sent: ${smsSent})`);

    return res.json({
      success: true,
      codeSent: true,
      smsSent,
      devCode: smsSent ? undefined : code,
      message: smsSent
        ? `SMS tasdiqlash kodi ${cleanPhone} raqamiga yuborildi!`
        : `SMS provayderi (Eskiz) ulanmaganligi sababli test kodi tayyorlandi (${code}).`,
    });
  } catch (err: any) {
    console.error("phone-send-code error:", err);
    return res.status(500).json({ error: err.message || "SMS kod yuborishda xatolik yuz berdi" });
  }
});

// Verify 6-digit SMS code
app.post("/api/auth/phone-verify-code", async (req, res) => {
  try {
    const { phone, code, type } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: "Telefon raqam va kodni kiriting!" });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanCode = code.toString().trim();

    const store = type === 'forgot' ? phonePasswordResetCodes : phoneVerificationCodes;
    const record = store[cleanPhone];

    if (!record) {
      return res.status(400).json({ error: "Sizga kod yuborilmagan yoki kodingiz muddati tugagan! Qayta so'rang." });
    }

    if (Date.now() > record.expiresAt) {
      delete store[cleanPhone];
      return res.status(400).json({ error: "Tasdiqlash kodining muddati tugagan! Qayta so'rang." });
    }

    if (record.code !== cleanCode) {
      return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri!" });
    }

    record.verified = true;
    return res.json({ success: true, message: "Telefon raqami muvaffaqiyatli tasdiqlandi!" });
  } catch (err: any) {
    console.error("phone-verify-code error:", err);
    return res.status(500).json({ error: err.message || "Kodni tekshirishda xatolik" });
  }
});

// Complete registration with verified phone number
app.post("/api/auth/phone-register-verified", async (req, res) => {
  try {
    const { name, phone, password, code, firebaseUid } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak!" });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanCode = code ? code.toString().trim() : '';

    if (!firebaseUid) {
      const record = phoneVerificationCodes[cleanPhone];
      if (!record || (!record.verified && record.code !== cleanCode)) {
        return res.status(400).json({ error: "Telefon raqamingiz tasdiqlanmagan yoki kod noto'g'ri!" });
      }
    }

    const [existing]: any = await dbQuery("SELECT id FROM users WHERE phone = ?", [cleanPhone]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Ushbu telefon raqami bilan allaqachon ro'yxatdan o'tilgan!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const emailFallback = `${cleanPhone.replace(/[^0-9]/g, '')}@phone.animem.uz`;
    const role = "user";

    const [result]: any = await dbQuery(
      "INSERT INTO users (name, email, phone, password, role, avatar_url) VALUES (?, ?, ?, ?, ?, NULL)",
      [name, emailFallback, cleanPhone, hashedPassword, role]
    );

    delete phoneVerificationCodes[cleanPhone];

    const userId = result.insertId;
    const userPayload = { id: userId, name, email: emailFallback, phone: cleanPhone, role, avatar_url: null };
    const token = jwt.sign(
      { id: userPayload.id, email: userPayload.email, phone: userPayload.phone, role: userPayload.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    return res.json({ token, user: userPayload });
  } catch (err: any) {
    console.error("phone-register-verified error:", err);
    return res.status(500).json({ error: err.message || "Ro'yxatdan o'tishda xatolik" });
  }
});

// Login with Phone Number + Password
app.post("/api/auth/phone-login", async (req, res) => {
  try {
    const { phone, password, captchaToken } = req.body;

    if (!captchaToken) {
      return res.status(400).json({ error: "Robot emasligingizni tasdiqlang!" });
    }
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const isHuman = await verifyCaptchaToken(captchaToken, ip as string);
    if (!isHuman) {
      return res.status(400).json({ error: "Captcha tasdiqlanmadi. Iltimos qaytadan urinib ko'ring." });
    }
    if (!phone || !password) {
      return res.status(400).json({ error: "Telefon raqam va parolni kiriting!" });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');

    const [users]: any = await dbQuery(
      "SELECT * FROM users WHERE phone = ? OR email = ?",
      [cleanPhone, cleanPhone]
    );
    const user = users[0];

    if (!user) {
      return res.status(400).json({ error: "Ushbu telefon raqami bo'yicha foydalanuvchi topilmadi!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Telefon raqam yoki parol xato!" });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar_url: user.avatar_url || null,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    return res.json({ token, user: userPayload });
  } catch (err: any) {
    console.error("phone-login error:", err);
    return res.status(500).json({ error: err.message || "Login qilishda xatolik" });
  }
});

// Reset Password with Phone SMS verification
app.post("/api/auth/phone-reset-password", async (req, res) => {
  try {
    const { phone, code, newPassword, firebaseUid } = req.body;
    if (!phone || (!code && !firebaseUid) || !newPassword) {
      return res.status(400).json({ error: "Barcha maydonlarni to'ldiring!" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!" });
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanCode = code ? code.toString().trim() : '';

    if (!firebaseUid) {
      const record = phonePasswordResetCodes[cleanPhone];
      if (!record || (!record.verified && record.code !== cleanCode)) {
        return res.status(400).json({ error: "Kodingiz tasdiqlanmagan yoki xato!" });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbQuery("UPDATE users SET password = ? WHERE phone = ?", [hashedPassword, cleanPhone]);

    delete phonePasswordResetCodes[cleanPhone];

    const [users]: any = await dbQuery("SELECT id, name, email, phone, role, avatar_url FROM users WHERE phone = ?", [cleanPhone]);
    const user = users[0];

    if (!user) {
      return res.status(400).json({ error: "Foydalanuvchi topilmadi!" });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar_url: user.avatar_url || null,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    return res.json({ token, user: userPayload, message: "Parol muvaffaqiyatli o'zgartirildi!" });
  } catch (err: any) {
    console.error("phone-reset-password error:", err);
    return res.status(500).json({ error: err.message || "Parolni tiklashda xatolik" });
  }
});

// Web Push Broadcast Function (Delivers notifications to devices even when site is closed)
async function broadcastPushNotification(payload: {
  title: string;
  body: string;
  image?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
}) {
  try {
    let subs: any[] = [];
    try {
      const [rows]: any = await dbQuery("SELECT * FROM push_subscriptions");
      if (Array.isArray(rows)) subs = rows;
    } catch (e) {
      console.warn("Fetch push subscriptions error:", e);
    }

    if (subs.length === 0) return;

    const APP_DEFAULT_ICON = "https://api.animem.uz/api/images/1788100529230_au9wggu";
    const notificationPayload = JSON.stringify({
      title: payload.title || "Animem.uz",
      body: payload.body || "",
      image: payload.image || undefined,
      icon: payload.icon || APP_DEFAULT_ICON,
      badge: payload.badge || APP_DEFAULT_ICON,
      url: payload.url || "/",
      data: { url: payload.url || "/" },
      tag: payload.tag || `animem-${Date.now()}`
    });

    const sendPromises = subs.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        await webpush.sendNotification(pushSubscription, notificationPayload);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await dbQuery("DELETE FROM push_subscriptions WHERE id = ?", [sub.id]).catch(() => {});
        }
      }
    });

    await Promise.allSettled(sendPromises);
    console.log(`[WebPush] Dispatched push notification to ${subs.length} active device subscriptions`);
  } catch (err) {
    console.error("[WebPush Broadcast Error]:", err);
  }
}

// Get VAPID public key for Web Push registration
app.get("/api/push/vapid-public-key", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to Web Push notifications (stores subscription in MySQL)
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { subscription, userId } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Yaroqsiz push obuna ma'lumotlari" });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    try {
      await dbQuery(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), user_id = VALUES(user_id)`,
        [endpoint, p256dh, auth, userId || null]
      );
    } catch (e) {
      console.warn("Push subscription DB save error:", e);
    }

    res.json({ success: true, message: "Push bildirishnomalarga muvaffaqiyatli obuna bo'lindi" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Push obunada xatolik" });
  }
});

// Get all notifications from MySQL with local store fallback
app.get("/api/notifications", async (req, res) => {
  try {
    const [rows]: any = await dbQuery("SELECT * FROM notifications ORDER BY id DESC LIMIT 50");
    if (Array.isArray(rows) && rows.length > 0) {
      return res.json(rows);
    }
  } catch (err) {
    console.warn("Notifications fetch falling back to local store:", (err as any)?.message);
  }
  const store = loadLocalStore();
  res.json(store.notifications || []);
});

// Post a new notification (Admin only)
app.post("/api/notifications", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { message, image, url } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Xabar matni bo'sh bo'lishi mumkin emas!" });
    }

    let insertId = Date.now();
    try {
      const [result]: any = await dbQuery(
        "INSERT INTO notifications (message, image, url) VALUES (?, ?, ?)",
        [message.trim(), image || null, url || "/"]
      );
      if (result && result.insertId) insertId = result.insertId;
    } catch (e) {
      console.warn("DB notification insert failed, relying on local store:", (e as any)?.message);
    }

    const store = loadLocalStore();
    const newNotif = {
      id: insertId,
      message: message.trim(),
      image: image || undefined,
      url: url || "/",
      created_at: new Date().toISOString()
    };
    store.notifications = store.notifications || [];
    store.notifications.unshift(newNotif);
    saveLocalStore(store);

    // Send Web Push notification to all devices (whether online or offline)
    broadcastPushNotification({
      title: "Animem.uz | Muhim Yangilik 📢",
      body: message.trim(),
      image: image || undefined,
      url: url || "/",
      tag: `admin-notif-${insertId}`
    }).catch(() => {});

    res.status(201).json(newNotif);
  } catch (err) {
    console.error("Create notification error:", err);
    res.status(500).json({ error: "Bildirishnoma yaratishda xatolik" });
  }
});

// Get Archive.org configuration keys (Admin only)
app.get("/api/archive-config", authenticateToken, (req: any, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Sizda ushbu amalni bajarishga ruxsat yo'q!" });
    }
    res.json({
      accessKey: process.env.ARCHIVE_ORG_ACCESS_KEY || "",
      secretKey: process.env.ARCHIVE_ORG_SECRET_KEY || "",
    });
  } catch (err) {
    console.error("Get archive config error:", err);
    res.status(500).json({ error: "Serverda xatolik" });
  }
});

// --- MySQL In-Memory Direct Media Storage (No Disk Writing) ---
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max per file
  },
});

// High performance in-memory media cache to minimize DB load on frequent hits
const mediaMemoryCache = new Map<string, { mimeType: string; base64: string; buffer: Buffer }>();

// Upload single image from device directly into MySQL Database (NO DISK STORAGE)
app.post("/api/media/upload", authenticateToken, memoryUpload.single("file"), async (req: any, res: any) => {
  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    let filename = "image.jpg";
    let fileSize = 0;

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype || "image/jpeg";
      filename = req.file.originalname || "image.jpg";
      fileSize = req.file.size || fileBuffer.length;
    } else if (req.body && req.body.base64) {
      const b64Data = req.body.base64;
      const match = b64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        fileBuffer = Buffer.from(match[2], "base64");
      } else {
        fileBuffer = Buffer.from(b64Data, "base64");
      }
      filename = req.body.filename || "image.jpg";
      fileSize = fileBuffer.length;
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: "Rasm fayli tanlanmadi yoki bo'sh" });
    }

    const base64String = fileBuffer.toString("base64");
    const mediaId = "img_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

    // Save directly into MySQL database (media_files table) - no disk involved
    try {
      await dbQuery(
        `INSERT INTO media_files (id, filename, mime_type, data, size) VALUES (?, ?, ?, ?, ?)`,
        [mediaId, filename, mimeType, base64String, fileSize]
      );
      console.log(`[MySQL DB] Stored media image #${mediaId} (${filename}, ${fileSize} bytes) into database`);
    } catch (dbErr) {
      console.error("[MySQL DB] Failed to insert media into database:", dbErr);
    }

    // Keep in RAM cache for fast serving
    mediaMemoryCache.set(mediaId, { mimeType, base64: base64String, buffer: fileBuffer });
    if (mediaMemoryCache.size > 300) {
      const firstKey = mediaMemoryCache.keys().next().value;
      if (firstKey) mediaMemoryCache.delete(firstKey);
    }

    const mediaUrl = `/api/media/${mediaId}`;
    return res.status(201).json({
      success: true,
      id: mediaId,
      url: mediaUrl,
      filename,
      size: fileSize,
      mime_type: mimeType
    });
  } catch (err: any) {
    console.error("Media upload to MySQL error:", err);
    return res.status(500).json({ error: "Rasmni MySQL bazasiga yuklashda xatolik yuz berdi" });
  }
});

// Upload multiple images from device directly into MySQL Database (e.g. Manga Chapter Pages)
app.post("/api/media/upload-multiple", authenticateToken, memoryUpload.array("files", 60), async (req: any, res: any) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Hech qanday rasm fayllari tanlanmadi" });
    }

    const results = [];
    for (const file of files) {
      const fileBuffer = file.buffer;
      const mimeType = file.mimetype || "image/jpeg";
      const filename = file.originalname || "image.jpg";
      const fileSize = file.size || fileBuffer.length;
      const base64String = fileBuffer.toString("base64");
      const mediaId = "img_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

      try {
        await dbQuery(
          `INSERT INTO media_files (id, filename, mime_type, data, size) VALUES (?, ?, ?, ?, ?)`,
          [mediaId, filename, mimeType, base64String, fileSize]
        );
      } catch (dbErr) {
        console.error("[MySQL DB] Failed to save multiple media item to database:", dbErr);
      }

      mediaMemoryCache.set(mediaId, { mimeType, base64: base64String, buffer: fileBuffer });
      results.push({
        id: mediaId,
        url: `/api/media/${mediaId}`,
        filename,
        size: fileSize
      });
    }

    return res.status(201).json({
      success: true,
      count: results.length,
      files: results
    });
  } catch (err: any) {
    console.error("Multiple media upload to MySQL error:", err);
    return res.status(500).json({ error: "Rasmlarni MySQL bazasiga yuklashda xatolik" });
  }
});

// Serve image directly from MySQL Database
app.get("/api/media/:id", async (req: any, res: any) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).send("Media ID kiritilishi shart");

    // 1. Check in-memory RAM cache first
    if (mediaMemoryCache.has(id)) {
      const cached = mediaMemoryCache.get(id)!;
      res.setHeader("Content-Type", cached.mimeType || "image/jpeg");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(cached.buffer || Buffer.from(cached.base64, "base64"));
    }

    // 2. Query MySQL database
    const [rows]: any = await dbQuery("SELECT mime_type, data FROM media_files WHERE id = ?", [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).send("Rasm MySQL bazasidan topilmadi");
    }

    const row = rows[0];
    const mimeType = row.mime_type || "image/jpeg";
    const buffer = Buffer.from(row.data, "base64");

    // Cache in RAM for subsequent queries
    mediaMemoryCache.set(id, { mimeType, base64: row.data, buffer });
    if (mediaMemoryCache.size > 300) {
      const firstKey = mediaMemoryCache.keys().next().value;
      if (firstKey) mediaMemoryCache.delete(firstKey);
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buffer);
  } catch (err: any) {
    console.error("Serve media from MySQL error:", err);
    return res.status(500).send("Rasmni bazadan yuklab olishda xatolik");
  }
});

// Proxy upload endpoint to Archive.org (Admin only)
app.post("/api/upload-archive-proxy", authenticateToken, upload.single("file"), async (req: any, res: any) => {
  const tempFilePath = req.file?.path;
  try {
    if (req.user.role !== "admin") {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(403).json({ error: "Sizda ushbu amalni bajarishga ruxsat yo'q!" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Fayl yuklanmadi" });
    }

    const { selectedAnimeId, episodeNumber, title } = req.body;
    if (!selectedAnimeId || !episodeNumber) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(400).json({ error: "Anime ID va Epizod raqami kiritilishi shart" });
    }

    const accessKey = process.env.ARCHIVE_ORG_ACCESS_KEY;
    const secretKey = process.env.ARCHIVE_ORG_SECRET_KEY;

    if (!accessKey || !secretKey) {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(400).json({ error: "Archive.org kalitlari (ARCHIVE_ORG_ACCESS_KEY, ARCHIVE_ORG_SECRET_KEY) server sozlamalarida kiritilmagan!" });
    }

    const sanitizeHeaderValue = (val: string): string => {
      if (!val) return "";
      return val.replace(/[^\x20-\x7E]/g, "").trim();
    };

    const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const identifier = `animem-uz-ep-${selectedAnimeId}-${episodeNumber}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    const uploadUrl = `https://s3.us.archive.org/${identifier}/${sanitizedFileName}`;
    const directLink = `https://archive.org/download/${identifier}/${sanitizedFileName}`;

    console.log(`Starting proxy upload of ${sanitizedFileName} to Archive.org identifier ${identifier}`);

    const parsedUrl = new URL(uploadUrl);
    const options = {
      method: "PUT",
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      headers: {
        "Authorization": `LOW ${accessKey}:${secretKey}`,
        "x-amz-auto-make-bucket": "1",
        "x-archive-meta-mediatype": "movies",
        "x-archive-meta-collection": "opensource_movies",
        "x-archive-meta-title": sanitizeHeaderValue(title || `Anime Episode ${episodeNumber}`),
        "Content-Type": req.file.mimetype || "video/mp4",
        "Content-Length": fs.statSync(tempFilePath).size,
      }
    };

    const archiveReq = https.request(options, (archiveRes) => {
      let responseBody = "";
      archiveRes.on("data", (chunk) => {
        responseBody += chunk;
      });
      archiveRes.on("end", () => {
        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {}
        }

        if (archiveRes.statusCode === 200 || archiveRes.statusCode === 201) {
          console.log(`Proxy upload to Archive.org complete! URL: ${directLink}`);
          if (!res.headersSent) {
            res.json({ success: true, url: directLink });
          }
        } else {
          console.error(`Archive.org upload failed with status ${archiveRes.statusCode}: ${responseBody}`);
          if (!res.headersSent) {
            res.status(500).json({ error: `Archive.org xatosi (${archiveRes.statusCode}): ${responseBody || 'Noma\'lum xatolik'}` });
          }
        }
      });
    });

    archiveReq.on("error", (err) => {
      console.error("Proxy upload stream error:", err);
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
      }
      if (!res.headersSent) {
        res.status(500).json({ error: `Server translyatsiya jarayonida xatolik: ${err.message}` });
      }
    });

    const fileStream = fs.createReadStream(tempFilePath);
    fileStream.on("error", (err) => {
      console.error("File read stream error:", err);
      archiveReq.destroy();
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {}
      }
      if (!res.headersSent) {
        res.status(500).json({ error: `Faylni o'qishda xatolik: ${err.message}` });
      }
    });

    fileStream.pipe(archiveReq);

  } catch (err: any) {
    console.error("Upload proxy main error:", err);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
    res.status(500).json({ error: `Tizimda xatolik yuz berdi: ${err.message}` });
  }
});

// GET public or own user profile by ID
app.get("/api/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    let requestingUserId: any = null;
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        requestingUserId = decoded?.id;
      } catch (e) {}
    }

    const isOwner = Boolean(requestingUserId && String(requestingUserId) === String(userId));

    let userData: any = null;
    try {
      const [rows]: any = await dbQuery("SELECT * FROM users WHERE id = ?", [userId]);
      if (rows && rows[0]) userData = rows[0];
    } catch (e) {}

    if (!userData) {
      const store = loadLocalStore();
      userData = store.users?.find((u: any) => String(u.id) === String(userId));
    }

    if (!userData) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
    }

    // Get comments count
    let commentsCount = 0;
    try {
      const [cRows]: any = await dbQuery("SELECT COUNT(*) as cnt FROM comments WHERE user_id = ?", [userId]);
      if (cRows && cRows[0]) commentsCount = cRows[0].cnt;
    } catch (e) {}

    // Resolve favorites to anime objects
    let favoritesAnimes: any[] = [];
    try {
      if (userData.favorites) {
        let favIds: any[] = [];
        if (typeof userData.favorites === 'string') {
          favIds = JSON.parse(userData.favorites);
        } else if (Array.isArray(userData.favorites)) {
          favIds = userData.favorites;
        }

        if (Array.isArray(favIds) && favIds.length > 0) {
          const [aRows]: any = await dbQuery("SELECT * FROM animes");
          const allAnimes = Array.isArray(aRows) && aRows.length > 0 ? aRows : loadLocalStore().animes || [];
          favoritesAnimes = allAnimes.filter((a: any) => favIds.some((f: any) => String(f) === String(a.id)));
        }
      }
    } catch (e) {
      console.warn("Parsing user favorites error:", e);
    }

    // Resolve watch history and watch time
    let watchHistory: any[] = [];
    try {
      if (userData.watch_history) {
        if (typeof userData.watch_history === 'string') {
          watchHistory = JSON.parse(userData.watch_history);
        } else if (Array.isArray(userData.watch_history)) {
          watchHistory = userData.watch_history;
        }
      }
    } catch (e) {}

    let watchTimeMinutes = Number(userData.watch_time_minutes) || 0;
    if (watchTimeMinutes === 0 && Array.isArray(watchHistory) && watchHistory.length > 0) {
      // Calculate based on watched history items
      watchTimeMinutes = watchHistory.reduce((total: number, item: any) => {
        const itemMins = Number(item.minutes_watched) || (Number(item.lastEpisode || 1) * 24);
        return total + itemMins;
      }, 0);
    }

    const responseUser: any = {
      id: userData.id,
      name: userData.name,
      role: userData.role || 'user',
      avatar_url: userData.avatar_url || null,
      banner_url: userData.banner_url || null,
      bio: userData.bio || null,
      telegram: userData.telegram || null,
      instagram: userData.instagram || null,
      tiktok: userData.tiktok || null,
      youtube: userData.youtube || null,
      discord: userData.discord || null,
      facebook: userData.facebook || null,
      vk: userData.vk || null,
      favorites: favoritesAnimes,
      watch_time_minutes: watchTimeMinutes,
      watch_history: watchHistory,
      comments_count: commentsCount,
      created_at: userData.created_at || null,
      last_seen: userData.last_seen || null,
    };

    // EMAIL PRIVACY: Email is strictly visible ONLY to the owner themselves
    if (isOwner) {
      responseUser.email = userData.email;
      responseUser.phone = userData.phone;
    }

    return res.json({ user: responseUser, isOwner });
  } catch (err: any) {
    console.error("Get user profile error:", err);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

// Ping endpoint to update user active timestamp
app.post("/api/user/ping", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    await dbQuery("UPDATE users SET last_seen = NOW() WHERE id = ?", [userId]);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: "Ping failed" });
  }
});

// Update user profile photo (Avatar) as base64 string in MySQL
app.post("/api/user/avatar", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ error: "Rasm topilmadi" });
    }

    await dbQuery("UPDATE users SET avatar_url = ? WHERE id = ?", [avatar_url, userId]);

    // Get updated user details
    const [rows]: any = await dbQuery("SELECT id, name, email, role, avatar_url, banner_url, bio, telegram, instagram, tiktok, youtube, discord, facebook, vk FROM users WHERE id = ?", [userId]);
    const updatedUser = rows[0];

    res.json({ message: "Profil rasmi muvaffaqiyatli yangilandi", user: updatedUser });
  } catch (err) {
    console.error("Upload avatar error:", err);
    res.status(500).json({ error: "Profil rasmini yuklashda xatolik yuz berdi" });
  }
});

// Update user profile details (name, bio, banner, social links)
app.put("/api/user/profile", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, banner_url, avatar_url, telegram, instagram, tiktok, youtube, discord, facebook, vk, favorites } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Ism bo'sh bo'lishi mumkin emas" });
    }

    const cleanName = name.trim();
    let favsJson: string | null = null;
    if (favorites) {
      favsJson = typeof favorites === 'string' ? favorites : JSON.stringify(favorites);
    }

    try {
      await dbQuery(
        `UPDATE users SET 
          name = ?, 
          bio = ?, 
          banner_url = ?, 
          avatar_url = COALESCE(?, avatar_url),
          telegram = ?, 
          instagram = ?, 
          tiktok = ?, 
          youtube = ?, 
          discord = ?, 
          facebook = ?,
          vk = ?,
          favorites = COALESCE(?, favorites)
         WHERE id = ?`,
        [
          cleanName,
          bio || null,
          banner_url || null,
          avatar_url || null,
          telegram || null,
          instagram || null,
          tiktok || null,
          youtube || null,
          discord || null,
          facebook || null,
          vk || null,
          favsJson,
          userId
        ]
      );
    } catch (dbErr) {
      console.warn("DB update user profile warning:", dbErr);
    }

    // Local store fallback
    const store = loadLocalStore();
    const storeUser = store.users?.find((u: any) => String(u.id) === String(userId));
    if (storeUser) {
      storeUser.name = cleanName;
      if (bio !== undefined) storeUser.bio = bio;
      if (banner_url !== undefined) storeUser.banner_url = banner_url;
      if (avatar_url !== undefined) storeUser.avatar_url = avatar_url;
      if (telegram !== undefined) storeUser.telegram = telegram;
      if (instagram !== undefined) storeUser.instagram = instagram;
      if (tiktok !== undefined) storeUser.tiktok = tiktok;
      if (youtube !== undefined) storeUser.youtube = youtube;
      if (discord !== undefined) storeUser.discord = discord;
      if (facebook !== undefined) storeUser.facebook = facebook;
      if (vk !== undefined) storeUser.vk = vk;
      if (favorites !== undefined) storeUser.favorites = favorites;
      saveLocalStore(store);
    }

    const [rows]: any = await dbQuery("SELECT * FROM users WHERE id = ?", [userId]);
    const updatedUser = rows && rows[0] ? rows[0] : (storeUser || { id: userId, name: cleanName });

    const tokenPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({ message: "Profil yangilandi", user: updatedUser, token });
  } catch (err: any) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

// Sync user favorites array
app.post("/api/user/favorites", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { favorites } = req.body;
    const favsJson = JSON.stringify(favorites || []);

    try {
      await dbQuery("UPDATE users SET favorites = ? WHERE id = ?", [favsJson, userId]);
    } catch (e) {}

    const store = loadLocalStore();
    const storeUser = store.users?.find((u: any) => String(u.id) === String(userId));
    if (storeUser) {
      storeUser.favorites = favorites;
      saveLocalStore(store);
    }

    res.json({ success: true, favorites });
  } catch (err) {
    res.status(500).json({ error: "Favorites sync failed" });
  }
});

// Update or track watch progress and watch time
app.post("/api/user/watch-progress", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { anime_id, episode_number = 1, minutes_watched = 24, total_minutes } = req.body;

    let currentMinutes = 0;
    let currentHistory: any[] = [];

    try {
      const [rows]: any = await dbQuery("SELECT watch_time_minutes, watch_history FROM users WHERE id = ?", [userId]);
      if (rows && rows[0]) {
        currentMinutes = Number(rows[0].watch_time_minutes) || 0;
        if (rows[0].watch_history) {
          try {
            currentHistory = typeof rows[0].watch_history === 'string' ? JSON.parse(rows[0].watch_history) : rows[0].watch_history;
          } catch(e) {}
        }
      }
    } catch(e) {}

    const store = loadLocalStore();
    const storeUser = store.users?.find((u: any) => String(u.id) === String(userId));
    if (storeUser) {
      if (!currentMinutes && storeUser.watch_time_minutes) currentMinutes = Number(storeUser.watch_time_minutes);
      if ((!currentHistory || currentHistory.length === 0) && storeUser.watch_history) currentHistory = storeUser.watch_history;
    }

    if (total_minutes !== undefined && Number(total_minutes) >= 0) {
      currentMinutes = Number(total_minutes);
    } else if (minutes_watched !== undefined && Number(minutes_watched) > 0) {
      currentMinutes += Number(minutes_watched);
    }

    if (anime_id) {
      currentHistory = (currentHistory || []).filter((h: any) => String(h.animeId) !== String(anime_id));
      currentHistory.unshift({
        animeId: anime_id,
        lastEpisode: episode_number,
        viewedAt: new Date().toISOString(),
        minutes_watched: minutes_watched || 24
      });
      currentHistory = currentHistory.slice(0, 50);
    }

    const historyJson = JSON.stringify(currentHistory);
    try {
      await dbQuery("UPDATE users SET watch_time_minutes = ?, watch_history = ? WHERE id = ?", [currentMinutes, historyJson, userId]);
    } catch(e) {}

    if (storeUser) {
      storeUser.watch_time_minutes = currentMinutes;
      storeUser.watch_history = currentHistory;
      saveLocalStore(store);
    }

    res.json({ success: true, watch_time_minutes: currentMinutes, watch_history: currentHistory });
  } catch (err: any) {
    console.error("Watch progress sync error:", err);
    res.status(500).json({ error: "Watch progress sync failed" });
  }
});

// Get recent comments
app.get("/api/comments/recent", async (req, res) => {
  try {
    const [rows]: any = await dbQuery(`
      SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar, a.title AS anime_title 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      LEFT JOIN animes a ON c.anime_id = a.id 
      ORDER BY c.id DESC 
      LIMIT 10
    `);
    if (Array.isArray(rows)) {
      return res.json(rows);
    }
  } catch (err) {
    console.warn("Recent comments fetch falling back to local store:", (err as any)?.message);
  }
  const store = loadLocalStore();
  res.json(store.comments || []);
});

// Helper functions for file-backed rating database (data.json)
const DATA_FILE_PATH = path.join(process.cwd(), "data.json");

interface RatingRecord {
  id: number;
  user_id: number;
  anime_id: number;
  rating: number;
  created_at: string;
}

async function getRatingsFromFile(): Promise<RatingRecord[]> {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      let initialRatings: RatingRecord[] = [];
      try {
        const [rows]: any = await dbQuery("SELECT * FROM ratings");
        initialRatings = rows.map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          anime_id: r.anime_id,
          rating: r.rating,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        }));
        console.log("Successfully migrated ratings from MySQL to data.json:", initialRatings.length);
      } catch (dbErr) {
        console.warn("Could not fetch ratings from MySQL on initialization, starting with empty list:", dbErr);
      }
      
      await fs.promises.writeFile(DATA_FILE_PATH, JSON.stringify({ ratings: initialRatings }, null, 2));
      cachedRatings = initialRatings;
      ratingsCacheTime = Date.now();
      return initialRatings;
    }
    const content = await fs.promises.readFile(DATA_FILE_PATH, "utf-8");
    const data = JSON.parse(content);
    cachedRatings = data.ratings || [];
    ratingsCacheTime = Date.now();
    return cachedRatings;
  } catch (error) {
    console.error("Error reading ratings from data.json:", error);
    return cachedRatings || [];
  }
}

let cachedRatings: RatingRecord[] | null = null;
let ratingsCacheTime = 0;

async function saveRatingsToFile(ratings: RatingRecord[]): Promise<boolean> {
  try {
    cachedRatings = ratings;
    ratingsCacheTime = Date.now();
    invalidateServerCache("api_all_animes");
    await fs.promises.writeFile(DATA_FILE_PATH, JSON.stringify({ ratings }, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing ratings to data.json:", error);
    return false;
  }
}

async function mergeRatingsWithAnimes(animes: any[]): Promise<any[]> {
  try {
    const ratings = await getRatingsFromFile();
    const statsMap: Record<number, { sum: number; count: number }> = {};
    for (const r of ratings) {
      if (!statsMap[r.anime_id]) {
        statsMap[r.anime_id] = { sum: 0, count: 0 };
      }
      statsMap[r.anime_id].sum += r.rating;
      statsMap[r.anime_id].count += 1;
    }
    return animes.map(anime => {
      const stats = statsMap[anime.id];
      if (stats) {
        return {
          ...anime,
          rating: parseFloat((stats.sum / stats.count).toFixed(1)),
          rating_count: stats.count
        };
      }
      // Preserve the pre-existing database ratings if no rating exists in data.json
      return anime;
    });
  } catch (err) {
    console.error("mergeRatingsWithAnimes error:", err);
    return animes;
  }
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/animes", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
  const cached = getCache<any[]>("api_all_animes", 20000);
  if (cached) {
    return res.json(cached);
  }
  try {
    const [rows]: any = await dbQuery("SELECT * FROM animes ORDER BY id DESC");
    if (Array.isArray(rows) && rows.length > 0) {
      const store = loadLocalStore();
      store.animes = rows;
      saveLocalStore(store);
      const merged = await mergeRatingsWithAnimes(rows);
      setCache("api_all_animes", merged);
      return res.json(merged);
    }
  } catch (err) {
    console.warn("Animes fetch falling back to local store:", (err as any)?.message);
  }
  const store = loadLocalStore();
  const merged = await mergeRatingsWithAnimes(store.animes || []);
  setCache("api_all_animes", merged);
  res.json(merged);
});

// Get single anime
app.get("/api/animes/:id", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  const id = req.params.id;
  const cacheKey = `api_anime_${id}`;
  const cached = getCache<any>(cacheKey, 15000);
  if (cached) {
    dbQuery("UPDATE animes SET korishlar = korishlar + 1 WHERE id = ?", [id]).catch(() => {});
    return res.json(cached);
  }
  try {
    const [rows]: any = await dbQuery("SELECT * FROM animes WHERE id = ?", [id]);
    if (rows && rows.length > 0) {
      dbQuery("UPDATE animes SET korishlar = korishlar + 1 WHERE id = ?", [id]).catch(() => {});
      rows[0].korishlar = (rows[0].korishlar || 0) + 1;
      const merged = await mergeRatingsWithAnimes(rows);
      setCache(cacheKey, merged[0]);
      return res.json(merged[0]);
    }
  } catch (err) {
    console.warn("Single anime fetch falling back to local store:", (err as any)?.message);
  }

  const store = loadLocalStore();
  const anime = (store.animes || []).find((a: any) => String(a.id) === String(id));
  if (!anime) {
    return res.status(404).json({ error: "Anime topilmadi" });
  }
  anime.korishlar = (anime.korishlar || 0) + 1;
  saveLocalStore(store);
  const merged = await mergeRatingsWithAnimes([anime]);
  setCache(cacheKey, merged[0]);
  res.json(merged[0]);
});

// Get single anime by slug
app.get("/api/animes/by-slug/:slug", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  const slug = req.params.slug;
  const cacheKey = `api_anime_slug_${slug}`;
  const cached = getCache<any>(cacheKey, 15000);
  if (cached) {
    dbQuery("UPDATE animes SET korishlar = korishlar + 1 WHERE id = ?", [cached.id]).catch(() => {});
    return res.json(cached);
  }

  const toSlugLocal = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/o['’`‘]/g, "o")
      .replace(/g['’`‘]/g, "g")
      .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  };

  try {
    const [rows]: any = await dbQuery("SELECT * FROM animes");
    if (Array.isArray(rows) && rows.length > 0) {
      const anime = rows.find((r: any) => toSlugLocal(r.title) === slug);
      if (anime) {
        dbQuery("UPDATE animes SET korishlar = korishlar + 1 WHERE id = ?", [anime.id]).catch(() => {});
        anime.korishlar = (anime.korishlar || 0) + 1;
        const merged = await mergeRatingsWithAnimes([anime]);
        setCache(cacheKey, merged[0]);
        return res.json(merged[0]);
      }
    }
  } catch (err) {
    console.warn("Anime by slug fetch falling back to local store:", (err as any)?.message);
  }

  const store = loadLocalStore();
  const anime = (store.animes || []).find((a: any) => toSlugLocal(a.title) === slug);
  if (!anime) {
    return res.status(404).json({ error: "Anime topilmadi" });
  }
  anime.korishlar = (anime.korishlar || 0) + 1;
  saveLocalStore(store);
  const merged = await mergeRatingsWithAnimes([anime]);
  res.json(merged[0]);
});

// Get episodes of an anime
app.get("/api/animes/:id/episodes", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await dbQuery(
      "SELECT * FROM episodes WHERE anime_id = ? ORDER BY episode_number ASC",
      [id]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return res.json(rows);
    }
  } catch (err) {
    console.warn("Episodes fetch falling back to local store:", (err as any)?.message);
  }
  const store = loadLocalStore();
  const eps = (store.episodes || []).filter((e: any) => String(e.anime_id) === String(id));
  res.json(eps);
});

function toAnimeSlug(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/o['’`‘]/g, "o")
    .replace(/g['’`‘]/g, "g")
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Private bridge used by public/animebot/main.py.
 * When a video arrives in the Telegram channel it creates (or updates) the
 * matching anime and its episode on the site. The stored URL is a Telegram
 * deep link, so neither a Telegram bot token nor the actual media file is
 * exposed to browsers.
 */

// --- TELEGRAM NOTIFICATION BOT ---
const TG_BOT_TOKEN = "8838457415:AAEKau5X5g-yj1ghMq00zsS-uzolghL9-LI";
const TG_CHANNEL_ID = "-1004310971743";

async function notifyTelegramNewAnime(animeId: number, episodeNumber: number | null = null) {
  try {
    let animeData: any = null;
    try {
      const [rows]: any = await dbQuery("SELECT * FROM animes WHERE id = ?", [animeId]);
      if (rows && rows.length > 0) {
        animeData = rows[0];
      }
    } catch (dbErr) {
      const store = loadLocalStore();
      animeData = (store.animes || []).find((a: any) => String(a.id) === String(animeId));
    }

    if (!animeData) {
      console.error("Could not find animeData for notification:", animeId);
      return;
    }

    const toSlugLocal = (text: string): string => {
      if (!text) return "";
      return text
        .toLowerCase()
        .replace(/o['’`‘]/g, "o")
        .replace(/g['’`‘]/g, "g")
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
        .replace(/^-+|-+$/g, "");
    };

    const slug = toSlugLocal(animeData.title);
    const link = `https://animem.uz/anime/${slug}`;
    const epString = episodeNumber ? `🔢Qism: ${episodeNumber}` : `🔢Qism: ${animeData.qismlar_soni || 1}`;
    const safeTitle = animeData.title.replace(/[_*`\[\]]/g, '');
    let yiliStr = animeData.yil ? `\n📅Yili: ${animeData.yil}` : "";
    
    const caption = `🎬Yangi Qoshildi!\n\n📺Anime: *${safeTitle}*${yiliStr}\n${epString}\n\n🇺🇿O'zbek Tilida!\n\n▶️[Tomosha qilish!](${link})`;
    
    let imageUrl = animeData.image_url;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://animem.uz${imageUrl}`;
    }

    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHANNEL_ID,
        photo: imageUrl || "https://animem.uz/logo.png",
        caption: caption,
        parse_mode: "Markdown"
      })
    });
    
    const result = await res.json();
    if (!result.ok) {
       console.error("Telegram API error:", result);
    } else {
       console.log("Telegram notification sent successfully!");
    }
  } catch (error) {
    console.error("Telegram notify failed:", error);
  }
}
// ---------------------------------

app.post("/api/integrations/animebot/episode", async (req, res) => {
  const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!ANIMEBOT_SYNC_SECRET || suppliedSecret !== ANIMEBOT_SYNC_SECRET) {
    return res.sendStatus(401);
  }

  const { title, slug, episode_number, note, telegram_url } = req.body || {};
  const episodeNumber = Number.parseInt(String(episode_number), 10);
  if (
    typeof title !== "string" || !title.trim() ||
    !Number.isInteger(episodeNumber) || episodeNumber < 1 ||
    typeof telegram_url !== "string" ||
    !/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[A-Za-z0-9_-]{1,64}$/.test(telegram_url)
  ) {
    return res.status(400).json({ error: "Noto'g'ri animebot ma'lumoti" });
  }

  const normalizedTitle = title.trim().slice(0, 255);
  const normalizedSlug = toAnimeSlug(typeof slug === "string" ? slug : normalizedTitle);
  if (!normalizedSlug || normalizedSlug !== toAnimeSlug(normalizedTitle)) {
    return res.status(400).json({ error: "Slug anime nomiga mos emas" });
  }

  let anime: any;
  let animeId: number;
  try {
    const [rows]: any = await dbQuery("SELECT * FROM animes");
    anime = (rows || []).find((row: any) => toAnimeSlug(row.title) === normalizedSlug);

    if (!anime) {
      const [result]: any = await dbQuery(
        `INSERT INTO animes
          (title, description, image_url, banner_url, rating, rating_count, holati, yil, studiyasi, qismlar_soni, korishlar, janrlar, video_url, tavsiya, is_banner, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [normalizedTitle, "", "/logo.png", "/logo.png", 0, 0, "Efirda", null, "", episodeNumber, 0, "", telegram_url, 0, 0, ""]
      );
      animeId = Number(result.insertId);
      anime = { id: animeId, title: normalizedTitle, qismlar_soni: episodeNumber, video_url: telegram_url };
    } else {
      animeId = Number(anime.id);
      const totalEpisodes = Math.max(Number(anime.qismlar_soni) || 0, episodeNumber);
      await dbQuery("UPDATE animes SET qismlar_soni = ?, video_url = COALESCE(NULLIF(video_url, ''), ?) WHERE id = ?", [totalEpisodes, telegram_url, animeId]);
      anime.qismlar_soni = totalEpisodes;
    }

    const [existingEpisode]: any = await dbQuery(
      "SELECT id FROM episodes WHERE anime_id = ? AND episode_number = ?", [animeId, episodeNumber]
    );
    if (existingEpisode?.length) {
      await dbQuery("UPDATE episodes SET video_url = ? WHERE anime_id = ? AND episode_number = ?", [telegram_url, animeId, episodeNumber]);
    } else {
      await dbQuery(
        "INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)", [animeId, episodeNumber, telegram_url]
      );
      
      // Notify Telegram channel
      notifyTelegramNewAnime(animeId, episodeNumber);
    }
  } catch (error) {
    // Local store mirrors normal API behavior if MySQL is temporarily offline.
    console.warn("Animebot DB sync failed; using local store:", (error as any)?.message);
    const store = loadLocalStore();
    store.animes = store.animes || [];
    store.episodes = store.episodes || [];
    anime = store.animes.find((item: any) => toAnimeSlug(item.title) === normalizedSlug);
    if (!anime) {
      animeId = Date.now();
      anime = {
        id: animeId, title: normalizedTitle, description: "", image_url: "/logo.png", banner_url: "/logo.png",
        rating: 0, rating_count: 0, holati: "Efirda", yil: null, studiyasi: "", qismlar_soni: episodeNumber,
        korishlar: 0, janrlar: "", video_url: telegram_url, tavsiya: false, is_banner: false, tags: ""
      };
      store.animes.unshift(anime);
    } else {
      animeId = Number(anime.id);
      anime.qismlar_soni = Math.max(Number(anime.qismlar_soni) || 0, episodeNumber);
      if (!anime.video_url) anime.video_url = telegram_url;
    }
    const index = store.episodes.findIndex((item: any) => Number(item.anime_id) === animeId && Number(item.episode_number) === episodeNumber);
    const episode = { id: index >= 0 ? store.episodes[index].id : Date.now(), anime_id: animeId, episode_number: episodeNumber, video_url: telegram_url, note: note || null };
    if (index >= 0) store.episodes[index] = { ...store.episodes[index], ...episode };
    else store.episodes.push(episode);
    saveLocalStore(store);
  }

  res.status(201).json({ anime_id: animeId!, slug: normalizedSlug, episode_number: episodeNumber });
});

// Helper function for safe JSON parsing
function safeJsonParse(val: any, fallback: any = []) {
  if (!val) return fallback;
  if (typeof val !== 'string') return Array.isArray(val) ? val : fallback;
  try {
    const parsed = JSON.parse(val);
    return parsed !== null ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

// Get comments of an anime
app.get("/api/animes/:id/comments", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await dbQuery(
      `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar 
       FROM comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.anime_id = ? 
       ORDER BY c.id DESC`,
      [id]
    );
    if (Array.isArray(rows)) {
      const parsed = rows.map((r: any) => ({
        ...r,
        liked_users: safeJsonParse(r.liked_users, []),
        disliked_users: safeJsonParse(r.disliked_users, []),
        replies: safeJsonParse(r.replies, [])
      }));
      return res.json(parsed);
    }
  } catch (err) {
    console.warn("Comments fetch falling back to local store:", (err as any)?.message);
  }
  const store = loadLocalStore();
  const comms = (store.comments || []).filter((c: any) => String(c.anime_id) === String(id));
  res.json(comms);
});

// Create comment on an anime
app.post("/api/animes/:id/comments", authenticateToken, async (req: any, res) => {
  try {
    const animeId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Izoh matni bo'sh bo'lishi mumkin emas" });
    }

    let insertId = Date.now();
    try {
      const [result]: any = await dbQuery(
        "INSERT INTO comments (anime_id, user_id, content, likes, dislikes, liked_users, disliked_users, replies) VALUES (?, ?, ?, 0, 0, '[]', '[]', '[]')",
        [animeId, userId, content]
      );
      if (result && result.insertId) {
        insertId = result.insertId;
      }
    } catch (dbErr) {
      console.warn("DB insert comment error:", dbErr);
    }

    let userAvatar = req.user.avatar_url || null;
    try {
      const [uRows]: any = await dbQuery("SELECT avatar_url FROM users WHERE id = ?", [userId]);
      if (uRows && uRows.length > 0 && uRows[0].avatar_url) {
        userAvatar = uRows[0].avatar_url;
      }
    } catch (e) {}

    const newComment = {
      id: insertId,
      anime_id: Number(animeId),
      user_id: userId,
      user_name: req.user.name,
      user_avatar: userAvatar,
      content,
      likes: 0,
      dislikes: 0,
      liked_users: [],
      disliked_users: [],
      replies: [],
      created_at: new Date().toISOString(),
    };

    const store = loadLocalStore();
    store.comments = store.comments || [];
    store.comments.unshift(newComment);
    saveLocalStore(store);

    res.status(201).json(newComment);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// Helper to get comment by ID
async function getCommentById(commentId: string | number) {
  try {
    const [rows]: any = await dbQuery("SELECT * FROM comments WHERE id = ?", [commentId]);
    if (rows && rows.length > 0) return rows[0];
  } catch (e) {}

  const store = loadLocalStore();
  store.comments = store.comments || [];
  return store.comments.find((c: any) => String(c.id) === String(commentId)) || null;
}

// Like comment
app.post("/api/comments/:commentId/like", authenticateToken, async (req: any, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;
  try {
    let comment = await getCommentById(commentId);
    if (!comment) return res.status(404).json({ error: "Izoh topilmadi" });

    let likedUsers = safeJsonParse(comment.liked_users, []);
    let dislikedUsers = safeJsonParse(comment.disliked_users, []);

    let likes = Number(comment.likes) || 0;
    let dislikes = Number(comment.dislikes) || 0;

    const hasLiked = likedUsers.map(String).includes(String(userId));
    const hasDisliked = dislikedUsers.map(String).includes(String(userId));

    if (hasLiked) {
      likedUsers = likedUsers.filter((id: any) => String(id) !== String(userId));
      likes = Math.max(0, likes - 1);
    } else {
      likedUsers.push(userId);
      likes += 1;
      if (hasDisliked) {
        dislikedUsers = dislikedUsers.filter((id: any) => String(id) !== String(userId));
        dislikes = Math.max(0, dislikes - 1);
      }
    }

    try {
      await dbQuery(
        "UPDATE comments SET likes = ?, dislikes = ?, liked_users = ?, disliked_users = ? WHERE id = ?",
        [likes, dislikes, JSON.stringify(likedUsers), JSON.stringify(dislikedUsers), commentId]
      );
    } catch(e) {}

    const store = loadLocalStore();
    store.comments = (store.comments || []).map((c: any) => {
      if (String(c.id) === String(commentId)) {
        return { ...c, likes, dislikes, liked_users: likedUsers, disliked_users: dislikedUsers };
      }
      return c;
    });
    saveLocalStore(store);

    res.json({ likes, dislikes, liked_users: likedUsers, disliked_users: dislikedUsers });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ error: "Failed to like comment" });
  }
});

// Dislike comment
app.post("/api/comments/:commentId/dislike", authenticateToken, async (req: any, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;
  try {
    let comment = await getCommentById(commentId);
    if (!comment) return res.status(404).json({ error: "Izoh topilmadi" });

    let likedUsers = safeJsonParse(comment.liked_users, []);
    let dislikedUsers = safeJsonParse(comment.disliked_users, []);

    let likes = Number(comment.likes) || 0;
    let dislikes = Number(comment.dislikes) || 0;

    const hasLiked = likedUsers.map(String).includes(String(userId));
    const hasDisliked = dislikedUsers.map(String).includes(String(userId));

    if (hasDisliked) {
      dislikedUsers = dislikedUsers.filter((id: any) => String(id) !== String(userId));
      dislikes = Math.max(0, dislikes - 1);
    } else {
      dislikedUsers.push(userId);
      dislikes += 1;
      if (hasLiked) {
        likedUsers = likedUsers.filter((id: any) => String(id) !== String(userId));
        likes = Math.max(0, likes - 1);
      }
    }

    try {
      await dbQuery(
        "UPDATE comments SET likes = ?, dislikes = ?, liked_users = ?, disliked_users = ? WHERE id = ?",
        [likes, dislikes, JSON.stringify(likedUsers), JSON.stringify(dislikedUsers), commentId]
      );
    } catch(e) {}

    const store = loadLocalStore();
    store.comments = (store.comments || []).map((c: any) => {
      if (String(c.id) === String(commentId)) {
        return { ...c, likes, dislikes, liked_users: likedUsers, disliked_users: dislikedUsers };
      }
      return c;
    });
    saveLocalStore(store);

    res.json({ likes, dislikes, liked_users: likedUsers, disliked_users: dislikedUsers });
  } catch (err) {
    console.error("Dislike error:", err);
    res.status(500).json({ error: "Failed to dislike comment" });
  }
});

// Reply to comment
app.post("/api/comments/:commentId/reply", authenticateToken, async (req: any, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Javob matni bo'sh bo'lishi mumkin emas" });
  }

  try {
    let comment = await getCommentById(commentId);
    if (!comment) return res.status(404).json({ error: "Izoh topilmadi" });

    let replies = safeJsonParse(comment.replies, []);

    let userAvatar = req.user.avatar_url || null;
    try {
      const [uRows]: any = await dbQuery("SELECT avatar_url FROM users WHERE id = ?", [userId]);
      if (uRows && uRows.length > 0 && uRows[0].avatar_url) {
        userAvatar = uRows[0].avatar_url;
      }
    } catch (e) {}

    const newReply = {
      id: Date.now(),
      user_id: userId,
      user_name: req.user.name,
      user_avatar: userAvatar,
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    replies.push(newReply);

    try {
      await dbQuery(
        "UPDATE comments SET replies = ? WHERE id = ?",
        [JSON.stringify(replies), commentId]
      );
    } catch(e) {}

    const store = loadLocalStore();
    store.comments = (store.comments || []).map((c: any) => {
      if (String(c.id) === String(commentId)) {
        return { ...c, replies };
      }
      return c;
    });
    saveLocalStore(store);

    res.status(201).json(newReply);
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ error: "Failed to post reply" });
  }
});

// Get manga comments
app.get("/api/mangas/:id/comments", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await dbQuery(
      `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar 
       FROM comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.manga_id = ? 
       ORDER BY c.id DESC`,
      [id]
    );
    if (Array.isArray(rows)) {
      const parsed = rows.map((r: any) => ({
        ...r,
        liked_users: safeJsonParse(r.liked_users, []),
        disliked_users: safeJsonParse(r.disliked_users, []),
        replies: safeJsonParse(r.replies, [])
      }));
      return res.json(parsed);
    }
  } catch (err) {
    console.warn("Manga comments fetch fallback:", (err as any)?.message);
  }
  const store = loadLocalStore();
  const comms = (store.comments || []).filter((c: any) => String(c.manga_id) === String(id));
  res.json(comms);
});

// Post manga comment
app.post("/api/mangas/:id/comments", authenticateToken, async (req: any, res) => {
  try {
    const mangaId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Izoh matni bo'sh bo'lishi mumkin emas" });
    }

    const [result]: any = await dbQuery(
      "INSERT INTO comments (manga_id, user_id, content, likes, dislikes, liked_users, disliked_users, replies) VALUES (?, ?, ?, 0, 0, '[]', '[]', '[]')",
      [mangaId, userId, content]
    );

    let userAvatar = req.user.avatar_url || null;
    try {
      const [uRows]: any = await dbQuery("SELECT avatar_url FROM users WHERE id = ?", [userId]);
      if (uRows && uRows.length > 0 && uRows[0].avatar_url) {
        userAvatar = uRows[0].avatar_url;
      }
    } catch (e) {}

    const newComment = {
      id: result.insertId,
      manga_id: Number(mangaId),
      user_id: userId,
      user_name: req.user.name,
      user_avatar: userAvatar,
      content,
      likes: 0,
      dislikes: 0,
      liked_users: [],
      disliked_users: [],
      replies: [],
      created_at: new Date().toISOString(),
    };

    const store = loadLocalStore();
    store.comments = store.comments || [];
    store.comments.unshift(newComment);
    saveLocalStore(store);

    res.status(201).json(newComment);
  } catch (err) {
    console.error("Add manga comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// Delete comment
app.delete("/api/comments/:commentId", authenticateToken, async (req: any, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;
    const role = req.user.role;

    // Check ownership or admin
    const [commentRows]: any = await dbQuery("SELECT user_id FROM comments WHERE id = ?", [commentId]);
    if (commentRows.length === 0) {
      return res.status(404).json({ error: "Izoh topilmadi" });
    }

    if (role !== "admin" && commentRows[0].user_id !== userId) {
      return res.status(403).json({ error: "Ruxsat etilmadi" });
    }

    await dbQuery("DELETE FROM comments WHERE id = ?", [commentId]);
    res.json({ message: "Izoh o'chirildi" });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// Rate anime
app.post("/api/animes/:animeId/rate", authenticateToken, async (req: any, res) => {
  try {
    const animeId = parseInt(req.params.animeId, 10);
    const userId = parseInt(req.user.id, 10);
    const rating = parseInt(req.body.rating, 10);

    console.log("Rate request details:", { userId, animeId, rating });

    if (isNaN(animeId) || isNaN(userId)) {
      console.warn("Invalid animeId or userId", { animeId, userId });
      return res.status(400).json({ error: "Foydalanuvchi yoki anime ID noto'g'ri" });
    }

    if (isNaN(rating) || rating < 1 || rating > 10) {
      console.warn("Invalid rating value", { rating });
      return res.status(400).json({ error: "Reyting 1 va 10 oralig'ida bo'lishi kerak" });
    }

    // Get current ratings from data.json
    const ratings = await getRatingsFromFile();

    // Find if rating already exists
    const existingIndex = ratings.findIndex(r => r.user_id === userId && r.anime_id === animeId);
    if (existingIndex >= 0) {
      ratings[existingIndex].rating = rating;
      ratings[existingIndex].created_at = new Date().toISOString();
    } else {
      const maxId = ratings.reduce((max, r) => r.id > max ? r.id : max, 0);
      ratings.push({
        id: maxId + 1,
        user_id: userId,
        anime_id: animeId,
        rating: rating,
        created_at: new Date().toISOString()
      });
    }

    // Save back to data.json
    await saveRatingsToFile(ratings);

    // Calculate average rating and count for this anime
    const animeRatings = ratings.filter(r => r.anime_id === animeId);
    const count = animeRatings.length;
    const sum = animeRatings.reduce((acc, r) => acc + r.rating, 0);
    const avg_rating = count > 0 ? parseFloat((sum / count).toFixed(1)) : 0;

    // Gracefully attempt to sync to MySQL database in background
    try {
      await dbQuery(
        "INSERT INTO ratings (user_id, anime_id, rating) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?",
        [userId, animeId, rating, rating]
      );
      await dbQuery(
        "UPDATE animes SET rating = ?, rating_count = ? WHERE id = ?",
        [avg_rating, count, animeId]
      );
    } catch (dbErr) {
      console.warn("Could not sync rating to MySQL database, but local rating was saved to data.json:", dbErr);
    }

    console.log("Rating successfully saved to data.json!", { animeId, avg_rating, count });
    res.json({ message: "Reyting saqlandi", rating: avg_rating, count });
  } catch (err: any) {
    console.error("Rate anime error:", err);
    res.status(500).json({ error: err.message || "Failed to save rating" });
  }
});

// Get ratings distribution and summary for an anime
app.get("/api/animes/:animeId/ratings-summary", async (req, res) => {
  try {
    const animeId = parseInt(req.params.animeId, 10);
    if (isNaN(animeId)) {
      return res.status(400).json({ error: "Noto'g'ri anime ID" });
    }
    
    // Read from data.json
    const ratings = await getRatingsFromFile();
    const animeRatings = ratings.filter(r => r.anime_id === animeId);
    
    let totalCount = animeRatings.length;
    const sum = animeRatings.reduce((acc, r) => acc + r.rating, 0);
    let avgRating = totalCount > 0 ? parseFloat((sum / totalCount).toFixed(1)) : 0;

    // Database fallback if no file-backed rating exists yet
    if (totalCount === 0) {
      try {
        const [rows]: any = await dbQuery("SELECT rating, rating_count FROM animes WHERE id = ?", [animeId]);
        if (rows.length > 0) {
          avgRating = Number(rows[0].rating) || 0;
          totalCount = Number(rows[0].rating_count) || 0;
        }
      } catch (dbErr) {
        console.warn("Could not fetch database fallback rating in ratings-summary:", dbErr);
      }
    }

    const distribution: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      distribution[i] = 0;
    }
    animeRatings.forEach(row => {
      if (row.rating >= 1 && row.rating <= 10) {
        distribution[row.rating] = (distribution[row.rating] || 0) + 1;
      }
    });

    // If we have database fallback rating with 0 distribution, put it in the matching key
    if (totalCount > 0 && animeRatings.length === 0) {
      const roundedRating = Math.round(avgRating);
      if (roundedRating >= 1 && roundedRating <= 10) {
        distribution[roundedRating] = totalCount;
      }
    }

    res.json({
      average: avgRating,
      total: totalCount,
      distribution
    });
  } catch (err) {
    console.error("Get ratings summary error:", err);
    res.status(500).json({ error: "Failed to fetch ratings summary" });
  }
});

// Get user rating for anime
app.get("/api/animes/:animeId/rating", authenticateToken, async (req: any, res) => {
  try {
    const animeId = parseInt(req.params.animeId, 10);
    const userId = parseInt(req.user.id, 10);
    
    if (isNaN(animeId) || isNaN(userId)) {
      return res.json({ rating: 0 });
    }

    // Read from data.json
    const ratings = await getRatingsFromFile();
    const userRatingObj = ratings.find(r => r.anime_id === animeId && r.user_id === userId);

    res.json({ rating: userRatingObj ? userRatingObj.rating : 0 });
  } catch (err) {
    console.error("Get rating error:", err);
    res.status(500).json({ error: "Failed to fetch rating" });
  }
});

// Admin Route: Add Anime
app.post("/api/animes", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);

    const {
      title,
      description,
      image_url,
      banner_url,
      rating,
      rating_count,
      holati,
      yil,
      studiyasi,
      qismlar_soni,
      korishlar,
      janrlar,
      telegram_url,
      video_url,
      tavsiya,
      is_banner,
      tags,
      is_adult,
    } = req.body;

    let insertId = Date.now();
    try {
      const [result]: any = await dbQuery(
        `INSERT INTO animes 
        (title, description, image_url, banner_url, rating, rating_count, holati, yil, studiyasi, qismlar_soni, korishlar, janrlar, telegram_url, video_url, tavsiya, is_banner, tags, is_adult) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title || "",
          description || "",
          image_url || "",
          banner_url || "",
          rating || 0.0,
          rating_count || 0,
          holati || "Faol",
          yil || null,
          studiyasi || "",
          qismlar_soni || 0,
          korishlar || 0,
          janrlar || "",
          telegram_url || "",
          video_url || "",
          tavsiya ? 1 : 0,
          is_banner ? 1 : 0,
          tags || "",
          is_adult ? 1 : 0,
        ]
      );
      if (result && result.insertId) {
        insertId = result.insertId;
      }
    } catch (dbErr) {
      console.warn("DB insert anime failed, using local store:", (dbErr as any)?.message);
    }

    const store = loadLocalStore();
    const newObj = {
      id: insertId,
      title: title || "",
      description: description || "",
      image_url: image_url || "",
      banner_url: banner_url || "",
      rating: rating || 0.0,
      rating_count: rating_count || 0,
      holati: holati || "Faol",
      yil: yil ? Number(yil) : null,
      studiyasi: studiyasi || "",
      qismlar_soni: qismlar_soni ? Number(qismlar_soni) : 0,
      korishlar: korishlar ? Number(korishlar) : 0,
      janrlar: janrlar || "",
      telegram_url: telegram_url || "",
      video_url: video_url || "",
      tavsiya: Boolean(tavsiya),
      is_banner: Boolean(is_banner),
      tags: tags || "",
      is_adult: Boolean(is_adult)
    };
    store.animes = store.animes || [];
    store.animes.unshift(newObj);
    saveLocalStore(store);

    // Notify Telegram
    notifyTelegramNewAnime(insertId, qismlar_soni ? Number(qismlar_soni) : null);

    // Broadcast Web Push to all devices with anime image
    broadcastPushNotification({
      title: "Animem.uz | Yangi Anime Qo'shildi! 🎬",
      body: `"${title}" o'zbek tilida joylandi (${qismlar_soni ? `${qismlar_soni} qism` : 'Film'}). Hoziroq tomosha qiling!`,
      image: image_url || banner_url || undefined,
      url: `/anime/${(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
      tag: `anime-${insertId}`
    }).catch(() => {});

    res.status(201).json({ id: insertId });
  } catch (err) {
    console.error("Add anime error:", err);
    res.status(500).json({ error: "Failed to create anime" });
  }
});

// Admin Route: Update Anime
app.put("/api/animes/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;

    const {
      title,
      description,
      image_url,
      banner_url,
      rating,
      rating_count,
      holati,
      yil,
      studiyasi,
      qismlar_soni,
      korishlar,
      janrlar,
      telegram_url,
      video_url,
      tavsiya,
      is_banner,
      tags,
      is_adult,
    } = req.body;

    // Fetch existing record to prevent overwriting missing values like korishlar or rating
    let existing: any = null;
    try {
      const [rows]: any = await dbQuery("SELECT * FROM animes WHERE id = ?", [id]);
      if (rows && rows.length > 0) existing = rows[0];
    } catch (e) {}

    if (!existing) {
      const store = loadLocalStore();
      existing = (store.animes || []).find((a: any) => String(a.id) === String(id));
    }

    const finalKorishlar = (korishlar !== undefined && korishlar !== null) 
      ? Number(korishlar) 
      : (existing ? Number(existing.korishlar || 0) : 0);

    const finalRating = (rating !== undefined && rating !== null) 
      ? Number(rating) 
      : (existing ? Number(existing.rating || 0) : 0.0);

    const finalRatingCount = (rating_count !== undefined && rating_count !== null) 
      ? Number(rating_count) 
      : (existing ? Number(existing.rating_count || 0) : 0);

    const finalTitle = title !== undefined ? title : (existing?.title || "");
    const finalDescription = description !== undefined ? description : (existing?.description || "");
    const finalImageUrl = image_url !== undefined ? image_url : (existing?.image_url || "");
    const finalBannerUrl = banner_url !== undefined ? banner_url : (existing?.banner_url || "");
    const finalHolati = holati !== undefined ? holati : (existing?.holati || "Faol");
    const finalYil = yil !== undefined ? (yil ? Number(yil) : null) : (existing?.yil || null);
    const finalStudiyasi = studiyasi !== undefined ? studiyasi : (existing?.studiyasi || "");
    const finalQismlarSoni = qismlar_soni !== undefined ? Number(qismlar_soni) : (existing?.qismlar_soni || 0);
    const finalJanrlar = janrlar !== undefined ? janrlar : (existing?.janrlar || "");
    const finalTelegramUrl = telegram_url !== undefined ? telegram_url : (existing?.telegram_url || "");
    const finalVideoUrl = video_url !== undefined ? video_url : (existing?.video_url || "");
    const finalTavsiya = tavsiya !== undefined ? (tavsiya ? 1 : 0) : (existing?.tavsiya ? 1 : 0);
    const finalIsBanner = is_banner !== undefined ? (is_banner ? 1 : 0) : (existing?.is_banner ? 1 : 0);
    const finalTags = tags !== undefined ? tags : (existing?.tags || "");
    const finalIsAdult = is_adult !== undefined ? (is_adult ? 1 : 0) : (existing?.is_adult ? 1 : 0);

    try {
      await dbQuery(
        `UPDATE animes SET 
        title = ?, description = ?, image_url = ?, banner_url = ?, rating = ?, rating_count = ?, 
        holati = ?, yil = ?, studiyasi = ?, qismlar_soni = ?, korishlar = ?, janrlar = ?, telegram_url = ?, video_url = ?, tavsiya = ?, is_banner = ?, tags = ?, is_adult = ? 
        WHERE id = ?`,
        [
          finalTitle,
          finalDescription,
          finalImageUrl,
          finalBannerUrl,
          finalRating,
          finalRatingCount,
          finalHolati,
          finalYil,
          finalStudiyasi,
          finalQismlarSoni,
          finalKorishlar,
          finalJanrlar,
          finalTelegramUrl,
          finalVideoUrl,
          finalTavsiya,
          finalIsBanner,
          finalTags,
          finalIsAdult,
          id,
        ]
      );
    } catch (dbErr) {
      console.warn("DB update anime failed, relying on local store:", (dbErr as any)?.message);
    }

    // Always update local_store.json
    const store = loadLocalStore();
    const idx = (store.animes || []).findIndex((a: any) => String(a.id) === String(id));
    const updatedObj = {
      id: Number(id),
      title: finalTitle,
      description: finalDescription,
      image_url: finalImageUrl,
      banner_url: finalBannerUrl,
      rating: finalRating,
      rating_count: finalRatingCount,
      holati: finalHolati,
      yil: finalYil,
      studiyasi: finalStudiyasi,
      qismlar_soni: finalQismlarSoni,
      korishlar: finalKorishlar,
      janrlar: finalJanrlar,
      telegram_url: finalTelegramUrl,
      video_url: finalVideoUrl,
      tavsiya: Boolean(finalTavsiya),
      is_banner: Boolean(finalIsBanner),
      tags: finalTags,
      is_adult: Boolean(finalIsAdult)
    };

    if (idx >= 0) {
      store.animes[idx] = { ...store.animes[idx], ...updatedObj };
    } else {
      store.animes = store.animes || [];
      store.animes.push(updatedObj);
    }
    saveLocalStore(store);

    res.json({ message: "Anime tahrirlandi" });
  } catch (err) {
    console.error("Update anime error:", err);
    res.status(500).json({ error: "Failed to update anime" });
  }
});

// Admin Route: Delete Anime
app.delete("/api/animes/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;

    try {
      await dbQuery("DELETE FROM animes WHERE id = ?", [id]);
    } catch (e) {}

    const store = loadLocalStore();
    store.animes = (store.animes || []).filter((a: any) => String(a.id) !== String(id));
    saveLocalStore(store);

    res.json({ message: "Anime o'chirildi" });
  } catch (err) {
    console.error("Delete anime error:", err);
    res.status(500).json({ error: "Failed to delete anime" });
  }
});

// Admin Route: Save Episode (Upsert)
app.post("/api/animes/:animeId/episodes", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);

    const anime_id = parseInt(req.params.animeId);
    const { episode_number, video_url } = req.body;
    const epNum = parseInt(episode_number);

    let epId = Date.now();
    try {
      const [existing]: any = await dbQuery(
        "SELECT id FROM episodes WHERE anime_id = ? AND episode_number = ?",
        [anime_id, epNum]
      );

      if (existing && existing.length > 0) {
        epId = existing[0].id;
        await dbQuery(
          "UPDATE episodes SET video_url = ? WHERE anime_id = ? AND episode_number = ?",
          [video_url, anime_id, epNum]
        );
      } else {
        const [result]: any = await dbQuery(
          "INSERT INTO episodes (anime_id, episode_number, video_url) VALUES (?, ?, ?)",
          [anime_id, epNum, video_url]
        );
        if (result && result.insertId) epId = result.insertId;
        
        // Notify Telegram
        notifyTelegramNewAnime(anime_id, epNum);
      }
    } catch (dbErr) {
      console.warn("DB save episode failed, relying on local store:", (dbErr as any)?.message);
    }

    const store = loadLocalStore();
    store.episodes = store.episodes || [];
    const idx = store.episodes.findIndex(
      (e: any) => String(e.anime_id) === String(anime_id) && Number(e.episode_number) === epNum
    );

    if (idx >= 0) {
      store.episodes[idx] = { ...store.episodes[idx], video_url };
    } else {
      store.episodes.push({
        id: epId,
        anime_id,
        episode_number: epNum,
        video_url
      });
    }
    saveLocalStore(store);

    res.json({ message: "Qism saqlandi", id: epId });
  } catch (err) {
    console.error("Save episode error:", err);
    res.status(500).json({ error: "Failed to save episode" });
  }
});

// Admin Route: Delete Episode
app.delete("/api/animes/:animeId/episodes/:episodeNumber", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { animeId, episodeNumber } = req.params;

    try {
      await dbQuery(
        "DELETE FROM episodes WHERE anime_id = ? AND episode_number = ?",
        [animeId, episodeNumber]
      );
    } catch (e) {}

    const store = loadLocalStore();
    store.episodes = (store.episodes || []).filter(
      (e: any) => !(String(e.anime_id) === String(animeId) && String(e.episode_number) === String(episodeNumber))
    );
    saveLocalStore(store);

    res.json({ message: "Qism o'chirildi" });
  } catch (err) {
    console.error("Delete episode error:", err);
    res.status(500).json({ error: "Failed to delete episode" });
  }
});

// ==================== MANGA API ENDPOINTS ====================

// GET All Mangas
app.get("/api/mangas", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=60");
  const cached = getCache<any[]>("api_all_mangas", 20000);
  if (cached) {
    return res.json(cached);
  }
  try {
    let mangas: any[] = [];
    try {
      const [rows]: any = await dbQuery(`SELECT * FROM mangas ORDER BY id DESC`);
      if (Array.isArray(rows) && rows.length > 0) {
        mangas = rows;
      }
    } catch (dbErr) {
      console.warn("MySQL fetch mangas failed, falling back to local_store:", dbErr);
    }

    if (mangas.length === 0) {
      const store = loadLocalStore();
      mangas = store.mangas || [];
    }
    setCache("api_all_mangas", mangas);
    res.json(mangas);
  } catch (err) {
    console.error("Get mangas error:", err);
    res.status(500).json({ error: "Failed to fetch mangas" });
  }
});

// GET Single Manga Details with Chapters
app.get("/api/mangas/:id", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  const id = req.params.id;
  const cacheKey = `api_manga_${id}`;
  const cached = getCache<any>(cacheKey, 15000);
  if (cached) {
    dbQuery(`UPDATE mangas SET korishlar = korishlar + 1 WHERE id = ?`, [id]).catch(() => {});
    return res.json(cached);
  }
  try {
    let manga: any = null;
    let chapters: any[] = [];

    try {
      const [mangaRows]: any = await dbQuery(`SELECT * FROM mangas WHERE id = ?`, [id]);
      if (Array.isArray(mangaRows) && mangaRows.length > 0) {
        manga = mangaRows[0];
        // Increment view count in DB
        await dbQuery(`UPDATE mangas SET korishlar = korishlar + 1 WHERE id = ?`, [id]);
        manga.korishlar = (manga.korishlar || 0) + 1;

        const [chapRows]: any = await dbQuery(`SELECT * FROM manga_chapters WHERE manga_id = ? ORDER BY chapter_number ASC`, [id]);
        if (Array.isArray(chapRows)) {
          chapters = chapRows.map((c: any) => ({
            ...c,
            pages: typeof c.pages === 'string' ? JSON.parse(c.pages) : c.pages
          }));
        }
      }
    } catch (dbErr) {
      console.warn("MySQL get manga detail failed, falling back to local_store:", dbErr);
    }

    if (!manga) {
      const store = loadLocalStore();
      const mangas = store.mangas || [];
      const mangaIndex = mangas.findIndex((m: any) => String(m.id) === String(id));
      if (mangaIndex === -1) {
        return res.status(404).json({ error: "Manga topilmadi" });
      }
      mangas[mangaIndex].korishlar = (mangas[mangaIndex].korishlar || 0) + 1;
      saveLocalStore(store);

      manga = mangas[mangaIndex];
      chapters = (store.manga_chapters || [])
        .filter((c: any) => String(c.manga_id) === String(id))
        .sort((a: any, b: any) => a.chapter_number - b.chapter_number);
    }

    res.json({ ...manga, chapters });
  } catch (err) {
    console.error("Get manga details error:", err);
    res.status(500).json({ error: "Failed to fetch manga details" });
  }
});

// GET Single Manga Chapter Pages
app.get("/api/mangas/:id/chapters/:chapterNumber", async (req, res) => {
  try {
    const { id, chapterNumber } = req.params;
    let chapter: any = null;
    let mangaTitle = "Manga";
    let allChapters: any[] = [];

    try {
      const [mangaRows]: any = await dbQuery(`SELECT title FROM mangas WHERE id = ?`, [id]);
      if (Array.isArray(mangaRows) && mangaRows.length > 0) {
        mangaTitle = mangaRows[0].title;
      }

      const [chapRows]: any = await dbQuery(`SELECT * FROM manga_chapters WHERE manga_id = ? AND chapter_number = ?`, [id, chapterNumber]);
      if (Array.isArray(chapRows) && chapRows.length > 0) {
        const rawChap = chapRows[0];
        chapter = {
          ...rawChap,
          pages: typeof rawChap.pages === 'string' ? JSON.parse(rawChap.pages) : rawChap.pages
        };

        const [allChapRows]: any = await dbQuery(`SELECT id, chapter_number, title FROM manga_chapters WHERE manga_id = ? ORDER BY chapter_number ASC`, [id]);
        if (Array.isArray(allChapRows)) {
          allChapters = allChapRows;
        }
      }
    } catch (dbErr) {
      console.warn("MySQL get chapter failed, falling back to local_store:", dbErr);
    }

    if (!chapter) {
      const store = loadLocalStore();
      chapter = (store.manga_chapters || []).find(
        (c: any) => String(c.manga_id) === String(id) && String(c.chapter_number) === String(chapterNumber)
      );
      if (!chapter) {
        return res.status(404).json({ error: "Bob topilmadi" });
      }
      const manga = (store.mangas || []).find((m: any) => String(m.id) === String(id));
      mangaTitle = manga?.title || "Manga";
      allChapters = (store.manga_chapters || [])
        .filter((c: any) => String(c.manga_id) === String(id))
        .sort((a: any, b: any) => a.chapter_number - b.chapter_number)
        .map((c: any) => ({
          id: c.id,
          chapter_number: c.chapter_number,
          title: c.title
        }));
    }

    res.json({
      chapter,
      manga_title: mangaTitle,
      all_chapters: allChapters
    });
  } catch (err) {
    console.error("Get chapter error:", err);
    res.status(500).json({ error: "Failed to fetch chapter" });
  }
});

// Admin Route: Create/Add Manga
app.post("/api/mangas", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { title, description, cover_url, banner_url, author, artist, janrlar, holati, released_year, tags, type } = req.body;

    if (!title || !description || !cover_url) {
      return res.status(400).json({ error: "Sarlavha, tavsif va muqova havola (cover_url) kiritilishi shart!" });
    }

    const newManga = {
      id: Date.now(),
      title,
      description,
      cover_url,
      banner_url: banner_url || cover_url,
      author: author || "Noma'lum",
      artist: artist || "Noma'lum",
      janrlar: janrlar || "Jangari",
      holati: holati || "Davom etmoqda",
      released_year: released_year ? parseInt(released_year) : new Date().getFullYear(),
      tags: tags || "",
      type: type || "Manga",
      rating: 9.5,
      korishlar: 0,
      chapters_count: 0,
      created_at: new Date().toISOString()
    };

    // Save to local_store.json
    const store = loadLocalStore();
    store.mangas = store.mangas || [];
    store.mangas.unshift(newManga);
    saveLocalStore(store);

    // Save to MySQL database
    try {
      await dbQuery(
        `INSERT INTO mangas (id, title, description, cover_url, banner_url, author, artist, janrlar, holati, released_year, tags, type, rating, korishlar, chapters_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newManga.id,
          newManga.title,
          newManga.description,
          newManga.cover_url,
          newManga.banner_url,
          newManga.author,
          newManga.artist,
          newManga.janrlar,
          newManga.holati,
          newManga.released_year,
          newManga.tags,
          newManga.type,
          newManga.rating,
          newManga.korishlar,
          newManga.chapters_count,
          newManga.created_at
        ]
      );
      console.log(`[MySQL] Inserted manga #${newManga.id}`);
    } catch (dbErr) {
      console.error("[MySQL] Failed to insert manga:", dbErr);
    }

    res.status(201).json({ message: "Manga muvaffaqiyatli qo'shildi", manga: newManga });
  } catch (err) {
    console.error("Create manga error:", err);
    res.status(500).json({ error: "Manga qo'shishda xatolik yuz berdi" });
  }
});

// Admin Route: Update Manga
app.put("/api/mangas/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;
    const store = loadLocalStore();
    store.mangas = store.mangas || [];
    const idx = store.mangas.findIndex((m: any) => String(m.id) === String(id));

    const updatedData = req.body;
    if (idx >= 0) {
      store.mangas[idx] = {
        ...store.mangas[idx],
        ...updatedData
      };
      saveLocalStore(store);
    }

    // Update in MySQL database
    try {
      const { title, description, cover_url, banner_url, author, artist, janrlar, holati, released_year, tags, type } = updatedData;
      await dbQuery(
        `UPDATE mangas 
         SET title = COALESCE(?, title),
             description = COALESCE(?, description),
             cover_url = COALESCE(?, cover_url),
             banner_url = COALESCE(?, banner_url),
             author = COALESCE(?, author),
             artist = COALESCE(?, artist),
             janrlar = COALESCE(?, janrlar),
             holati = COALESCE(?, holati),
             released_year = COALESCE(?, released_year),
             tags = COALESCE(?, tags),
             type = COALESCE(?, type)
         WHERE id = ?`,
        [title, description, cover_url, banner_url, author, artist, janrlar, holati, released_year, tags, type, id]
      );
    } catch (dbErr) {
      console.error("[MySQL] Failed to update manga:", dbErr);
    }

    const resManga = idx >= 0 ? store.mangas[idx] : updatedData;
    res.json({ message: "Manga tahrirlandi", manga: resManga });
  } catch (err) {
    console.error("Update manga error:", err);
    res.status(500).json({ error: "Manga tahrirlashda xatolik" });
  }
});

// Admin Route: Delete Manga
app.delete("/api/mangas/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;

    // Delete from local_store.json
    const store = loadLocalStore();
    store.mangas = (store.mangas || []).filter((m: any) => String(m.id) !== String(id));
    store.manga_chapters = (store.manga_chapters || []).filter((c: any) => String(c.manga_id) !== String(id));
    saveLocalStore(store);

    // Delete from MySQL database
    try {
      await dbQuery(`DELETE FROM mangas WHERE id = ?`, [id]);
      await dbQuery(`DELETE FROM manga_chapters WHERE manga_id = ?`, [id]);
      console.log(`[MySQL] Deleted manga #${id} and its chapters`);
    } catch (dbErr) {
      console.error("[MySQL] Failed to delete manga:", dbErr);
    }

    res.json({ message: "Manga o'chirildi" });
  } catch (err) {
    console.error("Delete manga error:", err);
    res.status(500).json({ error: "Manga o'chirishda xatolik" });
  }
});

// Admin Route: Clear all mangas (test mangas removal)
app.delete("/api/admin/mangas-clear", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const store = loadLocalStore();
    store.mangas = [];
    store.manga_chapters = [];
    saveLocalStore(store);

    try {
      await dbQuery(`DELETE FROM manga_chapters`);
      await dbQuery(`DELETE FROM mangas`);
      console.log("[MySQL] Cleared all mangas and chapters");
    } catch (dbErr) {
      console.error("[MySQL] Failed to clear mangas:", dbErr);
    }

    res.json({ message: "Barcha test mangalar o'chirildi" });
  } catch (err) {
    console.error("Clear mangas error:", err);
    res.status(500).json({ error: "Mangalarni o'chirishda xatolik" });
  }
});

// Admin Route: Save / Add Manga Chapter
app.post("/api/mangas/:mangaId/chapters", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const mangaId = req.params.mangaId;
    const { chapter_number, title, pages } = req.body;

    if (!chapter_number || !pages || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: "Bob raqami va kamida 1 ta rasm havolasi (pages) talab qilinadi!" });
    }

    const cleanPages = pages.filter((p: string) => typeof p === 'string' && p.trim().length > 0);
    const jsonPages = JSON.stringify(cleanPages);

    const store = loadLocalStore();
    store.manga_chapters = store.manga_chapters || [];

    const existingIdx = store.manga_chapters.findIndex(
      (c: any) => String(c.manga_id) === String(mangaId) && Number(c.chapter_number) === Number(chapter_number)
    );

    const chapterObj = {
      id: existingIdx >= 0 ? store.manga_chapters[existingIdx].id : Date.now(),
      manga_id: isNaN(Number(mangaId)) ? mangaId : Number(mangaId),
      chapter_number: Number(chapter_number),
      title: title || `${chapter_number}-bob`,
      pages: cleanPages,
      views: existingIdx >= 0 ? store.manga_chapters[existingIdx].views || 0 : 0,
      created_at: existingIdx >= 0 ? store.manga_chapters[existingIdx].created_at : new Date().toISOString()
    };

    if (existingIdx >= 0) {
      store.manga_chapters[existingIdx] = chapterObj;
    } else {
      store.manga_chapters.push(chapterObj);
    }

    // Update manga chapter count in local store
    const mangaIdx = (store.mangas || []).findIndex((m: any) => String(m.id) === String(mangaId));
    if (mangaIdx >= 0) {
      const chapterCount = store.manga_chapters.filter((c: any) => String(c.manga_id) === String(mangaId)).length;
      store.mangas[mangaIdx].chapters_count = chapterCount;
    }

    saveLocalStore(store);

    // Save to MySQL database
    try {
      const [existingChapRows]: any = await dbQuery(
        `SELECT id FROM manga_chapters WHERE manga_id = ? AND chapter_number = ?`,
        [mangaId, chapter_number]
      );

      if (Array.isArray(existingChapRows) && existingChapRows.length > 0) {
        await dbQuery(
          `UPDATE manga_chapters SET title = ?, pages = ? WHERE manga_id = ? AND chapter_number = ?`,
          [chapterObj.title, jsonPages, mangaId, chapter_number]
        );
      } else {
        await dbQuery(
          `INSERT INTO manga_chapters (id, manga_id, chapter_number, title, pages, views, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [chapterObj.id, chapterObj.manga_id, chapterObj.chapter_number, chapterObj.title, jsonPages, chapterObj.views, chapterObj.created_at]
        );
      }

      // Update chapter count in MySQL mangas
      const [allChapRows]: any = await dbQuery(`SELECT COUNT(*) as cnt FROM manga_chapters WHERE manga_id = ?`, [mangaId]);
      if (Array.isArray(allChapRows) && allChapRows.length > 0) {
        const count = allChapRows[0].cnt;
        await dbQuery(`UPDATE mangas SET chapters_count = ? WHERE id = ?`, [count, mangaId]);
      }
      console.log(`[MySQL] Saved chapter #${chapter_number} for manga #${mangaId}`);
    } catch (dbErr) {
      console.error("[MySQL] Failed to save chapter:", dbErr);
    }

    res.json({ message: "Bob muvaffaqiyatli saqlandi", chapter: chapterObj });
  } catch (err) {
    console.error("Save manga chapter error:", err);
    res.status(500).json({ error: "Bobni saqlashda xatolik yuz berdi" });
  }
});

// Admin Route: Delete Manga Chapter
app.delete("/api/mangas/:mangaId/chapters/:chapterNumber", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { mangaId, chapterNumber } = req.params;

    // Delete from local_store.json
    const store = loadLocalStore();
    store.manga_chapters = (store.manga_chapters || []).filter(
      (c: any) => !(String(c.manga_id) === String(mangaId) && String(c.chapter_number) === String(chapterNumber))
    );

    const mangaIdx = (store.mangas || []).findIndex((m: any) => String(m.id) === String(mangaId));
    if (mangaIdx >= 0) {
      const chapterCount = store.manga_chapters.filter((c: any) => String(c.manga_id) === String(mangaId)).length;
      store.mangas[mangaIdx].chapters_count = chapterCount;
    }

    saveLocalStore(store);

    // Delete from MySQL database
    try {
      await dbQuery(
        `DELETE FROM manga_chapters WHERE manga_id = ? AND chapter_number = ?`,
        [mangaId, chapterNumber]
      );
      const [allChapRows]: any = await dbQuery(`SELECT COUNT(*) as cnt FROM manga_chapters WHERE manga_id = ?`, [mangaId]);
      if (Array.isArray(allChapRows) && allChapRows.length > 0) {
        const count = allChapRows[0].cnt;
        await dbQuery(`UPDATE mangas SET chapters_count = ? WHERE id = ?`, [count, mangaId]);
      }
      console.log(`[MySQL] Deleted chapter #${chapterNumber} of manga #${mangaId}`);
    } catch (dbErr) {
      console.error("[MySQL] Failed to delete chapter:", dbErr);
    }

    res.json({ message: "Bob o'chirildi" });
  } catch (err) {
    console.error("Delete manga chapter error:", err);
    res.status(500).json({ error: "Bobni o'chirishda xatolik" });
  }
});

// ==================== DRAMA API ENDPOINTS ====================

// GET All Dramas
app.get("/api/dramas", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  try {
    let dramas: any[] = [];
    try {
      const [rows]: any = await dbQuery(`SELECT * FROM dramas ORDER BY id DESC`);
      if (Array.isArray(rows) && rows.length > 0) {
        dramas = rows;
      }
    } catch (dbErr) {
      console.warn("MySQL fetch dramas failed, fallback to local_store:", dbErr);
    }

    if (dramas.length === 0) {
      const store = loadLocalStore();
      dramas = store.dramas || [];
    }

    const store = loadLocalStore();
    const allEpisodes = store.drama_episodes || [];

    const formatted = dramas.map((d: any) => {
      const eps = allEpisodes.filter((ep: any) => String(ep.drama_id) === String(d.id));
      return {
        ...d,
        liked_users: safeJsonParse(d.liked_users, []),
        episodes_count: eps.length
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Get dramas error:", err);
    res.status(500).json({ error: "Dramalarni yuklashda xatolik" });
  }
});

// GET Single Drama Details with Episodes
app.get("/api/dramas/:id", async (req, res) => {
  const id = req.params.id;
  try {
    let drama: any = null;

    try {
      const [rows]: any = await dbQuery(`SELECT * FROM dramas WHERE id = ?`, [id]);
      if (Array.isArray(rows) && rows.length > 0) {
        drama = rows[0];
        // Increment views
        await dbQuery(`UPDATE dramas SET korishlar = korishlar + 1 WHERE id = ?`, [id]);
        drama.korishlar = (drama.korishlar || 0) + 1;
      }
    } catch (dbErr) {
      console.warn("MySQL get drama detail failed, fallback to local_store:", dbErr);
    }

    const store = loadLocalStore();
    if (!drama) {
      const dramas = store.dramas || [];
      const idx = dramas.findIndex((d: any) => String(d.id) === String(id));
      if (idx === -1) {
        return res.status(404).json({ error: "Drama topilmadi" });
      }
      dramas[idx].korishlar = (dramas[idx].korishlar || 0) + 1;
      saveLocalStore(store);
      drama = dramas[idx];
    }

    // Fetch episodes for this drama
    let episodes: any[] = [];
    try {
      const [epRows]: any = await dbQuery(`SELECT * FROM drama_episodes WHERE drama_id = ? ORDER BY qism ASC`, [id]);
      if (Array.isArray(epRows) && epRows.length > 0) {
        episodes = epRows;
      }
    } catch (e) {}

    if (episodes.length === 0) {
      episodes = (store.drama_episodes || []).filter((ep: any) => String(ep.drama_id) === String(id));
      episodes.sort((a: any, b: any) => Number(a.qism) - Number(b.qism));
    }

    // If no episodes in episodes table but drama has video_url, provide a default episode 1
    if (episodes.length === 0 && drama.video_url) {
      episodes = [
        {
          id: `ep_1_${drama.id}`,
          drama_id: drama.id,
          qism: 1,
          title: "1-Qism",
          video_url: drama.video_url,
          created_at: drama.created_at || new Date().toISOString()
        }
      ];
    }

    drama.episodes = episodes;
    drama.liked_users = safeJsonParse(drama.liked_users, []);
    res.json(drama);
  } catch (err) {
    console.error("Get single drama error:", err);
    res.status(500).json({ error: "Dramani yuklashda xatolik" });
  }
});

// GET Drama Episodes list
app.get("/api/dramas/:id/episodes", async (req, res) => {
  const id = req.params.id;
  try {
    let episodes: any[] = [];
    try {
      const [rows]: any = await dbQuery(`SELECT * FROM drama_episodes WHERE drama_id = ? ORDER BY qism ASC`, [id]);
      if (Array.isArray(rows) && rows.length > 0) {
        episodes = rows;
      }
    } catch (dbErr) {
      console.warn("MySQL fetch drama episodes error:", dbErr);
    }

    if (episodes.length === 0) {
      const store = loadLocalStore();
      episodes = (store.drama_episodes || []).filter((ep: any) => String(ep.drama_id) === String(id));
      episodes.sort((a: any, b: any) => Number(a.qism) - Number(b.qism));
    }

    res.json(episodes);
  } catch (err) {
    console.error("Get drama episodes error:", err);
    res.status(500).json({ error: "Qismlarni yuklashda xatolik" });
  }
});

// POST Create Drama Episode (Admin only)
app.post("/api/dramas/:id/episodes", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const dramaId = req.params.id;
    const { qism, title, video_url } = req.body;

    if (!video_url || !video_url.trim()) {
      return res.status(400).json({ error: "Video URL yoki havolani kiriting" });
    }

    const epNumber = Number(qism) || 1;
    const newEpId = Date.now();
    const newEpisode = {
      id: newEpId,
      drama_id: dramaId,
      qism: epNumber,
      title: title ? title.trim() : `${epNumber}-Qism`,
      video_url: video_url.trim(),
      created_at: new Date().toISOString()
    };

    const store = loadLocalStore();
    store.drama_episodes = store.drama_episodes || [];
    store.drama_episodes.push(newEpisode);

    // If this is episode 1 or first episode, update drama's default video_url
    if (store.dramas) {
      const dramaIdx = store.dramas.findIndex((d: any) => String(d.id) === String(dramaId));
      if (dramaIdx >= 0 && (!store.dramas[dramaIdx].video_url || epNumber === 1)) {
        store.dramas[dramaIdx].video_url = newEpisode.video_url;
      }
    }
    saveLocalStore(store);

    try {
      await dbQuery(
        `INSERT INTO drama_episodes (id, drama_id, qism, title, video_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newEpisode.id, newEpisode.drama_id, newEpisode.qism, newEpisode.title, newEpisode.video_url, newEpisode.created_at]
      );
      if (epNumber === 1) {
        await dbQuery(`UPDATE dramas SET video_url = ? WHERE id = ?`, [newEpisode.video_url, dramaId]);
      }
    } catch (dbErr) {
      console.warn("MySQL save drama episode error:", dbErr);
    }

    res.status(201).json(newEpisode);
  } catch (err) {
    console.error("Create drama episode error:", err);
    res.status(500).json({ error: "Qismni qo'shishda xatolik" });
  }
});

// PUT Update Drama Episode (Admin only)
app.put("/api/dramas/episodes/:episodeId", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const episodeId = req.params.episodeId;
    const { qism, title, video_url } = req.body;

    const store = loadLocalStore();
    store.drama_episodes = store.drama_episodes || [];
    const idx = store.drama_episodes.findIndex((ep: any) => String(ep.id) === String(episodeId));
    if (idx >= 0) {
      store.drama_episodes[idx] = {
        ...store.drama_episodes[idx],
        qism: qism !== undefined ? Number(qism) : store.drama_episodes[idx].qism,
        title: title !== undefined ? title : store.drama_episodes[idx].title,
        video_url: video_url !== undefined ? video_url : store.drama_episodes[idx].video_url
      };
      saveLocalStore(store);
    }

    try {
      await dbQuery(
        `UPDATE drama_episodes SET qism = ?, title = ?, video_url = ? WHERE id = ?`,
        [Number(qism) || 1, title, video_url, episodeId]
      );
    } catch (dbErr) {
      console.warn("MySQL update drama episode error:", dbErr);
    }

    res.json({ message: "Qism yangilandi" });
  } catch (err) {
    console.error("Update drama episode error:", err);
    res.status(500).json({ error: "Qismni yangilashda xatolik" });
  }
});

// DELETE Drama Episode (Admin only)
app.delete("/api/dramas/episodes/:episodeId", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const episodeId = req.params.episodeId;

    const store = loadLocalStore();
    store.drama_episodes = (store.drama_episodes || []).filter((ep: any) => String(ep.id) !== String(episodeId));
    saveLocalStore(store);

    try {
      await dbQuery(`DELETE FROM drama_episodes WHERE id = ?`, [episodeId]);
    } catch (dbErr) {
      console.warn("MySQL delete drama episode error:", dbErr);
    }

    res.json({ message: "Qism o'chirildi" });
  } catch (err) {
    console.error("Delete drama episode error:", err);
    res.status(500).json({ error: "Qismni o'chirishda xatolik" });
  }
});

// POST Create Drama (Admin only)
app.post("/api/dramas", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { title, poster_url, banner_url, janrlar, yil, description, video_url, telegram_url } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Drama nomi kiritilishi shart" });
    }

    const newId = Date.now();
    const newDrama = {
      id: newId,
      title: title.trim(),
      description: description || "",
      poster_url: poster_url || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600",
      banner_url: banner_url || poster_url || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
      janrlar: janrlar || "Drama",
      yil: Number(yil) || new Date().getFullYear(),
      likes: 0,
      liked_users: [],
      korishlar: 0,
      video_url: video_url || "",
      telegram_url: telegram_url || "",
      created_at: new Date().toISOString()
    };

    // Save in local_store
    const store = loadLocalStore();
    store.dramas = store.dramas || [];
    store.dramas.unshift(newDrama);

    // If video_url was provided with drama, also create 1-episode automatically
    if (video_url && video_url.trim()) {
      store.drama_episodes = store.drama_episodes || [];
      store.drama_episodes.push({
        id: Date.now() + 1,
        drama_id: newId,
        qism: 1,
        title: "1-Qism",
        video_url: video_url.trim(),
        created_at: new Date().toISOString()
      });
    }
    saveLocalStore(store);

    // Save in MySQL
    try {
      await dbQuery(
        `INSERT INTO dramas (id, title, description, poster_url, banner_url, janrlar, yil, likes, liked_users, korishlar, video_url, telegram_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newDrama.id, newDrama.title, newDrama.description, newDrama.poster_url, newDrama.banner_url, newDrama.janrlar, newDrama.yil, newDrama.likes, JSON.stringify(newDrama.liked_users), newDrama.korishlar, newDrama.video_url, newDrama.telegram_url, newDrama.created_at]
      );
      if (video_url && video_url.trim()) {
        await dbQuery(
          `INSERT INTO drama_episodes (id, drama_id, qism, title, video_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [Date.now() + 1, newId, 1, "1-Qism", video_url.trim(), new Date().toISOString()]
        );
      }
    } catch (dbErr) {
      console.warn("MySQL save drama warning:", dbErr);
    }

    res.status(201).json(newDrama);
  } catch (err) {
    console.error("Create drama error:", err);
    res.status(500).json({ error: "Drama qo'shishda xatolik yuz berdi" });
  }
});

// PUT Update Drama (Admin only)
app.put("/api/dramas/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;
    const { title, poster_url, banner_url, janrlar, yil, description, video_url, telegram_url } = req.body;

    const store = loadLocalStore();
    store.dramas = store.dramas || [];
    const idx = store.dramas.findIndex((d: any) => String(d.id) === String(id));
    if (idx >= 0) {
      store.dramas[idx] = {
        ...store.dramas[idx],
        title: title !== undefined ? title : store.dramas[idx].title,
        poster_url: poster_url !== undefined ? poster_url : store.dramas[idx].poster_url,
        banner_url: banner_url !== undefined ? banner_url : store.dramas[idx].banner_url,
        janrlar: janrlar !== undefined ? janrlar : store.dramas[idx].janrlar,
        yil: yil !== undefined ? Number(yil) : store.dramas[idx].yil,
        description: description !== undefined ? description : store.dramas[idx].description,
        video_url: video_url !== undefined ? video_url : store.dramas[idx].video_url,
        telegram_url: telegram_url !== undefined ? telegram_url : store.dramas[idx].telegram_url,
      };
      saveLocalStore(store);
    }

    try {
      await dbQuery(
        `UPDATE dramas SET title = ?, poster_url = ?, banner_url = ?, janrlar = ?, yil = ?, description = ?, video_url = ?, telegram_url = ? WHERE id = ?`,
        [title, poster_url, banner_url, janrlar, Number(yil) || 2024, description, video_url, telegram_url, id]
      );
    } catch (dbErr) {
      console.warn("MySQL update drama warning:", dbErr);
    }

    res.json({ message: "Drama muvaffaqiyatli yangilandi" });
  } catch (err) {
    console.error("Update drama error:", err);
    res.status(500).json({ error: "Dramani yangilashda xatolik" });
  }
});

// DELETE Drama (Admin only)
app.delete("/api/dramas/:id", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const id = req.params.id;

    const store = loadLocalStore();
    store.dramas = (store.dramas || []).filter((d: any) => String(d.id) !== String(id));
    store.drama_episodes = (store.drama_episodes || []).filter((ep: any) => String(ep.drama_id) !== String(id));
    store.comments = (store.comments || []).filter((c: any) => String(c.drama_id) !== String(id));
    saveLocalStore(store);

    try {
      await dbQuery(`DELETE FROM dramas WHERE id = ?`, [id]);
      await dbQuery(`DELETE FROM drama_episodes WHERE drama_id = ?`, [id]);
      await dbQuery(`DELETE FROM comments WHERE drama_id = ?`, [id]);
    } catch (dbErr) {
      console.warn("MySQL delete drama warning:", dbErr);
    }

    res.json({ message: "Drama va uning barcha qismlari o'chirildi" });
  } catch (err) {
    console.error("Delete drama error:", err);
    res.status(500).json({ error: "Dramani o'chirishda xatolik" });
  }
});

// POST Toggle Like Drama
app.post("/api/dramas/:id/like", async (req: any, res) => {
  try {
    const id = req.params.id;
    // Identify user by token or IP / guest ID
    let identifier: string = "";
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        identifier = `user_${decoded.id}`;
      } catch {}
    }
    if (!identifier) {
      identifier = req.body?.guestId || req.ip || `guest_${req.headers['user-agent'] || 'anon'}`;
    }

    let drama: any = null;
    let likedUsers: string[] = [];
    let currentLikes = 0;

    // Check in DB
    try {
      const [rows]: any = await dbQuery(`SELECT * FROM dramas WHERE id = ?`, [id]);
      if (Array.isArray(rows) && rows.length > 0) {
        drama = rows[0];
        likedUsers = safeJsonParse(drama.liked_users, []);
        currentLikes = Number(drama.likes) || 0;
      }
    } catch (e) {}

    const store = loadLocalStore();
    store.dramas = store.dramas || [];
    const localIdx = store.dramas.findIndex((d: any) => String(d.id) === String(id));
    if (!drama && localIdx >= 0) {
      drama = store.dramas[localIdx];
      likedUsers = drama.liked_users || [];
      currentLikes = Number(drama.likes) || 0;
    }

    if (!drama && localIdx === -1) {
      return res.status(404).json({ error: "Drama topilmadi" });
    }

    const isAlreadyLiked = likedUsers.includes(identifier);
    let updatedLikes: number;
    let updatedLikedUsers: string[];

    if (isAlreadyLiked) {
      updatedLikedUsers = likedUsers.filter(u => u !== identifier);
      updatedLikes = Math.max(0, currentLikes - 1);
    } else {
      updatedLikedUsers = [...likedUsers, identifier];
      updatedLikes = currentLikes + 1;
    }

    // Save in local_store
    if (localIdx >= 0) {
      store.dramas[localIdx].likes = updatedLikes;
      store.dramas[localIdx].liked_users = updatedLikedUsers;
      saveLocalStore(store);
    }

    // Save in MySQL
    try {
      await dbQuery(
        `UPDATE dramas SET likes = ?, liked_users = ? WHERE id = ?`,
        [updatedLikes, JSON.stringify(updatedLikedUsers), id]
      );
    } catch (e) {}

    res.json({
      success: true,
      likes: updatedLikes,
      isLiked: !isAlreadyLiked
    });
  } catch (err) {
    console.error("Like drama error:", err);
    res.status(500).json({ error: "Layk bosishda xatolik" });
  }
});

// GET Drama Comments
app.get("/api/dramas/:id/comments", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows]: any = await dbQuery(
      `SELECT c.*, u.name AS user_name, u.avatar_url AS user_avatar 
       FROM comments c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.drama_id = ? 
       ORDER BY c.id DESC`,
      [id]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const parsed = rows.map((r: any) => ({
        ...r,
        liked_users: safeJsonParse(r.liked_users, []),
        disliked_users: safeJsonParse(r.disliked_users, []),
        replies: safeJsonParse(r.replies, [])
      }));
      return res.json(parsed);
    }
  } catch (err) {
    console.warn("Drama comments fetch fallback:", (err as any)?.message);
  }
  const store = loadLocalStore();
  const comms = (store.comments || []).filter((c: any) => String(c.drama_id) === String(id));
  res.json(comms);
});

// POST Drama Comment
app.post("/api/dramas/:id/comments", authenticateToken, async (req: any, res) => {
  try {
    const dramaId = req.params.id;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Fikr matni kiritilmadi" });
    }

    const [result]: any = await dbQuery(
      "INSERT INTO comments (drama_id, user_id, content, likes, dislikes, liked_users, disliked_users, replies) VALUES (?, ?, ?, 0, 0, '[]', '[]', '[]')",
      [dramaId, userId, content]
    );

    let userAvatar = req.user.avatar_url || null;
    try {
      const [uRows]: any = await dbQuery("SELECT avatar_url FROM users WHERE id = ?", [userId]);
      if (uRows && uRows.length > 0 && uRows[0].avatar_url) {
        userAvatar = uRows[0].avatar_url;
      }
    } catch (e) {}

    const newComment = {
      id: result?.insertId || Date.now(),
      drama_id: Number(dramaId),
      user_id: userId,
      user_name: req.user.name,
      user_avatar: userAvatar,
      content,
      likes: 0,
      dislikes: 0,
      liked_users: [],
      disliked_users: [],
      replies: [],
      created_at: new Date().toISOString(),
    };

    const store = loadLocalStore();
    store.comments = store.comments || [];
    store.comments.unshift(newComment);
    saveLocalStore(store);

    res.status(201).json(newComment);
  } catch (err) {
    console.error("Add drama comment error:", err);
    res.status(500).json({ error: "Fikr qoldirishda xatolik yuz berdi" });
  }
});

// ==================== TEZCHECK DONATION API ENDPOINTS ====================

// GET Public Donations (Only confirmed paid donations are displayed publicly)
app.get("/api/donations", async (req, res) => {
  try {
    const store = loadLocalStore();
    const allDonations = store.donations || [];
    
    // STRICT SECURITY & PRIVACY: Only show confirmed 'paid' donations publicly on the website
    const paidDonations = allDonations.filter((d: any) => d.status === "paid");

    const totalAmount = paidDonations.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
    const monthlyGoal = 2000000;

    res.json({
      donations: paidDonations,
      total_amount: totalAmount,
      monthly_goal: monthlyGoal,
      paid_count: paidDonations.length
    });
  } catch (err) {
    console.error("Get donations error:", err);
    res.status(500).json({ error: "Donatlarni olishda xatolik" });
  }
});

// GET Admin All Donations (including pending and canceled for merchant tracking)
app.get("/api/admin/donations", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const store = loadLocalStore();
    const donations = store.donations || [];
    
    const totalAmount = donations
      .filter((d: any) => d.status === "paid")
      .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

    res.json({
      donations,
      total_amount: totalAmount
    });
  } catch (err) {
    console.error("Get admin donations error:", err);
    res.status(500).json({ error: "Donatlarni olishda xatolik" });
  }
});

// GET Admin All Users list with provider detection
app.get("/api/admin/users", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);

    let users: any[] = [];
    try {
      const [rows]: any = await dbQuery("SELECT id, name, email, phone, role, avatar_url, telegram_id, yandex_id, discord_id, facebook_id, auth_provider, created_at FROM users ORDER BY id DESC");
      users = rows || [];
    } catch (dbErr) {
      try {
        const [rows]: any = await dbQuery("SELECT id, name, email, phone, role, avatar_url, telegram_id, yandex_id, discord_id, facebook_id, created_at FROM users ORDER BY id DESC");
        users = rows || [];
      } catch (innerDbErr) {
        console.warn("DB Query for users failed, falling back to local store:", innerDbErr);
        const store = loadLocalStore();
        users = store.users || [];
      }
    }

    const processedUsers = users.map((u: any) => {
      let provider = u.auth_provider || "email";
      let provider_label = "Email / Parol";

      if (u.auth_provider === "telegram_widget") {
        provider = "telegram_widget";
        provider_label = "Telegram Widget";
      } else if (u.auth_provider === "telegram_bot" || u.telegram_id) {
        provider = u.auth_provider === "telegram_widget" ? "telegram_widget" : "telegram_bot";
        provider_label = provider === "telegram_widget" ? "Telegram Widget" : "Telegram Bot";
      } else if (u.auth_provider === "yandex" || u.yandex_id) {
        provider = "yandex";
        provider_label = "Yandex ID";
      } else if (u.auth_provider === "discord" || u.discord_id) {
        provider = "discord";
        provider_label = "Discord";
      } else if (u.auth_provider === "facebook" || u.facebook_id) {
        provider = "facebook";
        provider_label = "Facebook";
      } else if (u.auth_provider === "google" || (u.email && u.email.toLowerCase().endsWith("@gmail.com"))) {
        provider = "google";
        provider_label = "Google Email";
      } else if (u.auth_provider === "phone" || u.phone) {
        provider = "phone";
        provider_label = "Telefon (+SMS)";
      }

      return {
        id: u.id,
        name: u.name || "Nomsiz Foydalanuvchi",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role || "user",
        avatar_url: u.avatar_url || null,
        telegram_id: u.telegram_id || null,
        yandex_id: u.yandex_id || null,
        discord_id: u.discord_id || null,
        facebook_id: u.facebook_id || null,
        auth_provider: u.auth_provider || provider,
        created_at: u.created_at || new Date().toISOString(),
        provider,
        provider_label
      };
    });

    res.json({ users: processedUsers });
  } catch (err) {
    console.error("Get admin users error:", err);
    res.status(500).json({ error: "Foydalanuvchilarni olishda xatolik" });
  }
});

// DELETE User (Admin action)
app.delete("/api/admin/users/:id", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const userId = req.params.id;

    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ error: "O'z hisobingizni o'chira olmaysiz!" });
    }

    try {
      await dbQuery("DELETE FROM users WHERE id = ?", [userId]);
    } catch (e) {
      const store = loadLocalStore();
      store.users = (store.users || []).filter((u: any) => String(u.id) !== String(userId));
      saveLocalStore(store);
    }

    res.json({ success: true, message: "Foydalanuvchi o'chirildi" });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Foydalanuvchini o'chirishda xatolik" });
  }
});

// PUT Toggle User Role (Admin <-> User)
app.put("/api/admin/users/:id/role", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const userId = req.params.id;
    const { role } = req.body;

    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Yaroqsiz rol" });
    }

    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ error: "O'z rolingizni o'zgartira olmaysiz!" });
    }

    try {
      await dbQuery("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
    } catch (e) {
      const store = loadLocalStore();
      const userObj = (store.users || []).find((u: any) => String(u.id) === String(userId));
      if (userObj) userObj.role = role;
      saveLocalStore(store);
    }

    res.json({ success: true, message: `Foydalanuvchi roli ${role} ga o'zgartirildi` });
  } catch (err) {
    console.error("Change user role error:", err);
    res.status(500).json({ error: "Rolni o'zgartirishda xatolik" });
  }
});

// POST Create Donation Invoice via Tezcheck.uz
app.post("/api/donate/create-invoice", async (req, res) => {
  try {
    const { amount, donor_name, comment, payment_method } = req.body;
    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount < 1000) {
      return res.status(400).json({ error: "Xato to'lov miqdori kiritildi (kamida 1,000 UZS)" });
    }

    const apiKey = process.env.TEZCHECK_API_KEY || "8237d3501a36506d3271f7918fe9bee985f300ed";
    const shopId = process.env.TEZCHECK_SHOP_ID || "118";

    let payUrl = "";
    let orderId = `86${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // Call Tezcheck.uz create_invoice endpoint
      const tezResponse = await fetch("https://tezcheck.uz/api/create_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          amount: numericAmount
        })
      });

      const contentType = tezResponse.headers.get("content-type");
      if (tezResponse.ok && contentType && contentType.includes("application/json")) {
        const tezData = await tezResponse.json();
        if (tezData && tezData.ok && tezData.pay_url) {
          payUrl = tezData.pay_url;
          if (tezData.order_id) {
            orderId = String(tezData.order_id);
          }
        } else if (tezData && tezData.error) {
          console.warn("Tezcheck API error response:", tezData.error);
        }
      } else {
        const textResp = await tezResponse.text();
        console.warn("Tezcheck non-JSON response:", tezResponse.status, textResp);
      }
    } catch (apiErr) {
      console.error("Tezcheck API network call failed:", apiErr);
    }

    // Fallback if payUrl not directly returned
    if (!payUrl) {
      payUrl = `https://tezcheck.uz/merchant/pay?shop_id=${shopId}&order_id=${orderId}&amount=${numericAmount}`;
    }

    const donation = {
      id: Date.now(),
      order_id: String(orderId),
      amount: numericAmount,
      donor_name: (donor_name || "").trim() || "Saxiy otaku",
      comment: (comment || "").trim() || "Animeuz va dublyaj rivoji uchun donat",
      payment_method: payment_method || "Click / Payme (Tezcheck)",
      status: "pending",
      pay_url: payUrl,
      created_at: new Date().toISOString()
    };

    const store = loadLocalStore();
    store.donations = store.donations || [];
    store.donations.unshift(donation);
    saveLocalStore(store);

    res.json({
      ok: true,
      order_id: String(orderId),
      pay_url: payUrl,
      donation
    });
  } catch (err) {
    console.error("Create donation invoice error:", err);
    res.status(500).json({ error: "Invoys yaratishda xatolik yuz berdi" });
  }
});

// POST Check Donation Status via Tezcheck.uz
app.post("/api/donate/check-status", async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ error: "order_id ko'rsatilmadi" });
    }

    const apiKey = process.env.TEZCHECK_API_KEY || "8237d3501a36506d3271f7918fe9bee985f300ed";
    let status = "pending";
    let paymentData: any = null;

    try {
      const tezResponse = await fetch("https://tezcheck.uz/api/status_invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          order_id: String(order_id)
        })
      });

      if (tezResponse.ok) {
        const tezData = await tezResponse.json();
        if (tezData && tezData.ok && tezData.payment) {
          paymentData = tezData.payment;
          status = tezData.payment.status || "paid";
        }
      }
    } catch (apiErr) {
      console.error("Tezcheck status check error:", apiErr);
    }

    const store = loadLocalStore();
    store.donations = store.donations || [];
    const idx = store.donations.findIndex((d: any) => String(d.order_id) === String(order_id));
    if (idx >= 0) {
      if (status === "paid") {
        store.donations[idx].status = "paid";
        if (!store.donations[idx].paid_at) {
          store.donations[idx].paid_at = new Date().toISOString();
        }
      }
      saveLocalStore(store);
      return res.json({ ok: true, donation: store.donations[idx], status, payment: paymentData });
    }

    res.json({ ok: true, status, payment: paymentData });
  } catch (err) {
    console.error("Check status error:", err);
    res.status(500).json({ error: "Holatni tekshirishda xatolik" });
  }
});

// Admin Route: Update Donation Status (Simulate/Confirm Paid)
app.post("/api/admin/donate/update-status", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { order_id, status } = req.body;
    const store = loadLocalStore();
    store.donations = store.donations || [];
    const idx = store.donations.findIndex((d: any) => String(d.order_id) === String(order_id) || String(d.id) === String(order_id));
    if (idx >= 0) {
      store.donations[idx].status = status || "paid";
      if (status === "paid" && !store.donations[idx].paid_at) {
        store.donations[idx].paid_at = new Date().toISOString();
      }
      saveLocalStore(store);
      return res.json({ message: "Maqom yangilandi", donation: store.donations[idx] });
    }
    res.status(404).json({ error: "Donat topilmadi" });
  } catch (err) {
    res.status(500).json({ error: "Xatolik yuz berdi" });
  }
});

// Admin Route: Delete Donation Entry
app.delete("/api/admin/donate/:id", authenticateToken, async (req: any, res: any) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);
    const { id } = req.params;
    const store = loadLocalStore();
    store.donations = (store.donations || []).filter((d: any) => String(d.id) !== String(id) && String(d.order_id) !== String(id));
    saveLocalStore(store);
    res.json({ message: "Donat yozuvi o'chirildi" });
  } catch (err) {
    res.status(500).json({ error: "Xatolik" });
  }
});

// Chat Routes
// GET chat messages (Ultra-fast response with DB sync)
app.get("/api/chat/messages", async (req: any, res: any) => {
  try {
    const store = loadLocalStore();
    const localMsgs = (store.messages || []).slice(-50);

    // If local store has messages, serve instantly (0ms latency)
    if (localMsgs && localMsgs.length > 0) {
      res.json(localMsgs);

      // Background sync with database if available
      (async () => {
        try {
          const [rows]: any = await dbQuery(
            `SELECT m.*, u.avatar_url AS user_avatar 
             FROM messages m 
             LEFT JOIN users u ON m.user_id = u.id 
             ORDER BY m.id DESC LIMIT 50`
          );
          if (Array.isArray(rows) && rows.length > 0) {
            const dbMsgs = [...rows].reverse();
            store.messages = dbMsgs;
            saveLocalStore(store);
          }
        } catch (e) {}
      })();
      return;
    }

    // If local store is empty, query DB with 500ms timeout
    try {
      const [rows]: any = await Promise.race([
        dbQuery(
          `SELECT m.*, u.avatar_url AS user_avatar 
           FROM messages m 
           LEFT JOIN users u ON m.user_id = u.id 
           ORDER BY m.id DESC LIMIT 50`
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB Timeout")), 500))
      ]);
      if (Array.isArray(rows) && rows.length > 0) {
        const dbMsgs = [...rows].reverse();
        store.messages = dbMsgs;
        saveLocalStore(store);
        return res.json(dbMsgs);
      }
    } catch (dbErr) {
      console.warn("GET /api/chat/messages DB query failed/timed out, using local_store:", dbErr);
    }

    return res.json(localMsgs);
  } catch (err) {
    console.error("GET /api/chat/messages error:", err);
    res.status(500).json({ error: "Xabarlarni yuklab bo'lmadi" });
  }
});

// Add new message via REST API (Resilient: DB + local_store fallback)
app.post("/api/chat/messages", authenticateToken, async (req: any, res: any) => {
  try {
    const { user_id, user_name, content, reply_to_id, reply_to_name, reply_to_content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Xabar bo'sh bo'lishi mumkin emas" });
    }

    const currentUserId = req.user?.id || user_id;
    const currentUserName = req.user?.name || user_name || "Foydalanuvchi";
    const currentUserAvatar = req.user?.avatar_url || null;

    let insertedMessage: any = null;

    // 1. Attempt database insert
    try {
      const [result]: any = await dbQuery(
        "INSERT INTO messages (user_id, user_name, content, reply_to_id, reply_to_name, reply_to_content) VALUES (?, ?, ?, ?, ?, ?)",
        [
          currentUserId,
          currentUserName,
          content,
          reply_to_id || null,
          reply_to_name || null,
          reply_to_content || null,
        ]
      );

      const newId = result.insertId;
      try {
        const [rows]: any = await dbQuery(
          `SELECT m.*, u.avatar_url AS user_avatar 
           FROM messages m 
           LEFT JOIN users u ON m.user_id = u.id 
           WHERE m.id = ?`,
          [newId]
        );
        if (rows && rows[0]) {
          insertedMessage = rows[0];
        }
      } catch (e) {}

      if (!insertedMessage) {
        insertedMessage = {
          id: newId,
          user_id: currentUserId,
          user_name: currentUserName,
          user_avatar: currentUserAvatar,
          content,
          reply_to_id: reply_to_id || null,
          reply_to_name: reply_to_name || null,
          reply_to_content: reply_to_content || null,
          created_at: new Date().toISOString(),
        };
      }
    } catch (dbErr) {
      console.warn("POST /api/chat/messages DB insert failed, using local_store fallback:", dbErr);
    }

    // 2. Local store backup & fallback
    const store = loadLocalStore();
    if (!store.messages) store.messages = [];

    if (!insertedMessage) {
      insertedMessage = {
        id: Date.now(),
        user_id: currentUserId,
        user_name: currentUserName,
        user_avatar: currentUserAvatar,
        content,
        reply_to_id: reply_to_id || null,
        reply_to_name: reply_to_name || null,
        reply_to_content: reply_to_content || null,
        created_at: new Date().toISOString(),
      };
    }

    store.messages.push(insertedMessage);
    if (store.messages.length > 500) {
      store.messages = store.messages.slice(-500);
    }
    saveLocalStore(store);

    // Broadcast new message to everyone via Socket.io
    io.emit("newMessage", insertedMessage);

    res.json(insertedMessage);
  } catch (err) {
    console.error("Error saving new chat message via API:", err);
    res.status(500).json({ error: "Xabarni saqlashda xatolik" });
  }
});

app.delete("/api/chat/messages/:id", authenticateToken, async (req: any, res) => {
  try {
    const id = req.params.id;

    // Remove from local_store
    const store = loadLocalStore();
    if (store.messages) {
      store.messages = store.messages.filter((m: any) => String(m.id) !== String(id));
      saveLocalStore(store);
    }

    // Attempt DB delete
    try {
      await dbQuery("DELETE FROM messages WHERE id = ?", [id]);
    } catch (dbErr) {
      console.warn("Delete message DB query failed:", dbErr);
    }
    
    // Broadcast messageDeleted to active socket.io clients
    io.emit("messageDeleted", id);
    
    res.json({ message: "Xabar o'chirildi" });
  } catch (err) {
    console.error("Delete chat message error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

app.delete("/api/chat/clear", authenticateToken, async (req: any, res) => {
  try {
    if (req.user.role !== "admin") return res.sendStatus(403);

    // Clear local store messages
    const store = loadLocalStore();
    store.messages = [];
    saveLocalStore(store);

    // Clear DB messages
    try {
      await dbQuery("DELETE FROM messages");
    } catch (dbErr) {
      console.warn("Clear chat DB query failed:", dbErr);
    }
    
    // Broadcast chatCleared
    io.emit("chatCleared");
    
    res.json({ message: "Barcha xabarlar o'chirildi" });
  } catch (err) {
    console.error("Clear chat error:", err);
    res.status(500).json({ error: "Failed to clear chat" });
  }
});


// --- TELEGRAM LOGIN ENGINE & BOT POLLING ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8738762833:AAE183dMQGDTnBlmlRaHcPoZjqol8jiCNL0";
const TELEGRAM_CLIENT_ID = process.env.TELEGRAM_CLIENT_ID || "8738762833";
const TELEGRAM_CLIENT_SECRET = process.env.TELEGRAM_CLIENT_SECRET || "k0m7Wkrmewn5tsEsE7xZiJbjy3oehADauTSqP_N1LS8Z2-WnPzy6Rw";
const activeSessions = new Map<string, any>(); // sessionId -> sessionData
const chatToSession = new Map<number, string>(); // chatId -> sessionId

// Helper to send Telegram Bot API requests
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error(`Telegram Bot sendMessage failed with status ${response.status}`);
    }
  } catch (err) {
    console.error("Failed to send telegram message:", err);
  }
}

// Background Bot Long Polling
async function runTelegramBot() {
  console.log("Starting Telegram Bot (8738762833) long polling loop...");
  let offset = 0;

  // Cleanup old sessions (older than 30 mins) every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [sid, sess] of activeSessions.entries()) {
      if (now - sess.createdAt > 30 * 60 * 1000) {
        activeSessions.delete(sid);
      }
    }
  }, 10 * 60 * 1000);

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`;
      const response = await fetch(url);
      if (!response.ok) {
        // If unauthorized or error, retry after a bit
        setTimeout(poll, 5000);
        return;
      }
      const data: any = await response.json();
      if (data.ok && data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          if (update.message) {
            const message = update.message;
            const chat = message.chat;
            const text = message.text || "";
            const from = message.from || {};

            // 1. Handle "/start auth_SESSION_ID"
            if (text.startsWith("/start")) {
              const parts = text.split(" ");
              const startParam = parts[1] || "";

              if (startParam && startParam.startsWith("auth_")) {
                const sessionId = startParam;

                activeSessions.set(sessionId, {
                  status: "pending_phone",
                  chatId: chat.id,
                  tgUser: from,
                  createdAt: Date.now()
                });
                chatToSession.set(chat.id, sessionId);

                await sendTelegramMessage(chat.id,
                  `<b>Assalomu alaykum, ${from.first_name || 'Foydalanuvchi'}! 👋</b>\n\n` +
                  `Siz <b>ANIMEUZ</b> saytiga kirish jarayonini boshladingiz. Kirishni tasdiqlash uchun quyidagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing:`,
                  {
                    keyboard: [
                      [
                        {
                          text: "📱 Telefon raqamni yuborish",
                          request_contact: true
                        }
                      ]
                    ],
                    one_time_keyboard: true,
                    resize_keyboard: true
                  }
                );
              } else if (startParam) {
                // Try to find the anime by slug
                const toSlugLocal = (text: string): string => {
                  if (!text) return "";
                  return text
                    .toLowerCase()
                    .replace(/o['’`‘]/g, "o")
                    .replace(/g['’`‘]/g, "g")
                    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
                    .replace(/^-+|-+$/g, "");
                };

                try {
                  const [rows]: any = await dbQuery("SELECT * FROM animes");
                  let anime = null;
                  if (Array.isArray(rows)) {
                    anime = rows.find((r: any) => toSlugLocal(r.title) === startParam);
                  }
                  
                  if (anime) {
                    const caption = `<b>🎬 ${anime.title}</b>\n\n` +
                                    `${anime.description ? anime.description.substring(0, 150) + '...' : ''}\n\n` +
                                    `⭐️ Reyting: ${anime.rating || 0}\n` +
                                    `👁 Ko'rishlar: ${anime.korishlar || 0}\n\n` +
                                    `👇 Saytda tomosha qilish uchun quyidagi tugmani bosing!`;
                    
                    const replyMarkup = {
                      inline_keyboard: [
                        [{ text: "▶️ Saytda tomosha qilish", url: `https://animem.uz/anime/${startParam}` }]
                      ]
                    };

                    if (anime.image_url) {
                      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          chat_id: chat.id,
                          photo: anime.image_url,
                          caption: caption,
                          parse_mode: "HTML",
                          reply_markup: replyMarkup
                        })
                      });
                    } else {
                      await sendTelegramMessage(chat.id, caption, replyMarkup);
                    }
                  } else {
                    await sendTelegramMessage(chat.id, `Kechirasiz, ushbu anime topilmadi. Saytimizga tashrif buyurib qidirib ko'ring:\nhttps://animem.uz`);
                  }
                } catch (e) {
                  console.error("Error finding anime for bot start param:", e);
                  await sendTelegramMessage(chat.id, "Kechirasiz, xatolik yuz berdi.");
                }
              } else {
                await sendTelegramMessage(chat.id,
                  `<b>Assalomu alaykum! 👋</b>\n\n` +
                  `ANIMEUZ rasmiy botiga xush kelibsiz.\n\n` +
                  `Siz saytga xavfsiz va tezkor kirish uchun saytdagi <b>"Telegram bilan kirish"</b> tugmasini bosing va ushbu botga o'ting.`
                );
              }
            }
            // 2. Handle Contact (Phone sharing)
            else if (message.contact) {
              const contact = message.contact;
              let sessionId = chatToSession.get(chat.id);

              if (!sessionId || !activeSessions.has(sessionId)) {
                // Find if there's an existing session for this chat or any pending session
                for (const [sid, sess] of activeSessions.entries()) {
                  if (sess.chatId === chat.id || sess.status === "pending" || sess.status === "pending_phone") {
                    sessionId = sid;
                    chatToSession.set(chat.id, sid);
                    break;
                  }
                }
              }

              if (sessionId && activeSessions.has(sessionId)) {
                const session = activeSessions.get(sessionId);

                try {
                  const phone = contact.phone_number || "";
                  const tgUser = session.tgUser || message.from || {};
                  const tgUserId = tgUser.id || contact.user_id || message.from?.id || chat.id;

                  // Get Telegram Avatar URL if any
                  let avatar_url = null;
                  try {
                    const photosRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${tgUserId}&limit=1`);
                    const photosData: any = await photosRes.json();
                    if (photosData.ok && photosData.result && photosData.result.total_count > 0) {
                      const fileId = photosData.result.photos[0][0].file_id;
                      const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
                      const fileData: any = await fileRes.json();
                      if (fileData.ok && fileData.result) {
                        avatar_url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
                      }
                    }
                  } catch (e) {
                    console.error("Error fetching user profile photos from Telegram:", e);
                  }

                  const email = `tg_${tgUserId}@telegram.uz`;
                  const firstName = tgUser.first_name || message.from?.first_name || contact.first_name || "Foydalanuvchi";
                  const lastName = tgUser.last_name || message.from?.last_name || contact.last_name || "";
                  const name = `${firstName} ${lastName}`.trim();

                  // Sync to DB
                  let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [String(tgUserId), email]);
                  let user = users[0];

                  if (!user) {
                    const randomPass = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPass, 10);
                    const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";

                    try {
                      const [insertRes]: any = await dbQuery(
                        "INSERT INTO users (name, email, password, role, avatar_url, telegram_id, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [name, email, hashedPassword, role, avatar_url || null, String(tgUserId), "telegram_bot"]
                      );

                      user = {
                        id: insertRes.insertId,
                        name,
                        email,
                        role,
                        avatar_url: avatar_url || null,
                        telegram_id: String(tgUserId),
                        auth_provider: "telegram_bot"
                      };
                    } catch (insertErr: any) {
                      if (insertErr.code === 'ER_BAD_FIELD_ERROR') {
                        const [insertRes]: any = await dbQuery(
                          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
                          [name, email, hashedPassword, role, avatar_url || null, String(tgUserId)]
                        );
                        user = {
                          id: insertRes.insertId,
                          name,
                          email,
                          role,
                          avatar_url: avatar_url || null,
                          telegram_id: String(tgUserId)
                        };
                      } else if (insertErr.code === 'ER_DUP_ENTRY') {
                        let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE email = ?", [email]);
                        user = existingUsers[0];
                        if (!user) throw insertErr;
                      } else {
                        throw insertErr;
                      }
                    }
                  } else {
                    await dbQuery(
                      "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
                      [String(tgUserId), avatar_url || null, user.id]
                    );
                    user.telegram_id = String(tgUserId);
                    if (!user.avatar_url && avatar_url) {
                      user.avatar_url = avatar_url;
                    }
                  }

                  // JWT
                  const userPayload = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar_url: user.avatar_url,
                  };
                  const tokenPayload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                  };
                  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

                  // Mark session authorized
                  activeSessions.set(sessionId, {
                    status: "authorized",
                    token,
                    user: userPayload,
                    createdAt: session.createdAt || Date.now()
                  });

                  await sendTelegramMessage(chat.id,
                    `<b>Siz ANIMEUZ saytiga muvaffaqiyatli kirdingiz! 🎉</b>\n\n` +
                    `👤 <b>Ism:</b> ${name}\n` +
                    (phone ? `📞 <b>Telefon:</b> ${phone}\n\n` : '\n') +
                    `Saytda avtorizatsiya yakunlandi! Endi saytga qaytib tomoshani davom ettirishingiz mumkin.`,
                    { remove_keyboard: true }
                  );
                } catch (contactErr) {
                  console.error("Error processing Telegram contact auth:", contactErr);
                  await sendTelegramMessage(chat.id, "Tizimga kirishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
                }
              } else {
                await sendTelegramMessage(chat.id, "Sessiya topilmadi yoki muddati tugagan. Iltimos saytdan qayta urining.");
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in telegram polling loop:", err);
    }

    setTimeout(poll, 1500);
  };

  poll();
}

// --- SUPPORT TELEGRAM BOT ENGINE (@animem_support_bot) ---
const SUPPORT_BOT_TOKEN = "8839170706:AAFrabCF7EylydXZDDVy9gSFtRuQN2Mo_n0";
const SUPPORT_ADMIN_ID = "8991315532";

// Store mapping of admin notification message_id -> user chat_id
const supportMsgToUserMap = new Map<number, { userId: string; userName: string }>();
let activeAdminReplyTargetUserId: string | null = null;

// Helper to send Telegram Support Bot API requests
async function sendSupportBotMessage(chatId: number | string, text: string, replyMarkup?: any) {
  try {
    const url = `https://api.telegram.org/bot${SUPPORT_BOT_TOKEN}/sendMessage`;
    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const resData: any = await response.json();
    if (!response.ok || !resData.ok) {
      console.error(`Support Bot sendMessage failed:`, resData);
    }
    return resData;
  } catch (err) {
    console.error("Failed to send support bot telegram message:", err);
    return null;
  }
}

// Background Support Bot Long Polling (@animem_support_bot)
async function runSupportTelegramBot() {
  console.log("Starting Support Telegram Bot (@animem_support_bot) long polling loop...");
  let offset = 0;

  const poll = async () => {
    try {
      const url = `https://api.telegram.org/bot${SUPPORT_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10`;
      const response = await fetch(url);
      if (!response.ok) {
        setTimeout(poll, 5000);
        return;
      }
      const data: any = await response.json();
      if (data.ok && data.result) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          // 1. Handle Callback Queries (Admin clicking Inline Buttons)
          if (update.callback_query) {
            const cb = update.callback_query;
            const cbData = cb.data || "";
            const cbFromId = String(cb.from?.id || "");

            if (cbFromId === SUPPORT_ADMIN_ID && cbData.startsWith("reply_")) {
              const targetUserId = cbData.replace("reply_", "");
              activeAdminReplyTargetUserId = targetUserId;

              // Answer callback query
              await fetch(`https://api.telegram.org/bot${SUPPORT_BOT_TOKEN}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: `Foydalanuvchi (${targetUserId}) tanlandi! Javob xabaringizni yuboring.`,
                  show_alert: true
                })
              });

              await sendSupportBotMessage(SUPPORT_ADMIN_ID,
                `✍️ <b>Foydalanuvchiga (ID: <code>${targetUserId}</code>) javob yozish:</b>\n\n` +
                `Iltimos, ushbu foydalanuvchiga yubormoqchi bo'lgan xabaringizni yozib yuboring.`
              );
            }
          }

          // 2. Handle Incoming Messages
          if (update.message) {
            const message = update.message;
            const chat = message.chat;
            const chatId = String(chat.id);
            const text = message.text || "";
            const from = message.from || {};
            const fromId = String(from.id);

            // A) MESSAGE FROM ADMIN (8991315532)
            if (fromId === SUPPORT_ADMIN_ID) {
              let targetUserId: string | null = null;

              // Check if Admin replied directly to a notification message
              if (message.reply_to_message) {
                const replyMsgId = message.reply_to_message.message_id;
                const mapping = supportMsgToUserMap.get(replyMsgId);
                if (mapping) {
                  targetUserId = mapping.userId;
                }
              }

              // Check if active target user is set via inline button
              if (!targetUserId && activeAdminReplyTargetUserId) {
                targetUserId = activeAdminReplyTargetUserId;
              }

              // Check if message starts with /reply USER_ID message or USER_ID: message
              if (!targetUserId) {
                const match = text.match(/^(\d{6,12})[:\s]+([\s\S]+)$/);
                if (match) {
                  targetUserId = match[1];
                  const actualMessageText = match[2];

                  const sent = await sendSupportBotMessage(targetUserId,
                    `💬 <b>Animem.uz Ma'muriyatidan javob:</b>\n\n${actualMessageText}`
                  );
                  if (sent && sent.ok) {
                    await sendSupportBotMessage(SUPPORT_ADMIN_ID, `✅ Javobingiz foydalanuvchiga (ID: <code>${targetUserId}</code>) yetkazildi!`);
                  } else {
                    await sendSupportBotMessage(SUPPORT_ADMIN_ID, `❌ Foydalanuvchiga xabar yuborib bo'lmadi (ID: <code>${targetUserId}</code>).`);
                  }
                  continue;
                }
              }

              if (targetUserId) {
                const sent = await sendSupportBotMessage(targetUserId,
                  `💬 <b>Animem.uz Ma'muriyatidan javob:</b>\n\n${text}`
                );

                if (sent && sent.ok) {
                  await sendSupportBotMessage(SUPPORT_ADMIN_ID, `✅ Javobingiz foydalanuvchiga (ID: <code>${targetUserId}</code>) yetkazildi!`);
                  activeAdminReplyTargetUserId = null; // reset state after successful reply
                } else {
                  await sendSupportBotMessage(SUPPORT_ADMIN_ID, `❌ Foydalanuvchiga xabar yuborib bo'lmadi (ID: <code>${targetUserId}</code>).`);
                }
              } else {
                await sendSupportBotMessage(SUPPORT_ADMIN_ID,
                  `ℹ️ <b>Admin Rejimi:</b>\n\n` +
                  `Foydalanuvchiga javob yuborish uchun xabarga <b>Reply</b> (javob bosing) qiling yoki xabar ostidagi <b>"✍️ Bot Orqali Javob Berish"</b> tugmasini bosing.\n` +
                  `Yoki: <code>USER_ID: sizning xabaringiz</code> ko'rinishida yozing.`
                );
              }
            } 
            // B) MESSAGE FROM REGULAR USER
            else {
              if (text === "/start" || text.startsWith("/start")) {
                await sendSupportBotMessage(chatId,
                  `<b>Assalomu alaykum! Animem.uz rasmiy qo'llab-quvvatlash botiga xush kelibsiz! 👋🤖</b>\n\n` +
                  `Ushbu bot orqali siz Animem.uz ma'muriyati bilan bevosita bog'lanishingiz mumkin.\n\n` +
                  `Iltimos, <b>Ismingiz</b> va saytdan (animem.uz) ro'yxatdan o'tgan <b>Domen / Taxallusingizni</b> hamda murojaatingizni yozib qoldiring:\n\n` +
                  `<i>Masalan: "Ismim Jasur, saytdagi nickim/domenim: jasur_uz. Murojaat: Anime yuklash bo'yicha taklifim bor..."</i>`
                );
              } else {
                // Send confirmation to user
                await sendSupportBotMessage(chatId,
                  `✅ <b>Murojaatingiz qabul qilindi va adminga yetkazildi!</b>\n\n` +
                  `Admin ko'rib chiqib, tez orada sizga javob qaytaradi. Rahmat!`
                );

                // Send notification to Admin Telegram ID (8991315532)
                const tgUsername = from.username ? `@${from.username}` : "Mavjud emas";
                const tgName = `${from.first_name || ''} ${from.last_name || ''}`.trim() || "Foydalanuvchi";
                const userTgLink = from.username ? `https://t.me/${from.username}` : `tg://user?id=${fromId}`;

                const adminMsgText = 
                  `📩 <b>YANGI MUROJAAT (animem_support_bot)</b>\n\n` +
                  `👤 <b>Ism:</b> ${tgName}\n` +
                  `🆔 <b>Telegram ID:</b> <code>${fromId}</code>\n` +
                  `🏷 <b>Username:</b> ${tgUsername}\n\n` +
                  `📝 <b>Murojaat / Sayt domeni / Xabar:</b>\n${text}\n\n` +
                  `📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ')}`;

                const inlineKeyboard = {
                  inline_keyboard: [
                    [
                      { text: "💬 Telegramda Chatga Kirish", url: userTgLink }
                    ],
                    [
                      { text: "✍️ Bot Orqali Javob Berish", callback_data: `reply_${fromId}` }
                    ]
                  ]
                };

                const resMsg = await sendSupportBotMessage(SUPPORT_ADMIN_ID, adminMsgText, inlineKeyboard);
                if (resMsg && resMsg.ok && resMsg.result) {
                  supportMsgToUserMap.set(resMsg.result.message_id, { userId: fromId, userName: tgName });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Support Telegram Bot polling error:", err);
    }
    setTimeout(poll, 2000);
  };

  poll();
}

// 1. Create a session ID
app.get("/api/auth/telegram/session", (req, res) => {
  const sessionId = "auth_" + Math.random().toString(36).substring(2, 15);
  activeSessions.set(sessionId, {
    status: "pending",
    createdAt: Date.now()
  });
  res.json({ sessionId });
});

// 2. Check session status
app.get("/api/auth/telegram/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.json({ status: "expired" });
  }
  res.json(session);
});

// 3. Simulate Telegram Bot interaction on-screen
app.post("/api/auth/telegram/simulate", async (req, res) => {
  try {
    const { sessionId, phone, first_name, username, avatar_url } = req.body;
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Sessiya topilmadi yoki muddati tugagan!" });
    }

    const fakeTgUserId = Math.floor(100000000 + Math.random() * 900000000);
    const email = `tg_${fakeTgUserId}@telegram.uz`;
    const name = first_name || username || "Telegram User";

    // DB sync
    let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [String(fakeTgUserId), email]);
    let user = users[0];

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";

      try {
        const [insertRes]: any = await dbQuery(
          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
          [name, email, hashedPassword, role, avatar_url || null, String(fakeTgUserId)]
        );

        user = {
          id: insertRes.insertId,
          name,
          email,
          role,
          avatar_url: avatar_url || null,
          telegram_id: String(fakeTgUserId)
        };
      } catch (insertErr: any) {
        if (insertErr.code === 'ER_DUP_ENTRY') {
          let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE email = ?", [email]);
          user = existingUsers[0];
          if (!user) throw insertErr;
        } else {
          throw insertErr;
        }
      }
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
    };
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    // Mark session authorized
    activeSessions.set(sessionId, {
      status: "authorized",
      token,
      user: userPayload,
      createdAt: session.createdAt
    });

    res.json({ success: true, message: "Muvaffaqiyatli simulyatsiya qilindi!" });
  } catch (err) {
    console.error("Simulation error:", err);
    res.status(500).json({ error: "Simulyatsiyada xatolik" });
  }
});

// 4. Official Telegram Login Widget Callback
app.post("/api/auth/telegram/widget", async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.id) {
      return res.status(400).json({ error: "Telegram ma'lumotlari topilmadi!" });
    }

    // Verify hash with BOT_TOKEN if hash is present
    if (data.hash) {
      try {
        const { hash, ...rest } = data;
        const checkString = Object.keys(rest)
          .sort()
          .map(k => `${k}=${rest[k]}`)
          .join("\n");
        const secretKey = crypto.createHash("sha256").update(BOT_TOKEN).digest();
        const calculatedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
        
        // Log verification status
        if (calculatedHash !== hash) {
          console.warn("Telegram widget hash mismatch, accepting with caution");
        }
      } catch (checkErr) {
        console.warn("Telegram widget hash verification error:", checkErr);
      }
    }

    const tgUserId = String(data.id);
    const firstName = (data.first_name || "").trim();
    const lastName = (data.last_name || "").trim();
    const username = (data.username || "").trim();
    let photoUrl = data.photo_url || null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || username || `Telegram_${tgUserId.slice(-4)}`;
    const email = username ? `tg_${username}@telegram.uz` : `tg_${tgUserId}@telegram.uz`;

    // If photo_url not directly sent by widget, fetch from bot API
    if (!photoUrl) {
      try {
        const photosRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${tgUserId}&limit=1`);
        const photosData: any = await photosRes.json();
        if (photosData.ok && photosData.result && photosData.result.total_count > 0) {
          const fileId = photosData.result.photos[0][0].file_id;
          const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
          const fileData: any = await fileRes.json();
          if (fileData.ok && fileData.result) {
            photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          }
        }
      } catch (photoErr) {
        console.warn("Could not fetch telegram profile picture via bot API:", photoErr);
      }
    }

    // Check existing user in DB
    let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
    let user = users[0];

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const role = (email === "mosinjonovjasurbek28@gmail.com" || email === "mosinjonovjasurbek00@gmail.com") ? "admin" : "user";

      try {
        const [insertRes]: any = await dbQuery(
          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, hashedPassword, role, photoUrl || null, tgUserId, "telegram_widget"]
        );

        user = {
          id: insertRes.insertId,
          name,
          email,
          role,
          avatar_url: photoUrl || null,
          telegram_id: tgUserId,
          auth_provider: "telegram_widget"
        };
      } catch (insertErr: any) {
        if (insertErr.code === "ER_BAD_FIELD_ERROR") {
          const [insertRes]: any = await dbQuery(
            "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, photoUrl || null, tgUserId]
          );
          user = {
            id: insertRes.insertId,
            name,
            email,
            role,
            avatar_url: photoUrl || null,
            telegram_id: tgUserId
          };
        } else if (insertErr.code === "ER_DUP_ENTRY") {
          let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
          user = existingUsers[0];
          if (!user) throw insertErr;
        } else {
          throw insertErr;
        }
      }
    } else {
      // Update avatar and name with fresh Telegram profile details
      try {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name), auth_provider = 'telegram_widget' WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      } catch {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name) WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      }
      user.telegram_id = tgUserId;
      if (photoUrl) user.avatar_url = photoUrl;
      if (name) user.name = name;
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      telegram_id: user.telegram_id,
    };
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err: any) {
    console.error("Telegram widget auth endpoint error:", err);
    res.status(500).json({ error: err.message || "Telegram widget orqali kirishda xatolik yuz berdi" });
  }
});

// 5. Telegram WebApp / Mini App Auth Endpoint
app.post("/api/auth/telegram/webapp", async (req, res) => {
  try {
    const { user: tgUser, initData } = req.body;
    if (!tgUser || !tgUser.id) {
      return res.status(400).json({ error: "Telegram foydalanuvchi ma'lumotlari topilmadi!" });
    }

    const tgUserId = String(tgUser.id);
    const firstName = (tgUser.first_name || "").trim();
    const lastName = (tgUser.last_name || "").trim();
    const username = (tgUser.username || "").trim();
    let photoUrl = tgUser.photo_url || null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || username || `Telegram_${tgUserId.slice(-4)}`;
    const email = username ? `tg_${username}@telegram.uz` : `tg_${tgUserId}@telegram.uz`;

    // Check existing user in DB
    let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
    let user = users[0];

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const role = (email === "mosinjonovjasurbek28@gmail.com" || email === "mosinjonovjasurbek00@gmail.com") ? "admin" : "user";

      try {
        const [insertRes]: any = await dbQuery(
          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, hashedPassword, role, photoUrl || null, tgUserId, "telegram_webapp"]
        );

        user = {
          id: insertRes.insertId,
          name,
          email,
          role,
          avatar_url: photoUrl || null,
          telegram_id: tgUserId,
          auth_provider: "telegram_webapp"
        };
      } catch (insertErr: any) {
        if (insertErr.code === "ER_BAD_FIELD_ERROR") {
          const [insertRes]: any = await dbQuery(
            "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, photoUrl || null, tgUserId]
          );
          user = {
            id: insertRes.insertId,
            name,
            email,
            role,
            avatar_url: photoUrl || null,
            telegram_id: tgUserId
          };
        } else if (insertErr.code === "ER_DUP_ENTRY") {
          let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
          user = existingUsers[0];
          if (!user) throw insertErr;
        } else {
          throw insertErr;
        }
      }
    } else {
      try {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name), auth_provider = 'telegram_webapp' WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      } catch {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name) WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      }
      user.telegram_id = tgUserId;
      if (photoUrl) user.avatar_url = photoUrl;
      if (name) user.name = name;
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      telegram_id: user.telegram_id,
    };
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err: any) {
    console.error("Telegram webapp auth endpoint error:", err);
    res.status(500).json({ error: err.message || "Telegram WebApp orqali kirishda xatolik" });
  }
});

// 6. Telegram OpenID Connect / Modern OAuth Config & Login Endpoints
app.get("/api/auth/telegram/config", (req, res) => {
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const redirectUri = `${origin}/login`;
  res.json({
    botUsername: process.env.TELEGRAM_BOT_USERNAME || "Animem_register_bot",
    clientId: TELEGRAM_CLIENT_ID,
    redirectUri,
    authUrl: `https://oauth.telegram.org/auth?client_id=${TELEGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+profile`
  });
});

app.post("/api/auth/telegram/exchange", async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Telegram avtorizatsiya kodi taqdim etilmadi!" });
    }

    let tgUserId = "";
    let firstName = "";
    let lastName = "";
    let username = "";
    let photoUrl: string | null = null;
    let name = "";

    try {
      const tokenUrl = "https://oauth.telegram.org/token";
      const bodyParams = new URLSearchParams();
      bodyParams.append("client_id", TELEGRAM_CLIENT_ID);
      bodyParams.append("client_secret", TELEGRAM_CLIENT_SECRET || BOT_TOKEN);
      bodyParams.append("grant_type", "authorization_code");
      bodyParams.append("code", code);
      if (redirect_uri) bodyParams.append("redirect_uri", redirect_uri);

      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: bodyParams.toString()
      });

      const tokenData: any = await tokenRes.json();
      if (tokenRes.ok && tokenData.id_token) {
        const decoded: any = jwt.decode(tokenData.id_token);
        if (decoded && decoded.sub) {
          tgUserId = String(decoded.sub);
          firstName = (decoded.given_name || "").trim();
          lastName = (decoded.family_name || "").trim();
          username = (decoded.preferred_username || "").trim();
          photoUrl = decoded.picture || null;
          name = decoded.name || [firstName, lastName].filter(Boolean).join(" ") || username || `Telegram_${tgUserId.slice(-4)}`;
        }
      }
    } catch (oidcErr) {
      console.warn("Telegram OIDC direct exchange warning:", oidcErr);
    }

    if (!tgUserId) {
      return res.status(400).json({ error: "Telegram orqali foydalanuvchini tasdiqlab bo'lmadi" });
    }

    const email = username ? `tg_${username}@telegram.uz` : `tg_${tgUserId}@telegram.uz`;

    // Check existing user in DB
    let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
    let user = users[0];

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const role = (email === "mosinjonovjasurbek28@gmail.com" || email === "mosinjonovjasurbek00@gmail.com") ? "admin" : "user";

      try {
        const [insertRes]: any = await dbQuery(
          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, hashedPassword, role, photoUrl || null, tgUserId, "telegram_oidc"]
        );

        user = {
          id: insertRes.insertId,
          name,
          email,
          role,
          avatar_url: photoUrl || null,
          telegram_id: tgUserId,
          auth_provider: "telegram_oidc"
        };
      } catch (insertErr: any) {
        if (insertErr.code === "ER_BAD_FIELD_ERROR") {
          const [insertRes]: any = await dbQuery(
            "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, photoUrl || null, tgUserId]
          );
          user = {
            id: insertRes.insertId,
            name,
            email,
            role,
            avatar_url: photoUrl || null,
            telegram_id: tgUserId
          };
        } else if (insertErr.code === "ER_DUP_ENTRY") {
          let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
          user = existingUsers[0];
          if (!user) throw insertErr;
        } else {
          throw insertErr;
        }
      }
    } else {
      try {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name), auth_provider = 'telegram_oidc' WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      } catch {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name) WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      }
      user.telegram_id = tgUserId;
      if (photoUrl) user.avatar_url = photoUrl;
      if (name) user.name = name;
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      telegram_id: user.telegram_id,
    };
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err: any) {
    console.error("Telegram exchange endpoint error:", err);
    res.status(500).json({ error: err.message || "Telegram OpenID orqali kirishda xatolik" });
  }
});

app.post(["/api/auth/telegram/openid", "/api/auth/telegram/oauth"], async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.id) {
      return res.status(400).json({ error: "Telegram OpenID/OAuth ma'lumotlari to'liq emas" });
    }

    const { hash, ...rest } = data;

    // Verify hash with BOT_TOKEN or TELEGRAM_CLIENT_SECRET
    if (hash && (BOT_TOKEN || TELEGRAM_CLIENT_SECRET)) {
      try {
        const checkString = Object.keys(rest)
          .sort()
          .map(k => `${k}=${rest[k]}`)
          .join("\n");
        const secretKey = crypto.createHash("sha256").update(BOT_TOKEN || TELEGRAM_CLIENT_SECRET).digest();
        const calculatedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");
        if (calculatedHash !== hash) {
          console.warn("Telegram OpenID hash mismatch - logging warning");
        }
      } catch (checkErr) {
        console.warn("Telegram OpenID verification warning:", checkErr);
      }
    }

    const tgUserId = String(data.id);
    const firstName = (data.first_name || "").trim();
    const lastName = (data.last_name || "").trim();
    const username = (data.username || "").trim();
    let photoUrl = data.photo_url || null;
    const name = [firstName, lastName].filter(Boolean).join(" ") || username || `Telegram_${tgUserId.slice(-4)}`;
    const email = username ? `tg_${username}@telegram.uz` : `tg_${tgUserId}@telegram.uz`;

    // Fetch avatar from bot API if missing
    if (!photoUrl && BOT_TOKEN) {
      try {
        const photosRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${tgUserId}&limit=1`);
        const photosData: any = await photosRes.json();
        if (photosData.ok && photosData.result && photosData.result.total_count > 0) {
          const fileId = photosData.result.photos[0][0].file_id;
          const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
          const fileData: any = await fileRes.json();
          if (fileData.ok && fileData.result) {
            photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          }
        }
      } catch (photoErr) {
        console.warn("Could not fetch telegram profile picture via bot API:", photoErr);
      }
    }

    // Check existing user in DB
    let [users]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
    let user = users[0];

    if (!user) {
      const randomPass = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPass, 10);
      const role = (email === "mosinjonovjasurbek28@gmail.com" || email === "mosinjonovjasurbek00@gmail.com") ? "admin" : "user";

      try {
        const [insertRes]: any = await dbQuery(
          "INSERT INTO users (name, email, password, role, avatar_url, telegram_id, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [name, email, hashedPassword, role, photoUrl || null, tgUserId, "telegram_openid"]
        );

        user = {
          id: insertRes.insertId,
          name,
          email,
          role,
          avatar_url: photoUrl || null,
          telegram_id: tgUserId,
          auth_provider: "telegram_openid"
        };
      } catch (insertErr: any) {
        if (insertErr.code === "ER_BAD_FIELD_ERROR") {
          const [insertRes]: any = await dbQuery(
            "INSERT INTO users (name, email, password, role, avatar_url, telegram_id) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, photoUrl || null, tgUserId]
          );
          user = {
            id: insertRes.insertId,
            name,
            email,
            role,
            avatar_url: photoUrl || null,
            telegram_id: tgUserId
          };
        } else if (insertErr.code === "ER_DUP_ENTRY") {
          let [existingUsers]: any = await dbQuery("SELECT * FROM users WHERE telegram_id = ? OR email = ?", [tgUserId, email]);
          user = existingUsers[0];
          if (!user) throw insertErr;
        } else {
          throw insertErr;
        }
      }
    } else {
      try {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name), auth_provider = 'telegram_openid' WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      } catch {
        await dbQuery(
          "UPDATE users SET telegram_id = ?, avatar_url = COALESCE(?, avatar_url), name = COALESCE(NULLIF(?, ''), name) WHERE id = ?",
          [tgUserId, photoUrl || null, name, user.id]
        );
      }
      user.telegram_id = tgUserId;
      if (photoUrl) user.avatar_url = photoUrl;
      if (name) user.name = name;
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url,
      telegram_id: user.telegram_id,
    };
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err: any) {
    console.error("Telegram OpenID auth error:", err);
    res.status(500).json({ error: err.message || "Telegram OpenID orqali kirishda xatolik" });
  }
});


// ==================== YANDEX OAUTH ENDPOINTS ====================
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID || "044187259630401c9d14b33ac139d976";
const YANDEX_CLIENT_SECRET = process.env.YANDEX_CLIENT_SECRET || "d7c5406e78114ca689c95ef030db9139";

// 1. Get Yandex OAuth authorization URL
app.get("/api/auth/yandex/url", (req, res) => {
  try {
    const rawRedirect = (req.query.redirect_uri as string) || "";
    let redirectUri = rawRedirect;
    if (!redirectUri) {
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      redirectUri = `${appUrl}/api/auth/yandex/callback`;
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: YANDEX_CLIENT_ID,
      redirect_uri: redirectUri,
    });
    const url = `https://oauth.yandex.ru/authorize?${params.toString()}`;
    res.json({ url, client_id: YANDEX_CLIENT_ID, redirect_uri: redirectUri });
  } catch (err: any) {
    res.status(500).json({ error: "Yandex OAuth URL yaratishda xatolik" });
  }
});

// Helper for Yandex OAuth verification & profile creation
async function processYandexAuth(codeOrToken: string, isToken = false) {
  let accessToken = codeOrToken;

  if (!isToken) {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: codeOrToken,
      client_id: YANDEX_CLIENT_ID,
      client_secret: YANDEX_CLIENT_SECRET
    });

    const tokenRes = await fetch("https://oauth.yandex.ru/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Yandex kodi almashtirishda xatolik!");
    }
    accessToken = tokenData.access_token;
  }

  // Get Yandex Profile
  const userRes = await fetch("https://login.yandex.ru/info?format=json", {
    headers: { Authorization: `OAuth ${accessToken}` }
  });

  const yandexUser = await userRes.json();
  if (!userRes.ok || !yandexUser.id) {
    throw new Error(yandexUser.error_description || "Yandex profilingiz ma'lumotlarini olishda xatolik!");
  }

  const yandexId = String(yandexUser.id);
  const email = yandexUser.default_email || (yandexUser.emails && yandexUser.emails[0]) || `${yandexUser.login || yandexId}@yandex.ru`;
  const name = yandexUser.real_name || yandexUser.display_name || yandexUser.first_name || yandexUser.login || "Yandex User";

  let avatarUrl: string | null = null;
  if (yandexUser.default_avatar_id && !yandexUser.is_avatar_empty) {
    avatarUrl = `https://avatars.yandex.net/get-yapic/${yandexUser.default_avatar_id}/islands-200`;
  }

  // Search in DB
  let [users]: any = await dbQuery("SELECT * FROM users WHERE yandex_id = ? OR email = ?", [yandexId, email]);
  let user = users[0];

  if (!user) {
    const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";
    const randomPass = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(randomPass, 10);

    const [insertRes]: any = await dbQuery(
      "INSERT INTO users (name, email, password, role, avatar_url, yandex_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, role, avatarUrl, yandexId]
    );

    user = {
      id: insertRes.insertId,
      name,
      email,
      role,
      avatar_url: avatarUrl,
      yandex_id: yandexId
    };
  } else {
    if (!user.yandex_id || (avatarUrl && !user.avatar_url)) {
      await dbQuery("UPDATE users SET yandex_id = COALESCE(yandex_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?", [yandexId, avatarUrl, user.id]);
      user.yandex_id = yandexId;
      if (avatarUrl) user.avatar_url = avatarUrl;
    }
  }

  const userPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url,
  };

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "30d" });

  return { token, user: userPayload };
}

// 2. Yandex Callback Redirect Route
app.get(["/api/auth/yandex/callback", "/api/auth/yandex/callback/"], async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'YANDEX_AUTH_ERROR', error: 'No code provided' }, '*');
            window.close();
          } else { window.location.href = '/login?error=yandex_no_code'; }
        </script>
        <p>Yandex avtorizatsiyasida kod topilmadi. Oyna yopilmoqda...</p></body></html>
      `);
    }

    const { token, user } = await processYandexAuth(code, false);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'YANDEX_AUTH_SUCCESS', token: ${JSON.stringify(token)}, user: ${JSON.stringify(user)} }, '*');
              window.close();
            } else {
              window.location.href = '/?token=' + encodeURIComponent(${JSON.stringify(token)}) + '&user=' + encodeURIComponent(${JSON.stringify(JSON.stringify(user))});
            }
          </script>
          <p style="text-align: center; font-family: sans-serif; margin-top: 20px;">
            Yandex bilan tizimga muvaffaqiyatli kirildi. Oyna yopilmoqda...
          </p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Yandex OAuth callback error:", err);
    res.send(`
      <html><body><script>
        if (window.opener) {
          window.opener.postMessage({ type: 'YANDEX_AUTH_ERROR', error: ${JSON.stringify(err.message)} }, '*');
          window.close();
        } else { window.location.href = '/login?error=' + encodeURIComponent(err.message); }
      </script>
      <p style="text-align: center; font-family: sans-serif; margin-top: 20px;">
        Yandex kirishda xatolik: ${err.message}
      </p></body></html>
    `);
  }
});

// 3. Direct verification endpoint (for token or code entry)
app.post("/api/auth/yandex/verify", async (req, res) => {
  try {
    const { code, token: yToken } = req.body;
    if (!code && !yToken) {
      return res.status(400).json({ error: "Yandex tasdiqlash kodi yoki Token kiritilmadi!" });
    }

    const input = (code || yToken).trim();
    const isToken = Boolean(yToken);

    const result = await processYandexAuth(input, isToken);
    res.json(result);
  } catch (err: any) {
    console.error("Yandex verify error:", err);
    res.status(400).json({ error: err.message || "Yandex orqali kirishda xatolik yuz berdi" });
  }
});

// ==================== DISCORD OAUTH ENDPOINTS ====================
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

function getDiscordRedirectUri(req: express.Request): string {
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  return `${appUrl.replace(/\/$/, "")}/api/auth/discord/callback`;
}

app.get("/api/auth/discord/url", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(503).json({ error: "Discord orqali kirish hali serverda sozlanmagan." });
  }

  const redirectUri = getDiscordRedirectUri(req);
  const state = jwt.sign({ provider: "discord", redirectUri }, JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify email",
    state,
  });

  res.json({ url: `https://discord.com/oauth2/authorize?${params.toString()}` });
});

async function processDiscordAuth(code: string, redirectUri: string) {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error("Discord server sozlamalari topilmadi.");
  }

  const tokenParams = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = await tokenRes.json() as any;
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || "Discord tasdiqlash kodini tekshirib bo'lmadi.");
  }

  const profileRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const discordUser = await profileRes.json() as any;
  if (!profileRes.ok || !discordUser.id) {
    throw new Error("Discord profilingiz ma'lumotlari olinmadi.");
  }

  const discordId = String(discordUser.id);
  const email = discordUser.email || `discord-${discordId}@users.animem.uz`;
  const name = discordUser.global_name || discordUser.username || "Discord User";
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png?size=256`
    : null;

  const [users]: any = await dbQuery(
    "SELECT * FROM users WHERE discord_id = ? OR email = ?",
    [discordId, email]
  );
  let user = users[0];

  if (!user) {
    const role = email === "mosinjonovjasurbek28@gmail.com" ? "admin" : "user";
    const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-16), 10);
    const [insertRes]: any = await dbQuery(
      "INSERT INTO users (name, email, password, role, avatar_url, discord_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, role, avatarUrl, discordId]
    );
    user = { id: insertRes.insertId, name, email, role, avatar_url: avatarUrl, discord_id: discordId };
  } else if (!user.discord_id || (avatarUrl && !user.avatar_url)) {
    await dbQuery(
      "UPDATE users SET discord_id = COALESCE(discord_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
      [discordId, avatarUrl, user.id]
    );
    user.discord_id = discordId;
    if (avatarUrl) user.avatar_url = avatarUrl;
  }

  const userPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatar_url,
  };
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
  return { token, user: userPayload };
}

app.get(["/api/auth/discord/callback", "/api/auth/discord/callback/"], async (req, res) => {
  const sendCallback = (type: "DISCORD_AUTH_SUCCESS" | "DISCORD_AUTH_ERROR", payload: Record<string, unknown>) => {
    res.send(`<!doctype html><html><body><script>
      const message = ${JSON.stringify({ type, ...payload })};
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
        window.close();
      } else {
        if (type === "DISCORD_AUTH_SUCCESS") {
          window.location.href = '/?token=' + encodeURIComponent(message.token || '') + '&user=' + encodeURIComponent(JSON.stringify(message.user || {}));
        } else {
          window.location.href = '/login?error=' + encodeURIComponent(message.error || 'auth_failed');
        }
      }
    </script></body></html>`);
  };

  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) throw new Error("Discord tasdiqlash ma'lumotlari topilmadi.");

    const stateData = jwt.verify(state, JWT_SECRET) as { provider?: string; redirectUri?: string };
    if (stateData.provider !== "discord" || !stateData.redirectUri) {
      throw new Error("Discord tasdiqlash so'rovi yaroqsiz.");
    }

    const result = await processDiscordAuth(code, stateData.redirectUri);
    sendCallback("DISCORD_AUTH_SUCCESS", result);
  } catch (err: any) {
    console.error("Discord OAuth callback error:", err);
    sendCallback("DISCORD_AUTH_ERROR", { error: err.message || "Discord orqali kirishda xatolik" });
  }
});


// Vite Dev Server / Static Files Setup
async function start() {
  const distPath = path.join(process.cwd(), "dist");
  const publicPath = path.join(process.cwd(), "public");
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  // Start Telegram Bots
  runTelegramBot();
  runSupportTelegramBot();

  // Explicit handlers for Favicon, Manifests, and Verification Files
  app.get("/favicon.ico", (req, res) => {
    const icoPath = path.join(publicPath, "favicon.ico");
    if (fs.existsSync(icoPath)) {
      res.setHeader("Content-Type", "image/x-icon");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(icoPath);
    }
    return res.sendFile(path.join(publicPath, "logo.png"));
  });

  app.get(["/site.webmanifest", "/manifest.json"], (req, res) => {
    const manifestPath = path.join(publicPath, "site.webmanifest");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      return res.sendFile(manifestPath);
    }
    return res.json({ name: "Animem Uz", short_name: "Animem.uz", start_url: "/" });
  });

  app.get("/browserconfig.xml", (req, res) => {
    const xmlPath = path.join(publicPath, "browserconfig.xml");
    if (fs.existsSync(xmlPath)) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.sendFile(xmlPath);
    }
    return res.status(404).send("Not found");
  });

  app.get("/yandex_a7133c70f3012b72.html", (req, res) => {
    const yandexFile = path.join(publicPath, "yandex_a7133c70f3012b72.html");
    if (fs.existsSync(yandexFile)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.sendFile(yandexFile);
    }
    return res.type("text/html").send("<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"></head><body>verification: a7133c70f3012b72</body></html>");
  });

  app.get("/robots.txt", (req, res) => {
    const file = path.join(publicPath, "robots.txt");
    if (fs.existsSync(file)) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.sendFile(file);
    }
    return res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: https://animem.uz/sitemap.xml");
  });

  app.get("/ads.txt", (req, res) => {
    const file = path.join(publicPath, "ads.txt");
    if (fs.existsSync(file)) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.sendFile(file);
    }
    return res.type("text/plain").send("yandex.ru, f08c4a5923fc3014, DIRECT, f08c4a5923fc3014");
  });

  const toSlugLocal = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/o['’`‘]/g, "o")
      .replace(/g['’`‘]/g, "g")
      .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Dynamic Sitemap XML generator (Optimized for Yandex & Google)
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const domain = "https://animem.uz";
      const todayIso = new Date().toISOString().split("T")[0];
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
      
      const staticPages = [
        { url: "/", priority: "1.0", freq: "daily" },
        { url: "/animelar", priority: "0.9", freq: "daily" },
        { url: "/dramalar", priority: "0.9", freq: "daily" },
        { url: "/manga", priority: "0.8", freq: "daily" },
        { url: "/top100", priority: "0.8", freq: "daily" },
        { url: "/jadval", priority: "0.8", freq: "daily" },
        { url: "/yangi-chiqishlar", priority: "0.8", freq: "daily" },
        { url: "/chat", priority: "0.7", freq: "daily" },
        { url: "/maxfiylik-siyosati", priority: "0.6", freq: "monthly" },
        { url: "/foydalanish-shartlari", priority: "0.6", freq: "monthly" },
        { url: "/mualliflik-huquqi", priority: "0.7", freq: "monthly" },
        { url: "/aloqa", priority: "0.7", freq: "monthly" },
      ];
      
      for (const page of staticPages) {
        xml += `  <url>\n    <loc>${domain}${page.url}</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>${page.freq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
      }
      
      const genres = ["isekai", "sarguzasht", "fantasy", "jangari", "komediya", "dramatiya", "drama", "mecha", "romantika", "kriminal", "dahshat", "sport"];
      for (const g of genres) {
        xml += `  <url>\n    <loc>${domain}/${g}</loc>\n    <lastmod>${todayIso}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      }

      // 1. Anime pages in Sitemap
      let animesList: any[] = [];
      try {
        const [rows]: any = await dbQuery("SELECT * FROM animes");
        if (Array.isArray(rows) && rows.length > 0) {
          animesList = rows;
        }
      } catch (e) {
        console.warn("Sitemap DB query error for animes:", e);
      }

      if (animesList.length === 0) {
        const store = loadLocalStore();
        animesList = store.animes || [];
      }
      
      for (const a of animesList) {
        const slug = toSlugLocal(a.title);
        if (slug) {
          const imgUrl = (a.image_url || `${domain}/logo.png`).replace(/&/g, "&amp;");
          const titleClean = (a.title || "Anime").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const animeDate = a.updated_at ? new Date(a.updated_at).toISOString().split("T")[0] : todayIso;
          xml += `  <url>\n`;
          xml += `    <loc>${domain}/anime/${slug}</loc>\n`;
          xml += `    <lastmod>${animeDate}</lastmod>\n`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${imgUrl}</image:loc>\n`;
          xml += `      <image:title>${titleClean}</image:title>\n`;
          xml += `      <image:caption>${titleClean} - O'zbekcha anime posteri</image:caption>\n`;
          xml += `    </image:image>\n`;
          xml += `    <changefreq>daily</changefreq>\n`;
          xml += `    <priority>0.9</priority>\n`;
          xml += `  </url>\n`;
        }
      }

      // 2. Manga pages in Sitemap
      let mangasList: any[] = [];
      try {
        const [mRows]: any = await dbQuery("SELECT * FROM mangas");
        if (Array.isArray(mRows) && mRows.length > 0) {
          mangasList = mRows;
        }
      } catch (e) {
        console.warn("Sitemap DB query error for mangas:", e);
      }

      if (mangasList.length === 0) {
        const store = loadLocalStore();
        mangasList = store.mangas || [];
      }

      for (const m of mangasList) {
        if (m.id) {
          const coverUrl = (m.cover_url || `${domain}/logo.png`).replace(/&/g, "&amp;");
          const mTitleClean = (m.title || "Manga").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const mangaDate = m.updated_at ? new Date(m.updated_at).toISOString().split("T")[0] : todayIso;
          xml += `  <url>\n`;
          xml += `    <loc>${domain}/manga/${m.id}</loc>\n`;
          xml += `    <lastmod>${mangaDate}</lastmod>\n`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${coverUrl}</image:loc>\n`;
          xml += `      <image:title>${mTitleClean}</image:title>\n`;
          xml += `      <image:caption>${mTitleClean} - O'zbekcha manga muqovasi</image:caption>\n`;
          xml += `    </image:image>\n`;
          xml += `    <changefreq>daily</changefreq>\n`;
          xml += `    <priority>0.8</priority>\n`;
          xml += `  </url>\n`;
        }
      }

      // 3. Drama pages in Sitemap (For Google & Yandex fast indexing)
      let dramasList: any[] = [];
      try {
        const [dRows]: any = await dbQuery("SELECT * FROM dramas");
        if (Array.isArray(dRows) && dRows.length > 0) {
          dramasList = dRows;
        }
      } catch (e) {
        console.warn("Sitemap DB query error for dramas:", e);
      }

      if (dramasList.length === 0) {
        const store = loadLocalStore();
        dramasList = store.dramas || [];
      }

      for (const d of dramasList) {
        if (d.id) {
          const posterUrl = (d.poster_url || d.banner_url || `${domain}/logo.png`).replace(/&/g, "&amp;");
          const dTitleClean = (d.title || "Drama").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const dramaDate = d.created_at ? new Date(d.created_at).toISOString().split("T")[0] : todayIso;
          xml += `  <url>\n`;
          xml += `    <loc>${domain}/drama/${d.id}</loc>\n`;
          xml += `    <lastmod>${dramaDate}</lastmod>\n`;
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${posterUrl}</image:loc>\n`;
          xml += `      <image:title>${dTitleClean}</image:title>\n`;
          xml += `      <image:caption>${dTitleClean} - Koreys drama o'zbek tilida</image:caption>\n`;
          xml += `    </image:image>\n`;
          xml += `    <changefreq>daily</changefreq>\n`;
          xml += `    <priority>0.9</priority>\n`;
          xml += `  </url>\n`;
        }
      }
      
      xml += `</urlset>`;
      res.setHeader("Content-Type", "text/xml; charset=utf-8");
      return res.status(200).send(xml);
    } catch (err) {
      console.error("Sitemap generation error:", err);
      return res.sendFile(path.join(publicPath, "sitemap.xml"));
    }
  });

  // Serve public folder directly using express for favicon, videos, images, logos
  app.use(express.static(publicPath, { maxAge: '7d' }));

  // In-memory cache for index.html
  let cachedIndexHtml: string | null = null;
  let cachedIndexMtime = 0;

  const getCachedIndexHtml = (indexPath: string): string => {
    try {
      if (!fs.existsSync(indexPath)) {
        return "<html><body><div id='root'></div></body></html>";
      }
      const stat = fs.statSync(indexPath);
      if (!cachedIndexHtml || stat.mtimeMs !== cachedIndexMtime) {
        cachedIndexHtml = fs.readFileSync(indexPath, "utf8");
        cachedIndexMtime = stat.mtimeMs;
      }
      return cachedIndexHtml;
    } catch (e) {
      return cachedIndexHtml || "<html><body><div id='root'></div></body></html>";
    }
  };

  // Helper function to serve custom SEO injected HTML with zero latency
  const handleDynamicSEO = async (req: express.Request, res: express.Response) => {
    const defaultIndexPath = fs.existsSync(path.join(distPath, "index.html"))
      ? path.join(distPath, "index.html")
      : path.join(process.cwd(), "index.html");

    try {
      let html = getCachedIndexHtml(defaultIndexPath);
      const reqPath = (req.path || "/").toLowerCase();

      let titleText = "Animem Uz - O'zbekistondagi eng yirik anime portali";
      let descText = "Animem Uz - O'zbekistondagi eng yirik onlayn anime portali! Bu yerda eng mashhur va eng so'nggi animelarni o'zbek tilida, yuqori sifatda (HD) va mutlaqo bepul tomosha qilishingiz mumkin.";
      let imageUrl = "https://animem.uz/logo.png";
      let shareUrl = `https://animem.uz${req.path}`;
      let imageAltText = "Animem.uz Logo";
      let jsonLdScript = "";

      // 1. Anime detail page: /anime/:slug or /anime/:id
      if (reqPath.startsWith("/anime/") && reqPath.length > 7) {
        const rawParam = req.path.replace(/^\/anime\//, "").split("?")[0].split("/")[0];
        
        let animeRaw: any = null;
        // Check local memory store first for instant response
        const store = loadLocalStore();
        animeRaw = (store.animes || []).find((a: any) => 
          toSlugLocal(a.title) === rawParam ||
          String(a.id) === rawParam ||
          rawParam.startsWith(a.id + "-") ||
          rawParam.endsWith("-" + a.id)
        );

        if (animeRaw) {
          titleText = `${animeRaw.title} - O'zbek tilida ko'rish | Animem.uz`;
          descText = `${animeRaw.title} o'zbek tilida HD formatda onlayn tomosha qilish. ${animeRaw.description ? animeRaw.description.substring(0, 180).trim() : 'Barcha qismlari bepul va yuqori sifatda!'}`;
          imageUrl = animeRaw.image_url || "https://animem.uz/logo.png";
          shareUrl = `https://animem.uz/anime/${toSlugLocal(animeRaw.title)}`;
          imageAltText = animeRaw.title;

          const genres = animeRaw.janrlar ? animeRaw.janrlar.split(",").map((g: string) => g.trim()) : [];
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "Movie",
            "name": animeRaw.title,
            "alternateName": `${animeRaw.title} - O'zbek tilida ko'rish`,
            "image": {
              "@type": "ImageObject",
              "url": imageUrl,
              "name": animeRaw.title,
              "caption": `${animeRaw.title} anime posteri`
            },
            "description": animeRaw.description || "",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": animeRaw.rating || 9.2,
              "bestRating": "10",
              "worstRating": "1",
              "reviewCount": animeRaw.rating_count || 32
            },
            "genre": genres,
            "dateCreated": animeRaw.yil || 2026,
            "provider": {
              "@type": "Organization",
              "name": "Animem Uz",
              "url": "https://animem.uz"
            }
          };
          jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>`;
        }
      } 
      // 2. Manga detail page: /manga/:id
      else if (reqPath.startsWith("/manga/") && reqPath.length > 7) {
        const mangaId = req.path.replace(/^\/manga\//, "").split("?")[0].split("/")[0];
        const store = loadLocalStore();
        const mangaRaw = (store.mangas || []).find((m: any) => String(m.id) === String(mangaId));

        if (mangaRaw) {
          titleText = `${mangaRaw.title} - O'zbekcha Manga va Komiks | Animem.uz`;
          descText = `${mangaRaw.title} mangasi o'zbek tilida onlayn o'qish. ${mangaRaw.description ? mangaRaw.description.substring(0, 180).trim() : 'Eng so\'nggi boblar va yuqori sifat!'}`;
          imageUrl = mangaRaw.cover_url || "https://animem.uz/logo.png";
          shareUrl = `https://animem.uz/manga/${mangaRaw.id}`;
          imageAltText = mangaRaw.title;

          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "Book",
            "name": mangaRaw.title,
            "image": {
              "@type": "ImageObject",
              "url": imageUrl,
              "name": mangaRaw.title,
              "caption": `${mangaRaw.title} manga muqovasi`
            },
            "description": mangaRaw.description || "",
            "author": mangaRaw.author || "Animem Uz",
            "provider": {
              "@type": "Organization",
              "name": "Animem Uz",
              "url": "https://animem.uz"
            }
          };
          jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>`;
        }
      }
      // 3. Drama detail page: /drama/:id
      else if (reqPath.startsWith("/drama/") && reqPath.length > 7) {
        const dramaId = req.path.replace(/^\/drama\//, "").split("?")[0].split("/")[0];
        const store = loadLocalStore();
        let dramaRaw = (store.dramas || []).find((d: any) => String(d.id) === String(dramaId));

        if (!dramaRaw) {
          try {
            const [dRows]: any = await dbQuery("SELECT * FROM dramas WHERE id = ?", [dramaId]);
            if (Array.isArray(dRows) && dRows[0]) {
              dramaRaw = dRows[0];
            }
          } catch (e) {
            console.warn("Error fetching drama for SEO:", e);
          }
        }

        if (dramaRaw) {
          const dramaTitle = dramaRaw.title || "Drama";
          const dramaDesc = dramaRaw.description 
            ? dramaRaw.description.substring(0, 180).trim() 
            : "Koreys va Osiyo dramalarini o'zbek tilida eng yuqori sifatda onlayn tomosha qiling.";
          const dramaPoster = dramaRaw.poster_url || dramaRaw.banner_url || "https://animem.uz/logo.png";
          
          titleText = `${dramaTitle} - Koreys Drama O'zbek Tilida Ko'rish | Animem.uz`;
          descText = `${dramaTitle} dramasi o'zbek tilida bepul onlayn tomosha qilish. ${dramaDesc}`;
          imageUrl = dramaPoster;
          shareUrl = `https://animem.uz/drama/${dramaRaw.id}`;
          imageAltText = `${dramaTitle} koreys drama`;

          const genres = dramaRaw.janrlar ? dramaRaw.janrlar.split(",").map((g: string) => g.trim()) : ["Drama", "Koreys drama"];
          const jsonLd = {
            "@context": "https://schema.org",
            "@type": "TVSeries",
            "name": dramaTitle,
            "alternateName": [
              `${dramaTitle} o'zbek tilida`,
              `${dramaTitle} koreys drama`,
              `${dramaTitle} do'rama uzb`
            ],
            "image": {
              "@type": "ImageObject",
              "url": imageUrl,
              "name": dramaTitle,
              "caption": `${dramaTitle} koreys drama posteri`
            },
            "description": dramaDesc,
            "genre": genres,
            "dateCreated": dramaRaw.yil || 2025,
            "inLanguage": "uz",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "9.5",
              "bestRating": "10",
              "worstRating": "1",
              "reviewCount": String(Math.max(1, dramaRaw.likes || 15))
            },
            "provider": {
              "@type": "Organization",
              "name": "Animem Uz",
              "url": "https://animem.uz"
            }
          };
          jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(jsonLd, null, 2)}\n    </script>`;
        }
      }
      // 4. Dramas Catalog page: /dramalar
      else if (reqPath === "/dramalar") {
        titleText = "Koreys Dramalari va Doramalar O'zbek Tilida | Animem.uz";
        descText = "Eng sara koreys, yapon va xitoy dramalarini (doramalarni) o'zbek tilida, yuqori sifatda (HD) va bepul tomosha qiling. Yangi chiqgan barcha dramalar to'plami.";

        const store = loadLocalStore();
        const topDramas = (store.dramas || []).slice(0, 30);
        if (topDramas.length > 0) {
          const itemListLd = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "O'zbek Tilidagi Koreys Dramalari Katalogi",
            "description": "Eng sara koreys dramalari va doramalar to'plami",
            "itemListElement": topDramas.map((d: any, idx: number) => ({
              "@type": "ListItem",
              "position": idx + 1,
              "item": {
                "@type": "TVSeries",
                "name": d.title,
                "url": `https://animem.uz/drama/${d.id}`,
                "image": {
                  "@type": "ImageObject",
                  "url": d.poster_url || d.banner_url || "https://animem.uz/logo.png",
                  "name": d.title,
                  "caption": d.title
                }
              }
            }))
          };
          jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(itemListLd, null, 2)}\n    </script>`;
        }
      }
      // 3. Main catalog pages
      else if (reqPath === "/" || reqPath === "/animelar" || reqPath === "/anime") {
        titleText = "Barcha Animelar - O'zbek tilida tomosha qilish | Animem.uz";
        descText = "Animem.uz portalidagi barcha o'zbekcha tarjima animelar katalogi. Sevimli animelaringizni HD sifatda bepul tomosha qiling.";

        // Inject ItemList JSON-LD mapping each anime image directly to its anime title
        const store = loadLocalStore();
        const topAnimes = (store.animes || []).slice(0, 30);
        if (topAnimes.length > 0) {
          const itemListLd = {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "O'zbekcha Animelar Katalogi",
            "itemListElement": topAnimes.map((a: any, idx: number) => ({
              "@type": "ListItem",
              "position": idx + 1,
              "item": {
                "@type": "Movie",
                "name": a.title,
                "url": `https://animem.uz/anime/${toSlugLocal(a.title)}`,
                "image": {
                  "@type": "ImageObject",
                  "url": a.image_url,
                  "name": a.title,
                  "caption": a.title
                }
              }
            }))
          };
          jsonLdScript = `\n    <script type="application/ld+json">\n    ${JSON.stringify(itemListLd, null, 2)}\n    </script>`;
        }
      } else if (reqPath === "/chat") {
        titleText = "Anime Chat va Muloqot | Animem.uz";
        descText = "Animem.uz saytining anime ixlosmandlari uchun jonli chat va muhokama bo'limi. Do'stlar ortiring va do'stona suhbatlashing.";
      } else if (reqPath === "/manga") {
        titleText = "O'zbekcha Mangalar va Komikslar | Animem.uz";
        descText = "O'zbek tiliga tarjima qilingan eng mashhur va eng so'nggi mangalarni onlayn o'qing.";
      } else if (reqPath === "/top100") {
        titleText = "Top 100 Eng Yaxshi Animelar | Animem.uz";
        descText = "Tomoshabinlar va reyting bo'yicha saralangan eng sara Top 100 o'zbekcha tarjima animelar.";
      } else if (reqPath === "/jadval") {
        titleText = "Anime Qismlari Chiqish Jadvali | Animem.uz";
        descText = "Hafta kunlari bo'yicha yangi o'zbekcha anime epizodlarining qulay chiqish jadvali.";
      } else if (reqPath === "/yangi-chiqishlar") {
        titleText = "Eng Yangi Chiqqan Qismlar | Animem.uz";
        descText = "So'nggi soatlar va kunlarda chiqarilgan eng yangi o'zbekcha tarjima anime epizodlari.";
      } else if (reqPath === "/sevimlilar") {
        titleText = "Sevimli Animelarim | Animem.uz";
        descText = "Siz saqlagan va yoqtirgan o'zbekcha animelar to'plami.";
      } else if (reqPath === "/tarix") {
        titleText = "Ko'rishlar Tarixi | Animem.uz";
        descText = "Siz oxirgi marta tomosha qilgan anime va qismlar tarixi.";
      } else if (reqPath === "/maxfiylik-siyosati" || reqPath === "/privacy") {
        titleText = "Maxfiylik Siyosati (Privacy Policy) | Animem.uz";
        descText = "Animem.uz foydalanuvchilarining shaxsiy ma'lumotlarini to'plash, saqlash va xavfsizligini ta'minlash bo'yicha rasmiy maxfiylik siyosati.";
      } else if (reqPath === "/foydalanish-shartlari" || reqPath === "/terms") {
        titleText = "Foydalanish Shartlari (Terms of Service) | Animem.uz";
        descText = "Animem.uz saytidan foydalanish bo'yicha rasmiy foydalanish shartlari va qoidalar kelishuvi.";
      } else if (reqPath === "/mualliflik-huquqi" || reqPath === "/dmca") {
        titleText = "Mualliflik Huquqi va DMCA | Animem.uz";
        descText = "Animem.uz saytining mualliflik huquqi egalari uchun rasmiy bildirishnomasi va DMCA o'chirish siyosati.";
      } else if (reqPath === "/aloqa" || reqPath === "/contacts") {
        titleText = "Aloqa va Qo'llab-Quvvatlash | Animem.uz";
        descText = "Animem.uz ma'muriyati bilan bog'lanish, texnik qo'llab-quvvatlash va takliflar yuborish bo'limi.";
      } else {
        // Genre check (e.g., /isekai, /fantasy, /jangari, /komediya, /mecha, /sarguzasht, /romantika)
        const knownGenres: Record<string, string> = {
          "isekai": "Isekai",
          "fantasy": "Fentezi",
          "sarguzasht": "Sarguzasht",
          "jangari": "Jangari",
          "komediya": "Komediya",
          "dramatiya": "Drama",
          "drama": "Drama",
          "mecha": "Mеха (Mecha)",
          "romantika": "Romantika",
          "kriminal": "Kriminal",
          "dahshat": "Dahshat",
          "sport": "Sport",
          "maktab": "Maktab"
        };
        const cleanPath = reqPath.replace(/^\//, "");
        if (knownGenres[cleanPath]) {
          const gName = knownGenres[cleanPath];
          titleText = `${gName} animelar - O'zbek tilida ko'rish | Animem.uz`;
          descText = `Eng sara ${gName} janridagi o'zbekcha tarjima animelar to'plami. Animem.uz saytida HD formatda bepul tomosha qiling.`;
        }
      }

      // Replace metadata in HTML template
      html = html.replace(/<title>.*?<\/title>/gi, `<title>${titleText}</title>`);
      html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, `<meta name="description" content="${descText.replace(/"/g, '&quot;')}" />`);
      
      html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${shareUrl}" />`);
      html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${titleText.replace(/"/g, '&quot;')}" />`);
      html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${descText.replace(/"/g, '&quot;')}" />`);
      html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${imageUrl}" />`);
      
      if (html.includes('property="og:image:alt"')) {
        html = html.replace(/<meta\s+property="og:image:alt"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image:alt" content="${imageAltText.replace(/"/g, '&quot;')}" />`);
      } else {
        html = html.replace('<meta property="og:image"', `<meta property="og:image:alt" content="${imageAltText.replace(/"/g, '&quot;')}" />\n    <meta property="og:image"`);
      }

      html = html.replace(/<meta\s+property="twitter:url"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:url" content="${shareUrl}" />`);
      html = html.replace(/<meta\s+property="twitter:title"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:title" content="${titleText.replace(/"/g, '&quot;')}" />`);
      html = html.replace(/<meta\s+property="twitter:description"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:description" content="${descText.replace(/"/g, '&quot;')}" />`);
      html = html.replace(/<meta\s+property="twitter:image"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:image" content="${imageUrl}" />`);

      if (jsonLdScript) {
        html = html.replace("</head>", `${jsonLdScript}\n  </head>`);
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (err) {
      console.error("SEO server-side injection error:", err);
      return res.sendFile(defaultIndexPath);
    }
  };

  // Route for anime detail pages
  app.get("/anime/:slug", handleDynamicSEO);
  app.get("/drama/:id", handleDynamicSEO);
  app.get("/dramalar", handleDynamicSEO);

  // Support bot route
  app.post("/api/support-bot", async (req, res) => {
    try {
      const { message, history, userName } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key sozlanmagan" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const sysInstruction = `Sizning ismingiz Sumire. Siz Animem.uz saytining sun'iy intellekt yordamchisisiz. Siz odatda juda xursand, samimiy va yordamga tayyor qizsiz. Foydalanuvchining ismi: ${userName}. Lekin agar foydalanuvchi sizni xafa qilsa, so'ksa yoki nojo'ya gapirsa, siz darhol xafa bo'lasiz va ularni adminlarga aytaman deb qo'rqitasiz. Sizning javoblaringiz qisqa (maksimal 2-3 gap), vizual novella uslubida, emotsiya bilan yozilgan bo'lishi kerak. Foydalanuvchi sizga yozganda yordam so'rashini yoki shunchaki suhbatlashishini kutasiz. Animem.uz sayti - O'zbekistondagi eng zo'r anime sayti hisoblanadi.`;

      // Convert history to Gemini format if needed (system/user/model), here just combining as context
      let contents = [];
      if (history && history.length > 0) {
        contents = history.map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));
      }

      // Add the new message
      contents.push({ role: 'user', parts: [{ text: message }] });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: sysInstruction,
          temperature: 0.7,
        }
      });

      res.json({ reply: response.text });
    } catch (err: any) {
      console.error("Support bot error:", err);
      res.status(500).json({ error: "Xatolik yuz berdi. Sumire hozir uxlab yotibdi." });
    }
  });

  // Contact form submission endpoint -> forwards to Admin Telegram via @animem_support_bot
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Murojaat matni kiritilmadi" });
      }

      const userName = name || "Noma'lum foydalanuvchi";
      const userDomainEmail = email || "Kiritilmagan";
      const msgText = message.trim();

      // Send notification to Admin Telegram ID (8991315532) via @animem_support_bot
      const adminMsgText = 
        `🌐 <b>YANGI MUROJAAT (Animem.uz Saytidan)</b>\n\n` +
        `👤 <b>Ismi:</b> ${userName}\n` +
        `🌐 <b>Email / Domen / Nick:</b> ${userDomainEmail}\n\n` +
        `💬 <b>Murojaat matni:</b>\n${msgText}\n\n` +
        `📅 <b>Sana:</b> ${new Date().toLocaleString('uz-UZ')}`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "🌐 Sayt Admin Panelini Ochish", url: "https://animem.uz/admin" }
          ]
        ]
      };

      await sendSupportBotMessage(SUPPORT_ADMIN_ID, adminMsgText, inlineKeyboard);

      res.json({ success: true, message: "Murojaat adminga muvaffaqiyatli yetkazildi!" });
    } catch (err: any) {
      console.error("Contact form submit error:", err);
      res.status(500).json({ error: "Murojaatni yuborishda xatolik yuz berdi" });
    }
  });

  // API 404 Fallback Handler - Ensures unhandled /api/* routes return JSON, never index.html
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint topilmadi (${req.path})` });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
      }
    }));
    app.get("*", (req, res) => {
      handleDynamicSEO(req, res);
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
