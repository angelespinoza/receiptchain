// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * ExpenseRegistry v3 — Privacy-first design
 * Only stores: dataHash (proof of expense) + imageCID (encrypted data on IPFS)
 * All personal details (merchant, amount, date, category, image) are
 * encrypted and stored on IPFS. Only the wallet owner can decrypt them.
 */
contract ExpenseRegistry is Ownable {
    struct Expense {
        bytes32 dataHash;     // keccak256 hash proving the expense exists
        string  dataCID;      // IPFS CID of encrypted payload (all details + image)
        uint256 timestamp;    // block timestamp of registration
    }

    mapping(address => Expense[]) public userExpenses;
    mapping(address => bool) public authorizedRelayers;

    event ExpenseRegistered(
        address indexed user,
        bytes32 dataHash,
        string  dataCID,
        uint256 timestamp
    );

    event RelayerUpdated(address indexed relayer, bool authorized);

    constructor() Ownable(msg.sender) {
        authorizedRelayers[msg.sender] = true;
    }

    modifier onlyRelayer() {
        require(authorizedRelayers[msg.sender], "Not an authorized relayer");
        _;
    }

    // ─── Admin ───

    function setRelayer(address _relayer, bool _authorized) external onlyOwner {
        authorizedRelayers[_relayer] = _authorized;
        emit RelayerUpdated(_relayer, _authorized);
    }

    // ─── Registration ───

    /// @notice Register expense directly (user pays gas)
    function registerExpense(
        bytes32 _dataHash,
        string calldata _dataCID
    ) external {
        _registerExpenseFor(msg.sender, _dataHash, _dataCID);
    }

    /// @notice Register expense on behalf of user (relayer pays gas)
    function registerExpenseFor(
        address _user,
        bytes32 _dataHash,
        string calldata _dataCID
    ) external onlyRelayer {
        _registerExpenseFor(_user, _dataHash, _dataCID);
    }

    /// @notice Batch register (relayer pays gas)
    function batchRegisterExpenses(
        address[] calldata _users,
        bytes32[] calldata _dataHashes,
        string[] calldata _dataCIDs
    ) external onlyRelayer {
        require(
            _users.length == _dataHashes.length &&
            _users.length == _dataCIDs.length,
            "Arrays length mismatch"
        );

        for (uint256 i = 0; i < _users.length; i++) {
            _registerExpenseFor(_users[i], _dataHashes[i], _dataCIDs[i]);
        }
    }

    // ─── Internal ───

    function _registerExpenseFor(
        address _user,
        bytes32 _dataHash,
        string calldata _dataCID
    ) internal {
        Expense memory newExpense = Expense({
            dataHash: _dataHash,
            dataCID: _dataCID,
            timestamp: block.timestamp
        });

        userExpenses[_user].push(newExpense);

        emit ExpenseRegistered(_user, _dataHash, _dataCID, block.timestamp);
    }

    // ─── Read ───

    function getExpenseCount(address _user) external view returns (uint256) {
        return userExpenses[_user].length;
    }

    function getExpense(address _user, uint256 _index)
        external view
        returns (bytes32 dataHash, string memory dataCID, uint256 timestamp)
    {
        require(_index < userExpenses[_user].length, "Index out of bounds");
        Expense memory e = userExpenses[_user][_index];
        return (e.dataHash, e.dataCID, e.timestamp);
    }

    function getExpensesByRange(address _user, uint256 _start, uint256 _end)
        external view
        returns (Expense[] memory)
    {
        require(_start <= _end, "Invalid range");
        require(_end <= userExpenses[_user].length, "End out of bounds");

        uint256 length = _end - _start;
        Expense[] memory result = new Expense[](length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = userExpenses[_user][_start + i];
        }
        return result;
    }

    function verifyExpense(address _user, uint256 _index, bytes32 _dataHash)
        external view
        returns (bool)
    {
        require(_index < userExpenses[_user].length, "Index out of bounds");
        return userExpenses[_user][_index].dataHash == _dataHash;
    }
}
