// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
import "../common/SelfAuthorized.sol";
import "../interfaces/IRestrictor.sol";

/**
 * @title RestrictManager - Manages Restrictor
 * @author bitbaby - @imyugioh
 */
abstract contract RestrictManager is SelfAuthorized {
    event ChangeManager(address indexed manager);

    // keccak256("restrict_manager.restrictor.address")
    bytes32 internal constant RESTRICTOR_STORAGE_SLOT = 0xeff06c0633b04c19eff8e0c0d51c9c826e81c259047ef621fe363b43e750715a;

    /**
     * @notice Sets the initial storage of the contract.
     * @param _restrictor Restrictor address.
     */
    function setupRestrictor(address _restrictor) internal {
        bytes32 slot = RESTRICTOR_STORAGE_SLOT;
        assembly {
            sstore(slot, _restrictor)
        }
        emit ChangeManager(_restrictor);
    }

    /**
     * @notice Change the restrictor address.
     * @dev This should be called by safe proxy itself.
     * @param _restrictor Restrictor address.
     */
    function changeRestrictor(address _restrictor) public authorized {
        bytes32 slot = RESTRICTOR_STORAGE_SLOT;
        assembly {
            sstore(slot, _restrictor)
        }
        emit ChangeManager(_restrictor);
    }

    /**
     * @notice Returns a restrictor address.
     * @return restrictor Restrictor address.
     */
    function getRestrictor() public view returns (address restrictor) {
        bytes32 slot = RESTRICTOR_STORAGE_SLOT;
        assembly {
            restrictor := sload(slot)
        }
    }
}
