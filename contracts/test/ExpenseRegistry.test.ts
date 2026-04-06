import { expect } from "chai";
import { ethers } from "hardhat";

describe("ExpenseRegistry", function () {
  let expenseRegistry: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    const ExpenseRegistry = await ethers.getContractFactory("ExpenseRegistry");
    expenseRegistry = await ExpenseRegistry.deploy();
    await expenseRegistry.deployed();

    [owner, addr1, addr2] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(expenseRegistry.address).to.not.be.undefined;
    });
  });

  describe("Register Expense", function () {
    it("Should register an expense and increment count", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const amount = ethers.utils.parseEther("100");
      const category = "Food";

      await expenseRegistry.connect(owner).registerExpense(dataHash, amount, category);

      const count = await expenseRegistry.getExpenseCount(owner.address);
      expect(count).to.equal(1);
    });

    it("Should register multiple expenses from the same user", async function () {
      const dataHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const dataHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt2"));
      const amount = ethers.utils.parseEther("50");

      await expenseRegistry.connect(owner).registerExpense(dataHash1, amount, "Food");
      await expenseRegistry.connect(owner).registerExpense(dataHash2, amount, "Transport");

      const count = await expenseRegistry.getExpenseCount(owner.address);
      expect(count).to.equal(2);
    });

    it("Should emit ExpenseRegistered event", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const amount = ethers.utils.parseEther("100");
      const category = "Food";

      await expect(
        expenseRegistry.connect(owner).registerExpense(dataHash, amount, category)
      )
        .to.emit(expenseRegistry, "ExpenseRegistered")
        .withArgs(owner.address, dataHash, amount, category);
    });
  });

  describe("Get Expense", function () {
    beforeEach(async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const amount = ethers.utils.parseEther("100");
      const category = "Food";

      await expenseRegistry.connect(owner).registerExpense(dataHash, amount, category);
    });

    it("Should retrieve stored expense data", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const amount = ethers.utils.parseEther("100");
      const category = "Food";

      const [returnedHash, timestamp, returnedAmount, returnedCategory] =
        await expenseRegistry.getExpense(owner.address, 0);

      expect(returnedHash).to.equal(dataHash);
      expect(returnedAmount).to.equal(amount);
      expect(returnedCategory).to.equal(category);
      expect(timestamp).to.be.gt(0);
    });

    it("Should revert when index is out of bounds", async function () {
      await expect(
        expenseRegistry.getExpense(owner.address, 10)
      ).to.be.revertedWith("Index out of bounds");
    });
  });

  describe("Verify Expense", function () {
    beforeEach(async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const amount = ethers.utils.parseEther("100");
      const category = "Food";

      await expenseRegistry.connect(owner).registerExpense(dataHash, amount, category);
    });

    it("Should verify correct hash", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));

      const isVerified = await expenseRegistry.verifyExpense(owner.address, 0, dataHash);
      expect(isVerified).to.be.true;
    });

    it("Should return false for incorrect hash", async function () {
      const wrongHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("wrongreceipt"));

      const isVerified = await expenseRegistry.verifyExpense(owner.address, 0, wrongHash);
      expect(isVerified).to.be.false;
    });

    it("Should revert when index is out of bounds", async function () {
      const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));

      await expect(
        expenseRegistry.verifyExpense(owner.address, 10, dataHash)
      ).to.be.revertedWith("Index out of bounds");
    });
  });

  describe("Pagination - getExpensesByRange", function () {
    beforeEach(async function () {
      // Register 5 expenses
      for (let i = 0; i < 5; i++) {
        const dataHash = ethers.utils.keccak256(
          ethers.utils.toUtf8Bytes(`receipt${i}`)
        );
        const amount = ethers.utils.parseEther((i + 1).toString());
        const category = `Category${i}`;

        await expenseRegistry.connect(owner).registerExpense(dataHash, amount, category);
      }
    });

    it("Should return expenses within range", async function () {
      const expenses = await expenseRegistry.getExpensesByRange(owner.address, 1, 3);

      expect(expenses.length).to.equal(2);
      expect(expenses[0].amount).to.equal(ethers.utils.parseEther("2"));
      expect(expenses[1].amount).to.equal(ethers.utils.parseEther("3"));
    });

    it("Should return all expenses with full range", async function () {
      const expenses = await expenseRegistry.getExpensesByRange(owner.address, 0, 5);

      expect(expenses.length).to.equal(5);
    });

    it("Should return empty array for zero-length range", async function () {
      const expenses = await expenseRegistry.getExpensesByRange(owner.address, 2, 2);

      expect(expenses.length).to.equal(0);
    });

    it("Should revert on invalid range (start > end)", async function () {
      await expect(
        expenseRegistry.getExpensesByRange(owner.address, 3, 1)
      ).to.be.revertedWith("Invalid range: start must be <= end");
    });

    it("Should revert when end index is out of bounds", async function () {
      await expect(
        expenseRegistry.getExpensesByRange(owner.address, 0, 10)
      ).to.be.revertedWith("End index out of bounds");
    });
  });

  describe("Multi-user functionality", function () {
    it("Should maintain separate expense lists for different users", async function () {
      const dataHash1 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt1"));
      const dataHash2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("receipt2"));
      const amount = ethers.utils.parseEther("100");

      await expenseRegistry.connect(owner).registerExpense(dataHash1, amount, "Food");
      await expenseRegistry.connect(addr1).registerExpense(dataHash2, amount, "Food");

      const ownerCount = await expenseRegistry.getExpenseCount(owner.address);
      const addr1Count = await expenseRegistry.getExpenseCount(addr1.address);

      expect(ownerCount).to.equal(1);
      expect(addr1Count).to.equal(1);

      const [ownerHash] = await expenseRegistry.getExpense(owner.address, 0);
      const [addr1Hash] = await expenseRegistry.getExpense(addr1.address, 0);

      expect(ownerHash).to.equal(dataHash1);
      expect(addr1Hash).to.equal(dataHash2);
    });
  });
});
