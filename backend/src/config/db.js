const mysql = require("mysql2/promise");

const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: false,
};

const pools = Object.freeze({
  CUSTOMER: mysql.createPool({
    ...poolConfig,
    user: process.env.DB_CUSTOMER_USER,
    password: process.env.DB_CUSTOMER_PASS,
  }),
  CASHIER: mysql.createPool({
    ...poolConfig,
    user: process.env.DB_CASHIER_USER,
    password: process.env.DB_CASHIER_PASS,
  }),
  ADMIN: mysql.createPool({
    ...poolConfig,
    user: process.env.DB_ADMIN_USER,
    password: process.env.DB_ADMIN_PASS,
  }),
});

function getPool(role) {
  const pool = pools[role];
  if (!pool) {
    throw new TypeError(`Unsupported database role: ${role}`);
  }
  return pool;
}

async function query(role, sql, params = []) {
  const [rows] = await getPool(role).execute(sql, params);
  return rows;
}

async function withTransaction(role, callback) {
  const connection = await getPool(role).getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function withActorTransaction(role, userId, callback) {
  return withTransaction(role, async (connection) => {
    await connection.execute("SET @app_user_id = ?", [userId]);
    try {
      return await callback(connection);
    } finally {
      await connection.execute("SET @app_user_id = NULL");
    }
  });
}

async function withRolledBackTransaction(role, callback) {
  const connection = await getPool(role).getConnection();
  try {
    await connection.beginTransaction();
    return await callback(connection);
  } finally {
    try {
      await connection.rollback();
    } catch (error) {
      console.error(`${role} demo transaction rollback failed:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function callCreateInvoice(
  role,
  customerId,
  cashierId,
  discountCode,
  items,
) {
  const connection = await getPool(role).getConnection();
  try {
    await connection.query(
      "CALL sp_create_invoice(?, ?, ?, ?, @created_invoice_id)",
      [customerId, cashierId, discountCode || null, JSON.stringify(items)],
    );
    const [rows] = await connection.query(
      "SELECT @created_invoice_id AS invoiceId",
    );
    return rows[0].invoiceId;
  } finally {
    connection.release();
  }
}

async function callRecordPayment(
  role,
  invoiceId,
  cashierId,
  methodId,
  amount,
  referenceNo,
) {
  const connection = await getPool(role).getConnection();
  try {
    await connection.query(
      "CALL sp_record_payment(?, ?, ?, ?, ?, @created_payment_id)",
      [invoiceId, cashierId, methodId, amount, referenceNo || null],
    );
    const [rows] = await connection.query(
      "SELECT @created_payment_id AS paymentId",
    );
    return rows[0].paymentId;
  } finally {
    connection.release();
  }
}

async function pingPools() {
  await Promise.all(
    Object.entries(pools).map(async ([role, pool]) => {
      const connection = await pool.getConnection();
      try {
        await connection.query("SELECT 1");
      } catch (error) {
        error.message = `${role} database pool: ${error.message}`;
        throw error;
      } finally {
        connection.release();
      }
    }),
  );
}

async function closePools() {
  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}

module.exports = {
  callCreateInvoice,
  callRecordPayment,
  closePools,
  getPool,
  pingPools,
  query,
  withRolledBackTransaction,
  withActorTransaction,
  withTransaction,
};
