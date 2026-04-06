import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ExpenseRegistry...");

  const ExpenseRegistry = await ethers.getContractFactory("ExpenseRegistry");
  const expenseRegistry = await ExpenseRegistry.deploy();

  await expenseRegistry.waitForDeployment();

  const address = await expenseRegistry.getAddress();

  console.log("\n✅ ExpenseRegistry deployed to:", address);
  console.log("\nNext steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Paste it in frontend/src/lib/constants.ts → CONTRACT_ADDRESS");
  console.log("3. The deployer wallet is automatically authorized as relayer");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
