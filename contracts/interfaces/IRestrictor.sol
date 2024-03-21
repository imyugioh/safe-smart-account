// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/Enum.sol";

interface IRestrictor {
    function checkRestriction(address to, uint256 value, bytes memory data) external;
}
