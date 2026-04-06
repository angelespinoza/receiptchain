const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load the compiled artifact
const artifactPath = path.join(__dirname, 'artifacts/contracts/ExpenseRegistry.json');
const artifactData = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function runTests() {
  console.log('Starting ExpenseRegistry Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Deploy test
    console.log('Testing: Deployment');
    const factory = new ethers.ContractFactory(artifactData.abi, artifactData.bytecode, (await ethers.getSigners())[0]);
    const contract = await factory.deploy();
    await contract.deployed();
    console.log('✓ Contract deployed successfully\n');
    testsPassed++;

    // Register expense test
    console.log('Testing: Register expense and check count');
    const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('receipt1'));
    const amount = ethers.utils.parseEther('100');
    const category = 'Food';

    const owner = (await ethers.getSigners())[0];
    const tx = await contract.registerExpense(dataHash, amount, category);
    await tx.wait();

    const count = await contract.getExpenseCount(owner.address);
    assert.strictEqual(count.toNumber(), 1, 'Expense count should be 1');
    console.log('✓ Expense registered successfully\n');
    testsPassed++;

    // Verify stored data test
    console.log('Testing: Verify stored data matches');
    const [returnedHash, timestamp, returnedAmount, returnedCategory] =
      await contract.getExpense(owner.address, 0);

    assert.strictEqual(returnedHash, dataHash, 'Hash should match');
    assert.strictEqual(returnedAmount.toString(), amount.toString(), 'Amount should match');
    assert.strictEqual(returnedCategory, category, 'Category should match');
    console.log('✓ Stored data matches correctly\n');
    testsPassed++;

    // Multiple expenses test
    console.log('Testing: Multiple expenses from same user');
    const dataHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('receipt2'));
    const tx2 = await contract.registerExpense(dataHash2, amount, 'Transport');
    await tx2.wait();

    const count2 = await contract.getExpenseCount(owner.address);
    assert.strictEqual(count2.toNumber(), 2, 'Expense count should be 2');
    console.log('✓ Multiple expenses registered successfully\n');
    testsPassed++;

    // Expense verification test
    console.log('Testing: Expense verification');
    const isVerified = await contract.verifyExpense(owner.address, 0, dataHash);
    assert.strictEqual(isVerified, true, 'Hash verification should pass');

    const wrongHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('wrongreceipt'));
    const isWrong = await contract.verifyExpense(owner.address, 0, wrongHash);
    assert.strictEqual(isWrong, false, 'Wrong hash should fail verification');
    console.log('✓ Expense verification works correctly\n');
    testsPassed++;

    // Pagination test
    console.log('Testing: Pagination with getExpensesByRange');
    for (let i = 2; i < 5; i++) {
      const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`receipt${i}`));
      const txPag = await contract.registerExpense(hash, ethers.utils.parseEther((i + 1).toString()), `Category${i}`);
      await txPag.wait();
    }

    const expenses = await contract.getExpensesByRange(owner.address, 1, 3);
    assert.strictEqual(expenses.length, 2, 'Should return 2 expenses');
    console.log('✓ Pagination works correctly\n');
    testsPassed++;

  } catch (error) {
    console.error('Test Error:', error.message);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log('='.repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
