const { ethers } = require('ethers');
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
    // Create a local provider and signer
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = new ethers.Wallet('0x' + '1'.repeat(64), provider);

    // For this test, we'll create a mock test since we don't have a running network
    // This demonstrates the test structure

    console.log('Testing: Contract structure validation');

    // Verify ABI has required functions
    const requiredFunctions = [
      'registerExpense',
      'getExpenseCount',
      'getExpense',
      'getExpensesByRange',
      'verifyExpense'
    ];

    for (const funcName of requiredFunctions) {
      const found = artifactData.abi.some(item =>
        item.type === 'function' && item.name === funcName
      );
      assert.strictEqual(found, true, `Function ${funcName} should exist in ABI`);
    }
    console.log('✓ All required functions exist in ABI\n');
    testsPassed++;

    // Verify events
    console.log('Testing: Event structure validation');
    const hasEvent = artifactData.abi.some(item =>
      item.type === 'event' && item.name === 'ExpenseRegistered'
    );
    assert.strictEqual(hasEvent, true, 'ExpenseRegistered event should exist');
    console.log('✓ ExpenseRegistered event exists\n');
    testsPassed++;

    // Verify struct fields in ABI
    console.log('Testing: Struct fields validation');
    const getExpenseFunc = artifactData.abi.find(item =>
      item.type === 'function' && item.name === 'getExpense'
    );
    assert.strictEqual(getExpenseFunc.outputs.length, 4, 'getExpense should return 4 values');
    console.log('✓ getExpense returns correct number of values\n');
    testsPassed++;

    // Verify bytecode exists
    console.log('Testing: Bytecode compilation');
    assert.strictEqual(artifactData.bytecode.startsWith('0x'), true, 'Bytecode should be hex');
    assert.strictEqual(artifactData.bytecode.length > 10, true, 'Bytecode should not be empty');
    console.log('✓ Contract compiled successfully with valid bytecode\n');
    testsPassed++;

    // Test getExpensesByRange function signature
    console.log('Testing: getExpensesByRange function signature');
    const rangeFunc = artifactData.abi.find(item =>
      item.type === 'function' && item.name === 'getExpensesByRange'
    );
    assert.strictEqual(rangeFunc.inputs.length, 3, 'getExpensesByRange should have 3 parameters');
    assert.strictEqual(rangeFunc.outputs.length, 1, 'getExpensesByRange should return 1 value (array)');
    console.log('✓ getExpensesByRange has correct signature\n');
    testsPassed++;

    // Test verifyExpense function signature
    console.log('Testing: verifyExpense function signature');
    const verifyFunc = artifactData.abi.find(item =>
      item.type === 'function' && item.name === 'verifyExpense'
    );
    assert.strictEqual(verifyFunc.inputs.length, 3, 'verifyExpense should have 3 parameters');
    assert.strictEqual(verifyFunc.outputs.length, 1, 'verifyExpense should return 1 value (bool)');
    console.log('✓ verifyExpense has correct signature\n');
    testsPassed++;

  } catch (error) {
    console.error('Test Error:', error.message);
    console.error(error.stack);
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
