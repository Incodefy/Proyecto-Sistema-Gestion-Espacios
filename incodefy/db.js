const mysql = require("mysql2/promise");

// crea el pool de conexiones
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "David5111",
  database: "incodefy",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// probar conexión
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Conexión exitosa a MySQL");
    connection.release();
  } catch (err) {
    console.error("❌ Error al conectar con MySQL:", err);
  }
})();

module.exports = db;
