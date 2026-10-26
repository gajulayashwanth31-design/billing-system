const bcrypt = require("bcrypt");

const demoPasswords = {
  admin: "Admin@123",
  cashier1: "Cashier@123",
  cashier2: "Cashier@123",
  priya: "Customer@123",
  rahul: "Customer@123",
};

async function main() {
  for (const [username, password] of Object.entries(demoPasswords)) {
    const hash = await bcrypt.hash(password, 10);
    process.stdout.write(`${username}\t${hash}\n`);
  }
}

main().catch((error) => {
  console.error("Failed to hash demo passwords:", error.message);
  process.exitCode = 1;
});
