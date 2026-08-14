const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price NUMERIC NOT NULL,
      old_price NUMERIC NOT NULL,
      stock INTEGER DEFAULT 0,
      image TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      total NUMERIC NOT NULL,
      status TEXT DEFAULT 'Order Placed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ShopKart server is running 🚀"
  });
});

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        category,
        price,
        old_price AS old,
        stock,
        image AS img
      FROM products
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, category, price, old, stock, img } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({
        error: "Name, category and price required"
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (name, category, price, old_price, stock, image)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        name,
        category,
        Number(price),
        Number(old || price),
        Number(stock || 0),
        img || ""
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM products WHERE id = $1",
      [req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    const result = await pool.query(
      `INSERT INTO users (name, email)
       VALUES ($1,$2)
       ON CONFLICT (email)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name, email]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customer, email, address, total } = req.body;

    const result = await pool.query(
      `INSERT INTO orders
       (customer, email, address, total)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [customer, email, address, Number(total)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

setupDatabase()
  .then(() => {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(
        `ShopKart running on port ${PORT} 🚀`
      );
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
