import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD, // No default password for security
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || "scheduler",
});

export default db;