const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Read the Solidity file
const contractPath = path.join(__dirname, 'contracts', 'ExpenseRegistry.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

// Create input for solc
const input = {
  language: 'Solidity',
  sources: {
    'contracts/ExpenseRegistry.sol': {
      content: contractSource,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
  },
};

// Compile
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Create artifacts directory
const artifactsDir = path.join(__dirname, 'artifacts', 'contracts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// Handle errors
if (output.errors) {
  console.error('Compilation errors:');
  output.errors.forEach(error => console.error(error.message));
  if (output.errors.some(e => e.severity === 'error')) {
    process.exit(1);
  }
}

// Save artifacts
const contracts = output.contracts['contracts/ExpenseRegistry.sol'];
const contract = contracts.ExpenseRegistry;

const artifact = {
  _format: 'hh-sol-artifact-1',
  contractName: 'ExpenseRegistry',
  sourceName: 'contracts/ExpenseRegistry.sol',
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
};

fs.writeFileSync(
  path.join(artifactsDir, 'ExpenseRegistry.json'),
  JSON.stringify(artifact, null, 2)
);

console.log('Compilation successful!');
console.log('Artifacts saved to artifacts/contracts/ExpenseRegistry.json');
