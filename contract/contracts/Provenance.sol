// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  Provenance
/// @notice Dual-track on-chain audit registry.
///         - Macro Track: SHA-256 dataset hashes (one-to-one string comparison).
///         - Micro Track: Merkle Roots of 1000-row inference batches.
///         Every batch is linked to a model, every model is linked to a dataset.
contract Provenance {

    // ── Structs ───────────────────────────────────────────────────────────────

    /// @dev Macro record: a registered Training/Testing dataset hash.
    struct DatasetRecord {
        address wallet;       // Registering MetaMask wallet
        uint256 timestamp;    // Block timestamp at registration
        bool    exists;       // Guard flag (avoids zero-hash collisions)
    }

    /// @dev Micro record: a Merkle Root anchored for one inference batch.
    struct BatchRecord {
        bytes32 merkleRoot;   // Aggregate Merkle Root for the 1000-row batch
        bytes32 modelHash;    // Which AI model produced this batch
        address wallet;
        uint256 timestamp;
        bool    exists;
    }

    // ── Macro Mapping: datasetHashes ─────────────────────────────────────────
    /// @notice Mapping (SHA-256 dataset hash → DatasetRecord).
    ///         Used for Tier-2 Macro verification: one-to-one hash comparison.
    mapping(bytes32 => DatasetRecord) public datasetHashes;

    // ── Relational Mapping: modelToDataset ───────────────────────────────────
    /// @notice Records which Training Dataset Hash a model was built from.
    ///         Enforces the rule: every Model Hash MUST link to a Dataset Hash.
    mapping(bytes32 => bytes32) public modelToDataset;

    // ── Micro Mapping: batchRoots ────────────────────────────────────────────
    /// @notice Mapping (batchId → BatchRecord).
    ///         Used for Tier-2 Micro verification: Merkle Proof path validation.
    mapping(uint256 => BatchRecord) public batchRoots;

    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a dataset SHA-256 hash is anchored on-chain.
    event DatasetAnchored(
        bytes32 indexed datasetHash,
        bytes32         prevHash,
        address indexed wallet,
        uint256         timestamp
    );

    /// @notice Emitted when a model is registered and linked to its training dataset.
    event ModelRegistered(
        bytes32 indexed modelHash,
        bytes32 indexed datasetHash,
        address         wallet,
        uint256         timestamp
    );

    /// @notice Emitted when an inference batch Merkle Root is anchored.
    event BatchRootAnchored(
        uint256 indexed batchId,
        bytes32 indexed merkleRoot,
        bytes32 indexed modelHash,
        address         wallet,
        uint256         timestamp
    );

    // ── Macro Functions ───────────────────────────────────────────────────────

    /// @notice Register a Training or Testing dataset's SHA-256 hash on-chain.
    ///         Reverts if the hash was already anchored (idempotent guard).
    /// @param  _hash     SHA-256 hash of the dataset file (as bytes32).
    /// @param  _prevHash SHA-256 hash of the previous version (bytes32(0) if first).
    function anchorDatasetHash(bytes32 _hash, bytes32 _prevHash) external {
        require(!datasetHashes[_hash].exists, "Dataset hash already anchored");

        // If a previous version is supplied, it must already exist
        if (_prevHash != bytes32(0)) {
            require(datasetHashes[_prevHash].exists, "Previous dataset not found");
        }

        datasetHashes[_hash] = DatasetRecord({
            wallet:    msg.sender,
            timestamp: block.timestamp,
            exists:    true
        });

        emit DatasetAnchored(_hash, _prevHash, msg.sender, block.timestamp);
    }

    /// @notice Register a model hash and link it to its Training Dataset hash.
    ///         Reverts if the dataset does not exist or the model is already registered.
    /// @param  _modelHash    SHA-256 hash of the model artifact.
    /// @param  _datasetHash  SHA-256 hash of the Training Dataset used to build this model.
    function registerModel(
        bytes32 _modelHash,
        bytes32 _datasetHash,
        bytes32 /* _prevModelHash */
    ) external {
        require(datasetHashes[_datasetHash].exists, "Training dataset not anchored");
        require(modelToDataset[_modelHash] == bytes32(0), "Model already registered");

        modelToDataset[_modelHash] = _datasetHash;

        emit ModelRegistered(_modelHash, _datasetHash, msg.sender, block.timestamp);
    }

    // ── Macro Verification ────────────────────────────────────────────────────

    /// @notice Tier-2 Macro: verify a dataset hash exists on-chain (one-to-one comparison).
    /// @param  _hash The SHA-256 hash to verify.
    /// @return True if the hash was previously anchored.
    function verifyDatasetHash(bytes32 _hash) external view returns (bool) {
        return datasetHashes[_hash].exists;
    }

    // ── Micro Functions ───────────────────────────────────────────────────────

    /// @notice Anchor the Merkle Root for one 1000-row inference batch.
    ///         The model hash must already be registered (linked to a dataset).
    ///         Reverts if the batch ID was already anchored.
    /// @param  _batchId    Unique batch identifier (autoincrement from SQLite).
    /// @param  _merkleRoot Aggregate Merkle Root for the batch.
    /// @param  _modelHash  Model that produced this batch.
    function anchorBatchRoot(
        uint256 _batchId,
        bytes32 _merkleRoot,
        bytes32 _modelHash
    ) external {
        require(modelToDataset[_modelHash] != bytes32(0), "Model not registered");
        require(!batchRoots[_batchId].exists, "Batch already anchored");

        batchRoots[_batchId] = BatchRecord({
            merkleRoot: _merkleRoot,
            modelHash:  _modelHash,
            wallet:     msg.sender,
            timestamp:  block.timestamp,
            exists:     true
        });

        emit BatchRootAnchored(_batchId, _merkleRoot, _modelHash, msg.sender, block.timestamp);
    }

    // ── Micro Verification ────────────────────────────────────────────────────

    /// @notice Tier-2 Micro: verify a Merkle Root matches the on-chain anchored root.
    ///         Used for Merkle Proof path validation in GET /verify/proof/{row_id}.
    /// @param  _batchId    Batch to check.
    /// @param  _merkleRoot Root computed client-side from the Merkle proof path.
    /// @return True if the provided root matches the anchored batch root.
    function verifyBatchRoot(uint256 _batchId, bytes32 _merkleRoot) external view returns (bool) {
        return batchRoots[_batchId].exists &&
               batchRoots[_batchId].merkleRoot == _merkleRoot;
    }

    /// @notice Convenience getter — returns the full BatchRecord for a given batchId.
    function getBatchRecord(uint256 _batchId) external view returns (BatchRecord memory) {
        require(batchRoots[_batchId].exists, "Batch not found");
        return batchRoots[_batchId];
    }

    /// @notice Convenience getter — returns the Training Dataset linked to a model.
    function getModelDataset(bytes32 _modelHash) external view returns (bytes32) {
        return modelToDataset[_modelHash];
    }
}