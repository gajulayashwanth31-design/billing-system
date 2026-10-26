const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
const databaseDir = path.join(projectRoot, "database");
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const databaseFiles = [
  "01_schema.sql",
  "02_triggers.sql",
  "03_views_procedures.sql",
  "04_roles_and_grants.sql",
  "05_seed.sql",
];

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

function main() {
  const databaseName = process.env.DB_NAME || "billing_db";
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
  }

  const statements = databaseFiles.map((fileName) => {
    let contents = fs
      .readFileSync(path.join(databaseDir, fileName), "utf8")
      .replace(/\bbilling_db\b/g, databaseName);
    if (fileName === "04_roles_and_grants.sql") {
      for (const role of ["CUSTOMER", "CASHIER", "ADMIN"]) {
        const password = process.env[`DB_${role}_PASS`];
        if (!password || password.startsWith("CHANGE_ME_")) {
          throw new Error(`Set DB_${role}_PASS in .env before database setup.`);
        }
        const sqlPassword = `'${password.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
        contents = contents.replace(
          `'CHANGE_ME_${role}_PASSWORD'`,
          sqlPassword,
        );
      }
    }
    return contents;
  });

  const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || "";
  const result = spawnSync(
    findMysqlCli(),
    [
      "--protocol=TCP",
      "--default-character-set=utf8mb4",
      "--host",
      process.env.DB_HOST || "localhost",
      "--port",
      process.env.DB_PORT || "3306",
      "--user",
      process.env.DB_ADMIN_USER || "root",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, MYSQL_PWD: mysqlPassword },
      input: statements.join("\n"),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");
    throw new Error(`Local database setup failed:\n${details}`);
  }
  process.stdout.write("Local database initialized from SQL files 01 to 05.\n");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
