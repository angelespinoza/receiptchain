// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ExpenseRegistry is Ownable {
    struct Expense {
        bytes32 dataHash;
        uint256 timestamp;
        uint256 amount;
        string category;
    }

    mapping(address => Expense[]) public userExpenses;

    // Authorized relayers that can submit transactions on behalf of users
    mapping(address => bool) public authorizedRelayers;

    event ExpenseRegistered(
        address indexed user,
        bytes32 dataHash,
        uint256 amount,
        string category,
        uint256 timestamp
    );

    event RelayerUpdated(address indexed relayer, bool authorized);

    constructor() Ownable(msg.sender) {
        // The deployer is automatically the owner and first relayer
        authorizedRelayers[msg.sender] = true;
    }

    modifier onlyRelayer() {
        require(authorizedRelayers[msg.sender], "Not an authorized relayer");
        _;
    }

    // ─── Admin Functions ───

    /// @notice Add or remove a relayer address
    /// @param _relayer Address to authorize/deauthorize
    /// @param _authorized Whether to authorize or deauthorize
    function setRelayer(address _relayer, bool _authorized) external onlyOwner {
        authorizedRelayers[_relayer] = _authorized;
        emit RelayerUpdated(_relayer, _authorized);
    }

    // ─── User-Direct Registration (user pays gas) ───

    /// @notice Register an expense directly (user pays gas)
    function registerExpense(
        bytes32 _dataHash,
        uint256 _amount,
        string calldata _category
    ) external {
        _registerExpenseFor(msg.sender, _dataHash, _amount, _category);
    }

    // ─── Relayed Registration (relayer pays gas) ───

    /// @notice Register an expense on behalf of a user (relayer pays gas)
    /// @param _user The user's wallet address
    /// @param _dataHash Hash of the expense data
    /// @param _amount Amount in wei
    /// @param _category Expense category
    function registerExpenseFor(
        address _user,
        bytes32 _dataHash,
        uint256 _amount,
        string calldata _category
    ) external onlyRelayer {
        _registerExpenseFor(_user, _dataHash, _amount, _category);
    }

    /// @notice Register multiple expenses in a single transaction (batch, relayer pays gas)
    /// @param _users Array of user addresses
    /// @param _dataHashes Array of data hashes
    /// @param _amounts Array of amounts
    /// @param _categories Array of categories
    function batchRegisterExpenses(
        address[] calldata _users,
        bytes32[] calldata _dataHashes,
        uint256[] calldata _amounts,
        string[] calldata _categories
    ) external onlyRelayer {
        require(
            _users.length == _dataHashes.length &&
            _users.length == _amounts.length &&
            _users.length == _categories.length,
            "Arrays length mismatch"
        );

        for (uint256 i = 0; i < _users.length; i++) {
            _registerExpenseFor(_users[i], _dataHashes[i], _amounts[i], _categories[i]);
        }
    }

    // ─── Internal ───

    function _registerExpenseFor(
        address _user,
        bytes32 _dataHash,
        uint256 _amount,
        string calldata _category
    ) internal {
        Expense memory newExpense = Expense({
            dataHash: _dataHash,
            timestamp: block.timestamp,
            amount: _amount,
            category: _category
        });

        userExpenses[_user].push(newExpense);

        emit ExpenseRegistered(
            _user,
            _dataHash,
            _amount,
            _category,
            block.timestamp
        );
    }

    // ─── Read Functions ───

    function getExpenseCount(address _user) external view returns (uint256) {
        return userExpenses[_user].length;
    }

    function getExpense(address _user, uint256 _index)
        external
        view
        returns (bytes32, uint256, uint256, string memory)
    {
        require(_index < userExpenses[_user].length, "Index out of bounds");
        Expense memory expense = userExpenses[_user][_index];
        return (expense.dataHash, expense.timestamp, expense.amount, expense.category);
    }

    function getExpensesByRange(
        address _user,
        uint256 _start,
        uint256 _end
    ) external view returns (Expense[] memory) {
        require(_start <= _end, "Invalid range");
        require(_end <= userExpenses[_user].length, "End out of bounds");

        uint256 length = _end - _start;
        Expense[] memory result = new Expense[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = userExpenses[_user][_start + i];
        }

        return result;
    }

    function verifyExpense(
        address _user,
        uint256 _index,
        bytes32 _dataHash
    ) external view returns (bool) {
        require(_index < userExpenses[_user].length, "Index out of bounds");
        return userExpenses[_user][_index].dataHash == _dataHash;
    }
}
