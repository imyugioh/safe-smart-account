// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../external/SafeMath.sol";
import "../common/Enum.sol";
import "hardhat/console.sol";

/**
 * @title RestrictorUpgradeable
 * @dev Manages addresses to restrict them from token receiving and methods call,
 *      as well as capping their daily/monthly token receiving amount
 * @author Bitbaby - @imyugioh
 */
contract RestrictorUpgradeable is OwnableUpgradeable {
    using SafeMath for uint256;

    /*//////////////////////////////////////////////////////////////
                               Events
    //////////////////////////////////////////////////////////////*/
    event AddProxy(address indexed proxy);
    event RemoveProxy(address indexed proxy);
    event AddWhitelistMethod(address indexed proxy, bytes4 indexed selector);
    event RemoveWhitelistMethod(address indexed proxy, bytes4 indexed selector);
    event AddWhitelistAddress(address indexed proxy, address indexed user);
    event RemoveWhitelistAddress(address indexed proxy, address indexed user);

    event UpdateDailyCap(address indexed proxy, address indexed user, address indexed token, uint256 amount);
    event UpdateMonthlyCap(address indexed proxy, address indexed user, address indexed token, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                               Constants
    //////////////////////////////////////////////////////////////*/
    address public constant EthAddress = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /*//////////////////////////////////////////////////////////////
                            Enum & Structs
    //////////////////////////////////////////////////////////////*/
    enum TransactionType {
        None,
        NativeTransfer,
        ERC20Transfer,
        ExternalCall
    }

    /*//////////////////////////////////////////////////////////////
                            Storage Variables
    //////////////////////////////////////////////////////////////*/

    // Mapping to keep track of all registered proxies registered by owner
    mapping(address => bool) public isRegisteredProxy;
    // Mapping to keep track of all allowed recipients registered by owner
    mapping(address => mapping(address => bool)) public isAllowedAddress;
    // Mapping to keep track of all allowed methods registered by owner
    mapping(address => mapping(bytes4 => bool)) public isAllowedMethod;
    // Mapping to keep track of cap info everytime safe proxies transfer native token or ERC20 tokens
    mapping(address => mapping(address => mapping(address => uint256))) public dailyCap; // proxy => user => token => amount
    mapping(address => mapping(address => mapping(address => uint256))) public monthlyCap; // proxy => user => token => amount
    mapping(address => mapping(address => mapping(address => mapping(uint256 => uint256)))) public dailyAmount; // proxy => user => token => day => amount
    mapping(address => mapping(address => mapping(address => mapping(uint256 => uint256)))) public monthlyAmount; // proxy => user => token => month => amount

    /*//////////////////////////////////////////////////////////////
                               Initializer
    //////////////////////////////////////////////////////////////*/
    function initialize() public initializer {
        __Ownable_init();
    }

    /*//////////////////////////////////////////////////////////////
                               Modifiers
    //////////////////////////////////////////////////////////////*/
    modifier onlyProxy(address proxy) {
        require(isRegisteredProxy[proxy], "Not registered proxy");
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            External Functions
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Register Gnosis Safe Proxy addresses
     * @param proxies Proxy address array
     */
    function registerProxies(address[] calldata proxies) external onlyOwner {
        for (uint256 i; i < proxies.length; i++) {
            isRegisteredProxy[proxies[i]] = true;
            emit AddProxy(proxies[i]);
        }
    }

    /**
     * @notice Remove Gnosis Safe Proxy addresses
     * @param proxies Proxy address array
     */
    function removeProxies(address[] calldata proxies) external onlyOwner {
        for (uint256 i; i < proxies.length; i++) {
            isRegisteredProxy[proxies[i]] = false;
            emit RemoveProxy(proxies[i]);
        }
    }

    /**
     * @notice Whitelist recipient addresses
     * @param users User address array
     */
    function addWhitelistAddresses(address proxy, address[] calldata users) external onlyOwner onlyProxy(proxy) {
        for (uint256 i; i < users.length; i++) {
            isAllowedAddress[proxy][users[i]] = true;
            emit AddWhitelistAddress(proxy, users[i]);
        }
    }

    /**
     * @notice Remove recipient addresses from whitelist
     * @param users User address array
     */
    function removeWhitelistAddresses(address proxy, address[] calldata users) external onlyOwner onlyProxy(proxy) {
        for (uint256 i; i < users.length; i++) {
            isAllowedAddress[proxy][users[i]] = false;
            emit RemoveWhitelistAddress(proxy, users[i]);
        }
    }

    /**
     * @notice Whitelist methods
     * @param selectors Function selector array
     */
    function addWhitelistMethods(address proxy, bytes4[] calldata selectors) external onlyOwner onlyProxy(proxy) {
        for (uint256 i; i < selectors.length; i++) {
            isAllowedMethod[proxy][selectors[i]] = true;
            emit AddWhitelistMethod(proxy, selectors[i]);
        }
    }

    /**
     * @notice Remove methods from whitelist
     * @param selectors Function selector array
     */
    function removeWhitelistMethods(address proxy, bytes4[] calldata selectors) external onlyOwner onlyProxy(proxy) {
        for (uint256 i; i < selectors.length; i++) {
            isAllowedMethod[proxy][selectors[i]] = false;
            emit RemoveWhitelistMethod(proxy, selectors[i]);
        }
    }

    /**
     * @notice Set daily token receive cap from users.
     * @param users User address array
     * @param tokens ERC20 Token address array
     * @param amounts Cap amount array
     */
    function setDailyCap(
        address proxy,
        address[] memory users,
        address[] memory tokens,
        uint256[] memory amounts
    ) public onlyOwner onlyProxy(proxy) {
        require(users.length == tokens.length, "Length Mismatch");
        require(tokens.length == amounts.length, "Length Mismatch");

        for (uint256 i; i < users.length; i++) {
            dailyCap[proxy][users[i]][tokens[i]] = amounts[i];
            emit UpdateDailyCap(proxy, users[i], tokens[i], amounts[i]);
        }
    }

    /**
     * @notice Set monthly token receive cap from users.
     * @param users User address array
     * @param tokens ERC20 Token address array
     * @param amounts Cap amount array
     */
    function setMonthlyCap(
        address proxy,
        address[] memory users,
        address[] memory tokens,
        uint256[] memory amounts
    ) public onlyOwner onlyProxy(proxy) {
        require(users.length == tokens.length, "Length Mismatch");
        require(tokens.length == amounts.length, "Length Mismatch");

        for (uint256 i; i < users.length; i++) {
            monthlyCap[proxy][users[i]][tokens[i]] = amounts[i];

            emit UpdateMonthlyCap(proxy, users[i], tokens[i], amounts[i]);
        }
    }

    /**
     * @notice Check the restriction status and update cap status
     * @dev This function should be called from the Gnosis Safe Proxies only.
     * @param to To address
     * @param value Native token value
     * @param data Tx payload
     */
    function checkRestriction(address to, uint256 value, bytes memory data) external onlyProxy(msg.sender) {
        (bytes4 selector, TransactionType txType, address recipient, uint256 amount) = _checkTransferType(to, value, data);

        if (txType == TransactionType.NativeTransfer) {
            require(isAllowedAddress[msg.sender][recipient], "Not allowed address");
            _updateCapData(msg.sender, recipient, EthAddress, amount);
        } else if (txType == TransactionType.ERC20Transfer) {
            require(isAllowedAddress[msg.sender][recipient], "Not allowed address");
            _updateCapData(msg.sender, recipient, to, amount);
        } else if (txType == TransactionType.ExternalCall) {
            require(isAllowedMethod[msg.sender][selector], "Not allowed method");
        }
    }

    /*//////////////////////////////////////////////////////////////
                            Internal Functions
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice Check tx type if it is Native token transfer or ERC20 Transfer.
     * @param to To Address
     * @param value Native token value
     * @param data Tx payload
     * @return selector Function selector
     * @return txType Enum tx type
     * @return recipient Token/Native Recipient
     * @return amount Token/Native amount
     */
    function _checkTransferType(
        address to,
        uint256 value,
        bytes memory data
    ) internal pure returns (bytes4 selector, TransactionType txType, address recipient, uint256 amount) {
        // Ensure data length is at least 4 bytes (function selector length)
        if (data.length < 4) {
            if (value != 0) {
                return (0x0, TransactionType.NativeTransfer, to, value);
            }
        }

        assembly {
            selector := mload(add(data, 32))
        }
        // 0xa9059cbb - keccack("transfer(address,uint256)")
        if (selector == 0xa9059cbb) {
            txType = TransactionType.ERC20Transfer;

            assembly {
                recipient := mload(add(data, 36))
                amount := mload(add(data, 68))
            }
        } else txType = TransactionType.ExternalCall;
    }

    /**
     * @notice Update cap status from contract storage
     * @param user User address
     * @param token Token address
     * @param amount Token amount
     */
    function _updateCapData(address proxy, address user, address token, uint256 amount) internal {
        uint256 _dailyLimit = dailyCap[proxy][user][token];
        if (_dailyLimit != 0) {
            uint256 _dayIndex = block.timestamp / 1 days;
            uint256 _dailyReceived = dailyAmount[proxy][user][token][_dayIndex];
            require(_dailyLimit >= _dailyReceived.add(amount), "Daily amount exceeded");

            dailyAmount[proxy][user][token][_dayIndex] = _dailyReceived.add(amount);
        }
        uint256 _monthlyLimit = monthlyCap[proxy][user][token];
        if (_monthlyLimit != 0) {
            uint256 _monthIndex = block.timestamp / 30 days;
            uint256 _monthlyReceived = monthlyAmount[proxy][user][token][_monthIndex];
            require(_monthlyLimit >= _monthlyReceived.add(amount), "Monthly amount exceeded");

            monthlyAmount[proxy][user][token][_monthIndex] = _monthlyReceived.add(amount);
        }
    }
}
