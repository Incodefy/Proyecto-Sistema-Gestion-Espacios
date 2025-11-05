const mysql = require('mysql2/promise');

// crea el pool de conexiones
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'David5111',
  database: process.env.DB_NAME || 'incodefy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// probar conexión
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Conexión exitosa a MySQL');
    connection.release();
  } catch (err) {
    console.error('❌ Error al conectar con MySQL:', err);
  }
})();

module.exports = db;
