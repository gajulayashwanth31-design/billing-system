const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const exampleEnv = path.join(backendRoot, ".env.example");
dotenv.config({
  path: fs.existsSync(path.join(backendRoot, ".env"))
    ? path.join(backendRoot, ".env")
    : exampleEnv,
  quiet: true,
});

const databaseFiles = [
  "01_schema.sql",
  "02_triggers.sql",
  "03_views_procedures.sql",
  "04_roles_and_grants.sql",
  "05_seed.sql",
  "07_phase4_migration.sql",
  "03_views_procedures.sql",
  "04_roles_and_grants.sql",
  "tests.sql",
];

function sqlString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function findMysqlCli() {
  const configuredPath = process.env.MYSQL_CLI_PATH;
  if (configuredPath) {
    if (!fs.existsSync(configuredPath)) {
      throw new Error(`MYSQL_CLI_PATH does not exist: ${configuredPath}`);
    }
    return configuredPath;
  }

  if (process.platform === "win32") {
    const defaultPath = path.join(
      process.env.ProgramFiles || "C:\\Program Files",
      "MySQL",
      "MySQL Server 8.0",
      "bin",
      "mysql.exe",
    );
    if (fs.existsSync(defaultPath)) return defaultPath;
  }
  return process.platform === "win32" ? "mysql.exe" : "mysql";
}

function initializeTestDatabase(mysqlCli, mysqlEnv) {
  const databaseDir = path.join(projectRoot, "database");
  const statements = [
    "DROP DATABASE IF EXISTS billing_test;",
    "CREATE DATABASE billing_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;",
  ];

  for (const fileName of databaseFiles) {
    let contents = fs.readFileSync(path.join(databaseDir, fileName), "utf8");
    contents = contents.replace(/\bbilling_db\b/g, "billing_test");
    if (fileName === "04_roles_and_grants.sql") {
      contents = contents
        .replaceAll(
          "'CHANGE_ME_CUSTOMER_PASSWORD'",
          sqlString(process.env.DB_CUSTOMER_PASS),
        )
        .replaceAll(
          "'CHANGE_ME_CASHIER_PASSWORD'",
          sqlString(process.env.DB_CASHIER_PASS),
        )
        .replaceAll(
          "'CHANGE_ME_ADMIN_PASSWORD'",
          sqlString(process.env.DB_ADMIN_PASS),
        );
    }
    statements.push(contents);
  }

  const result = spawnSync(
    mysqlCli,
    [
      "--protocol=TCP",
      "--default-character-set=utf8mb4",
      "--host",
      process.env.TEST_DB_HOST || process.env.DB_HOST || "127.0.0.1",
      "--port",
      process.env.TEST_DB_PORT || process.env.DB_PORT || "3306",
      "--user",
      process.env.TEST_DB_ADMIN_USER || "root",
    ],
    {
      cwd: projectRoot,
      env: mysqlEnv,
      input: statements.join("\n"),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");
    throw new Error(`Could not initialize billing_test:\n${details}`);
  }
  const passCount = (result.stdout.match(/PASS:/g) || []).length;
  if (result.stdout.includes("FAIL:") || passCount < 10) {
    throw new Error(
      `billing_test was initialized, but database/tests.sql did not pass (${passCount}/10).`,
    );
  }
  process.stdout.write(
    `billing_test initialized; database/tests.sql passed ${passCount} checks.\n`,
  );
}

function main() {
  const mysqlPassword =
    process.env.TEST_DB_ADMIN_PASS || process.env.MYSQL_PWD || "";
  const mysqlEnv = { ...process.env, MYSQL_PWD: mysqlPassword };
  const mysqlCli = findMysqlCli();
  initializeTestDatabase(mysqlCli, mysqlEnv);
  const testStorageDir = path.join(backendRoot, "storage", "test-invoices");
  fs.rmSync(testStorageDir, { recursive: true, force: true });

  const testEnv = {
    ...process.env,
    NODE_ENV: "test",
    DB_HOST: process.env.TEST_DB_HOST || process.env.DB_HOST || "127.0.0.1",
    DB_PORT: process.env.TEST_DB_PORT || process.env.DB_PORT || "3306",
    DB_NAME: "billing_test",
    DB_CUSTOMER_USER: process.env.DB_CUSTOMER_USER || "billing_customer",
    DB_CUSTOMER_PASS:
      process.env.DB_CUSTOMER_PASS || "CHANGE_ME_CUSTOMER_PASSWORD",
    DB_CASHIER_USER: process.env.DB_CASHIER_USER || "billing_cashier",
    DB_CASHIER_PASS:
      process.env.DB_CASHIER_PASS || "CHANGE_ME_CASHIER_PASSWORD",
    DB_ADMIN_USER: process.env.DB_ADMIN_USER || "billing_admin",
    DB_ADMIN_PASS: process.env.DB_ADMIN_PASS || "CHANGE_ME_ADMIN_PASSWORD",
    JWT_SECRET:
      process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex"),
    INVOICE_SIGNING_SECRET:
      process.env.INVOICE_SIGNING_SECRET ||
      crypto.randomBytes(48).toString("hex"),
    INVOICE_STORAGE_DIR: testStorageDir,
    WHATSAPP_PROVIDER: "mock",
    DEMO_MODE: "true",
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:4000",
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || "http://localhost:5173",
  };
  delete testEnv.MYSQL_PWD;
  delete testEnv.TEST_DB_ADMIN_PASS;

  const jestCli = require.resolve("jest/bin/jest");
  const args = process.argv
    .slice(2)
    .filter((argument) => argument !== "--runInBand");
  try {
    const result = spawnSync(
      process.execPath,
      [jestCli, "--runInBand", ...args],
      { cwd: backendRoot, env: testEnv, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
