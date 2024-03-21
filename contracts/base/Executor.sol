// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/Enum.sol";
import "../base/RestrictManager.sol";

/**
 * @title Executor - A contract that can execute transactions
 * @author Richard Meissner - @rmeissner
 */
abstract contract Executor is RestrictManager {
    /**
     * @notice Executes either a delegatecall or a call with provided parameters.
     * @dev This method checks the restriction status before executing the transaction.
     *      But, it doesn't perform any sanity check of the transaction, such as:
     *      - if the contract at `to` address has code or not
     *      It is the responsibility of the caller to perform such checks.
     * @param to Destination address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @return success boolean flag indicating if the call succeeded.
     */
    function execute(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 txGas
    ) internal returns (bool success) {
        // Check the restriction first before executing the transaction.
        // It skips restriction check if it is calling self functions
        if (getRestrictor() != address(0) && to != address(this)) IRestrictor(getRestrictor()).checkRestriction(to, value, data);
        if (operation == Enum.Operation.DelegateCall) {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                success := delegatecall(txGas, to, add(data, 0x20), mload(data), 0, 0)
            }
        } else {
            // solhint-disable-next-line no-inline-assembly
            assembly {
                success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
            }
        }
    }
}
