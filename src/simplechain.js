/*
 * (c) 2005-2018  Copyright, Real-Time Innovations, Inc. All rights reserved.
 * Subject to Eclipse Public License v1.0; see LICENSE.md for details.
 */

"use strict";

// ***************************************************************************
// Imported modules
// ***************************************************************************
var SHA256 = require("crypto-js/sha256");

// ***************************************************************************
// Block Class Definition
// ***************************************************************************
/* Builds a new Block. 
 * Parameters is an optional parameter containing optional properties mirroring
 * the inner properties of the Block object:
 * If some of the properties of the 'params' object are not specified, the following
 * default values will be used:
 *  index: 0
 *  previousHash: null
 *  timestamp: current time
 *  data: null
 *  hash: calculate the hash over the all the other values
 */
var Block = function(params) {
    params = params || {};

    // index is an integer >= 0
    this.index = params.index || 0;

    // previousHash is a string of exactly 64 characters (or null for the genesis block)
    this.previousHash = params.previousHash || null;

    // timestamp is an integer in UTC
    this.timestamp = params.timestamp || Number.parseInt(new Date().getTime()/1000);

    // data is anys tring
    this.data = params.data || null;

    // hash is a string of exactly 64 characters
    this.hash = params.hash || this.calculateHash();
}

/* Block.calculateHash - Calculates the hash of this block
 */
Block.prototype.calculateHash = function() {
    return SHA256(this.index + this.previousHash + this.timestamp + this.data).toString();
}

/*
 * The Genesis block is always the first element of the chain.
 * The values are not relevant as it is only a placeholder for the logic
 * to get the 'hash' value.
 */
const GENESIS_BLOCK = new Block();

/*
 * Block.isEqual - Compares this block to another block.
 * Returns boolean true if the two blocks are the same. false otherwise
 */
Block.prototype.isEqual = function(block) {
    return (this.index === block.index) &&
           (this.hash  === block.hash) &&
           (this.previousHash === block.previousHash) &&
           (this.timestamp === block.timestamp) &&
           (this.data === block.data);
}

/* block.isValidBlockStructure - Ensures the block has valid by enforcing
 * the type and range of its properties.
 * Returns the boolean true if the block has a valid structure.
 *
 * NOTE: This test will fail on the Genesis block. The algorithm here invokes
 *       this method only to validate new blocks.
 */
Block.prototype.isValidBlockStructure = function() {
    return (typeof this.index == 'number' && Number.isInteger(this.index) && this.index >= 0) &&
           (typeof this.hash == 'string' && this.hash.length == 64) &&
           (typeof this.previousHash == 'string' && this.previousHash.length == 64) &&
           (typeof this.timestamp == 'number' && Number.isInteger(this.timestamp) && this.timestamp > 0) &&
           (typeof this.data == 'string');
}

/* Block.isValidNewBlock - Validates the given new block and ensure it is
 * a valid block in the context of the current block.
 * Throws an exception if validation failed. Error message contains the
 * description of the reason why the block is not accepted
 * This method does not return any value
 */
Block.prototype.validateNextBlock = function(newBlock) {
    if (!(newBlock instanceof Block)) {
        throw new Error("New block is not a valid Block object");
    }
    if (!newBlock.isValidBlockStructure()) {
        throw new Error("New block have an invalid data structure: " + JSON.stringify(newBlock));
    }
    if (this.index + 1 !== newBlock.index) {
        throw new Error("New block have an invalid index. Expected=" + (this.index+1) + ", got=" + newBlock.index);
    } 
    if (this.hash !== newBlock.previousHash) {
        throw new Error("New block have an invalid previousHash");
    } 
    var newBlockHash = newBlock.calculateHash();
    if (newBlockHash != newBlock.hash) {
        throw new Error("New block have an invalid hash: Expected='%s', got='%s'", newBlockHash, newBlock.hash);
    }
}


// ***************************************************************************
// Blockchain Class Definition
// ***************************************************************************
var Blockchain = function() {
    this.chain = [GENESIS_BLOCK];
}

/* Static: validate the given chain is valid
 * It ensure the first element of the chain is our genesis object, and that all 
 * the following ones are correctly hash-linked.
 *
 * Throws an exception with the description of the error
 */
var validateChain = function(blockchainToValidate) {
    if (!GENESIS_BLOCK.isEqual(blockchainToValidate[0])) {
        throw new Error("First block is not genesis");
    }

    for (let i = 1; i < blockchainToValidate.length; i++) {
        blockchainToValidate[i-1].validateNextBlock(blockchainToValidate[i]);
    }
}

/* Blockchain.toString - Returns a string representation of this chain
 */
Blockchain.prototype.toString = function() {
    return JSON.stringify(this.chain);
}

/* Blockchain.toContentString - Returns an array of the data stored in the chain
 */
Blockchain.prototype.toContentString = function() {
    var data = [];

    // for Gianpiero: Ha ha!
    this.chain.slice(1).forEach( (elem) => { data.push(elem.data); });

    return JSON.stringify(data);
}

/* Blockchain.replaceChain - Validate the new chain and replace the current
 * chain with the new one.
 *
 * Throws an exception if chain cannot be replaced
 */
Blockchain.prototype.replaceChain = function (newChain) {
    newChain.validateChain();  // Will throw exception if received blockchain is not valid

    // Accept only if the new length is greater than our chain's length
    if (newChain.length <= this.chain.length) {
        throw new Error("Not blockchain not accepted as its length (%d) is <= of our chain (%d)", newChain.length, this.chain.length);
    }
    this.chain = newChain;
}

/* Blockchain.getLatestBlock - Returns the last block of the chain
 */
Blockchain.prototype.getLatestBlock = function() {
    return this.chain[this.chain.length -1]
}

/* Blockchain.addBlock - Adds a block to this chain
 * Throws an exception if the new block cannot be added.
 */
Blockchain.prototype.addBlock = function(block) {
    this.getLatestBlock().validateNextBlock(block); // Throws if invalid
    this.chain.push(block);
}

/* Blockchain.generateNextBlock - Generates a new block, appends it to the current
 * chain and broadcast it through the P2P
 */
Blockchain.prototype.generateNextBlock= function(data) {
    var lastBlock = this.getLatestBlock();
    var newBlock = new Block({index: (lastBlock.index + 1), previousHash: lastBlock.hash, data: data});
    this.addBlock(newBlock);
    return newBlock;
}

Blockchain.prototype.getBlockchain = function() {
    return this.chain;
}

module.exports.Block = Block;
module.exports.Blockchain = Blockchain;
