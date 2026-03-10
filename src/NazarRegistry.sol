// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title NazarRegistry
 * @notice Immutable one-to-one binding between a wallet address and a Strava athlete ID.
 * @dev Registration requires an EIP-712 signature from the ORACLE_ROLE backend, confirming
 *      that the user has completed OAuth with Strava. Once registered, the binding is permanent.
 *      This prevents multi-account abuse (1 wallet <-> 1 Strava, forever).
 */
contract NazarRegistry is AccessControl, Pausable, EIP712 {
    using ECDSA for bytes32;

    // ─── Roles ─────────────────────────────────────────────────────────────────
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    // ─── EIP-712 TypeHash ──────────────────────────────────────────────────────
    bytes32 public constant REGISTER_TYPEHASH = keccak256(
        "Register(address wallet,uint256 stravaAthleteId,uint256 nonce,uint256 deadline)"
    );

    // ─── Storage ───────────────────────────────────────────────────────────────
    /// @dev wallet → stravaAthleteId (0 = not registered)
    mapping(address => uint256) private _walletToStrava;

    /// @dev stravaAthleteId → wallet (address(0) = not registered)
    mapping(uint256 => address) private _stravaToWallet;

    /// @dev per-wallet nonce to prevent signature replay
    mapping(address => uint256) public nonces;

    // ─── Events ────────────────────────────────────────────────────────────────
    event Registered(address indexed wallet, uint256 indexed stravaAthleteId);

    // ─── Errors ────────────────────────────────────────────────────────────────
    error AlreadyRegistered(address wallet);
    error StravaIdAlreadyBound(uint256 stravaAthleteId);
    error InvalidSignature();
    error SignatureExpired();

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address admin, address oracle, bool _devMode)
        EIP712("NazarRegistry", "1")
    {
        devMode = _devMode;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ─── External ──────────────────────────────────────────────────────────────

    /**
     * @notice Dev-only bypass: register without a signature.
     * @dev Only callable when devMode is true (set at deploy time, immutable).
     *      Use this in Remix VM / local testing where eth_signTypedData_v4 is unavailable.
     *      On mainnet/testnet deploy with devMode = false — this function becomes permanently
     *      unreachable since the require is on an immutable bool.
     */
    bool public immutable devMode;

    function devRegister(uint256 stravaAthleteId) external whenNotPaused {
        require(devMode, "devMode disabled");
        if (_walletToStrava[msg.sender] != 0) revert AlreadyRegistered(msg.sender);
        if (_stravaToWallet[stravaAthleteId] != address(0)) revert StravaIdAlreadyBound(stravaAthleteId);
        _walletToStrava[msg.sender] = stravaAthleteId;
        _stravaToWallet[stravaAthleteId] = msg.sender;
        nonces[msg.sender]++;
        emit Registered(msg.sender, stravaAthleteId);
    }

    /**
     * @notice Register msg.sender to a Strava athlete ID.
     * @dev The backend signs a typed hash of (wallet, stravaAthleteId, nonce, deadline)
     *      after confirming the user completed the Strava OAuth flow.
     * @param stravaAthleteId  The Strava athlete ID from the OAuth response.
     * @param deadline         Unix timestamp after which the signature expires.
     * @param sig              EIP-712 signature from the ORACLE_ROLE backend signer.
     */
    function register(
        uint256 stravaAthleteId,
        uint256 deadline,
        bytes calldata sig
    ) external whenNotPaused {
        if (_walletToStrava[msg.sender] != 0) revert AlreadyRegistered(msg.sender);
        if (_stravaToWallet[stravaAthleteId] != address(0)) revert StravaIdAlreadyBound(stravaAthleteId);
        if (block.timestamp > deadline) revert SignatureExpired();

        uint256 currentNonce = nonces[msg.sender]++;

        bytes32 structHash = keccak256(
            abi.encode(REGISTER_TYPEHASH, msg.sender, stravaAthleteId, currentNonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(sig);

        if (!hasRole(ORACLE_ROLE, signer)) revert InvalidSignature();

        _walletToStrava[msg.sender] = stravaAthleteId;
        _stravaToWallet[stravaAthleteId] = msg.sender;

        emit Registered(msg.sender, stravaAthleteId);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function isRegistered(address wallet) external view returns (bool) {
        return _walletToStrava[wallet] != 0;
    }

    function getStravaId(address wallet) external view returns (uint256) {
        return _walletToStrava[wallet];
    }

    function getWallet(uint256 stravaAthleteId) external view returns (address) {
        return _stravaToWallet[stravaAthleteId];
    }

    // ─── EIP-712 helpers ────────────────────────────────────────────────────────

    /// @notice Public wrapper for EIP-712 digest computation (used by tests and backend).
    function hashTypedDataV4(bytes32 structHash) external view returns (bytes32) {
        return _hashTypedDataV4(structHash);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
}
