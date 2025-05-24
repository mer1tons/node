require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

const app = express();
app.use(express.json());

// Lidhja me Redis
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

// Lidhja me MySQL RDS
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Merr oraret për një përdorues
app.get('/schedule/:userId', async (req, res) => {
  const { userId } = req.params;

  // Kontrollo në cache
  const cached = await redis.get(`schedule:${userId}`);
  if (cached) return res.json(JSON.parse(cached));

  // Merr nga RDS nëse nuk është në cache
  const [rows] = await db.query('SELECT * FROM schedules WHERE user_id = ?', [userId]);

  // Ruaje në cache për 10 minuta
  await redis.set(`schedule:${userId}`, JSON.stringify(rows), 'EX', 600);

  res.json(rows);
});

// Shto orar për një përdorues
app.post('/schedule', async (req, res) => {
  const { user_id, day, start_time, end_time } = req.body;
  await db.query(
    'INSERT INTO schedules (user_id, day, start_time, end_time) VALUES (?, ?, ?, ?)',
    [user_id, day, start_time, end_time]
  );

  // Fshi cache për atë user
  await redis.del(`schedule:${user_id}`);

  res.json({ message: 'Orari u shtua me sukses' });
});

// Nis serverin
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveri u nis në portin ${PORT}`);
});
