const app = require("./src/app");
const { closePools, pingPools } = require("./src/config/db");

const port = Number(process.env.PORT || 4000);
let server;

async function start() {
  await pingPools();
  server = app.listen(port, () => {
    console.info(`Billing API listening on port ${port}`);
  });
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down billing API`);
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await closePools();
}

process.once("SIGINT", () =>
  shutdown("SIGINT").catch((error) => {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  }),
);
process.once("SIGTERM", () =>
  shutdown("SIGTERM").catch((error) => {
    console.error("Shutdown failed:", error);
    process.exitCode = 1;
  }),
);

start().catch(async (error) => {
  console.error("Failed to start billing API:", error.message);
  await closePools();
  process.exitCode = 1;
});
