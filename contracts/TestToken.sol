// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract TestToken is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // errors
    error UnexpectedInitializeParams();
    error MaxSupplyOutOfBound();
    error CannotBeLessThanTotalSupply();
    error SenderIsBlacklisted();
    error RecipientIsBlacklisted();
    error SendFeeIsMoreThan100Percent();

    // events
    event MaxSupplyChanged(uint256 newMaxTotalSupply);
    event BlacklistChanged(address user, bool isBlacklisted);
    event SendFeeChanged(uint256 newSendFee);

    /// @notice Role to request mint / burn.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Role allowed to upgrade the contract implementation
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @notice The maximum percentage of TEST that can be taken.
    uint256 public constant MAX_FEE = 10_000; // 100%

    /// @notice The maximum amount of TEST that can be minted during the original mint process.
    uint256 public maxTotalSupply;

    /// @notice The rate at which TEST is burned from the total supply per each transfer.
    uint256 public sendFee;

    mapping(address user => bool isBlacklisted) public blacklisted;

    struct Init {
        address admin;
        address minter;
        address burner;
        address upgrader;
        string name;
        string symbol;
        uint256 maxSupply;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev Initializes the contract with the provided name, symbol, and roles.
    function initialize(Init memory init) external initializer {
        if (
            init.admin == address(0) ||
            init.minter == address(0) ||
            init.burner == address(0) ||
            init.upgrader == address(0)
        ) {
            revert UnexpectedInitializeParams();
        }
        __ERC20_init(init.name, init.symbol);

        __AccessControl_init();
        __UUPSUpgradeable_init();

        // set admin roles
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(BURNER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(UPGRADER_ROLE, DEFAULT_ADMIN_ROLE);

        // grant admin roles
        _grantRole(DEFAULT_ADMIN_ROLE, init.admin);

        // grant sub roles
        _grantRole(MINTER_ROLE, init.minter);
        _grantRole(BURNER_ROLE, init.burner);
        _grantRole(UPGRADER_ROLE, init.upgrader);

        maxTotalSupply = init.maxSupply;
    }

    /// @notice Original mint function
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (maxTotalSupply != 0 && totalSupply() + amount > maxTotalSupply) {
            revert MaxSupplyOutOfBound();
        }

        _mint(to, amount);
    }

    /// @notice Original burn function
    function burn(address account, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(account, amount);
    }

    /// @notice Sets the maxTotalSupply variable
    function setMaxTotalSupply(uint256 newMaxTotalSupply) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
        if(newMaxTotalSupply < totalSupply()) {
            revert CannotBeLessThanTotalSupply();
        }
        maxTotalSupply = newMaxTotalSupply;
        emit MaxSupplyChanged(newMaxTotalSupply);
    }

    /**
     * @notice Sets the blacklist status of a user
     * @param user The user address 
     * @param status The blacklist status
     */
    function setBlacklist(address user, bool status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklisted[user] = status;

        emit BlacklistChanged(user, status);
    }

    /**
     * @notice Sets the sendFee variable
     * @param newSendFee The new sendFee 
     */
    function setSendFee(uint256 newSendFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if(newSendFee > 10_000) revert SendFeeIsMoreThan100Percent();
        sendFee = newSendFee;

        emit SendFeeChanged(newSendFee);
    }

    /// @dev Overrides the transfer function to apply the send fee and check if the user is blacklisted
    function transfer(address to, uint256 amount) public override returns (bool) {
        _beforeTokenTransfer(msg.sender, to);

        uint256 amountToTransfer = _applySendFee(amount); // yes, fee calculates only when somebody sends TEST :D

        return super.transfer(to, amountToTransfer);
    }

    /// @dev Overrides the transferFrom function to apply check if the user is blacklisted
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _beforeTokenTransfer(from, to);

        return super.transferFrom(from, to, amount);
    }

    /// @notice Applies the send fee to the amount
    function _applySendFee(uint256 amount) internal returns (uint256) {
        uint256 fee = amount * sendFee / MAX_FEE;
        _burn(msg.sender, fee);

        return amount - fee;
    }

    /// @notice Checks if the sender or recipient is blacklisted
    function _beforeTokenTransfer(address from, address to) internal view {
        if (blacklisted[from]) revert SenderIsBlacklisted();
        if (blacklisted[to]) revert RecipientIsBlacklisted();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}