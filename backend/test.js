import pool from "./db.js";

console.log("🚀 Starting DB test...");

async function testDB() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ DB Connected:", res.rows[0]);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

testDB();