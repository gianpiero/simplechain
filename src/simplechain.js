/*
 * (c) 2005-2018  Copyright, Real-Time Innovations, Inc. All rights reserved.
 * Subject to Eclipse Public License v1.0; see LICENSE.md for details.
 */

"use strict";

// ***************************************************************************
// Imported modules
// ***************************************************************************
var SHA256 = require("crypto-js/sha256");
var utils = require("./utils.js");

// Those parameters MUST be the same between all the peers
const BLOCK_GENERATION_INTERVAL = 10;       // In number of seconds
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;  // In number of blocks mined

const DEFAULT_DIFFICULTY = 4;

// ***************************************************************************
// Local Functions
// ***************************************************************************
/* Given a hash (string of 64-hex characters), and a difficulty (number), 
 * return true if the first 'difficulty' bits of the hash are all zeros.
 */
function hashMatchesDifficulty(hash, difficulty) {
    const hashInBinary = utils.hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
}

/* Calculates the new difficulty by looking at the global parameters and the 
 * time required to mine the last blocks in the given blockchain. Returns 
 * a number with the new difficulty.
 * The new difficulty is either the same as the current difficulty (difficulty from the
 * last block), or + or - 1 from it. 
 *
 * ExpectedTime = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL
 */
function getDifficulty(chain) {
    const latestBlock = chain[chain.length - 1];
    const currentDifficulty = latestBlock.difficulty;

    if (! (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) ) {
        // No need to re-adjust the difficulty
        return currentDifficulty;
    }
    // We re-adjust everyt DIFFICULTY_ADJUSTMENT_INTERVAL blocks (except first time)
    // Need re-adjustment now
    const prevAdjustmentBlock = chain[chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected/2) {
        // Too fast, increase difficulty
        return currentDifficulty + 1;
    }
    if (timeTaken > timeExpected*2) {
        // Too slow, decrease the difficulty
        return currentDifficulty - 1;
    }
    // Else we are in the right range, don't change the difficulty
    return currentDifficulty;
}
        
/* isValidTimestamp - Validates the timestamp of this block
 *
 * Block is valid if timestamp is at most 1 min in the future from the time we perceive
 * Block in the chain is valid if the timestamp is at most 1 min in the past of the
 * previous block
 */
function isValidTimestamp(newBlock, previousBlock) {
    return ( (previousBlock.timestamp - 60) < newBlock.timestamp) &&
           (newBlock.timestamp - 60 < utils.getCurrentTimestamp());
}

// Expects an object with the same properties as the Block 
// object (except for 'hash')
function calculateHash(params) {
    return SHA256(params.index + 
            params.previousHash + 
            params.timestamp + 
            params.data + 
            params.difficulty + 
            params.nonce).toString();
}



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
 *  difficulty: DEFAULT_DIFFICULTY
 *  nonce: 0
 *  hash: calculate the hash over the all the other values
 */
var Block = function(params) {
    params = params || {};

    // index is an integer >= 0
    this.index = params.index || 0;

    // previousHash is a string of exactly 64 characters (or null for the genesis block)
    this.previousHash = params.previousHash || null;

    // timestamp is an integer in UTC
    this.timestamp = params.timestamp || utils.getCurrentTimestamp();

    // data is anys tring
    this.data = params.data || null;

    // Current difficulty used when calculating the hash
    this.difficulty = params.difficulty || DEFAULT_DIFFICULTY;

    // The nonce used for matching the difficulty, set during proof of work
    this.nonce = params.nonce || 0;

    // hash is a string of exactly 64 characters
    this.hash = params.hash || calculateHash(this);

}

/*
 * The Genesis block is always the first element of the chain.
 * The values are not relevant as it is only a placeholder for the logic
 * to get the 'hash' value.
 */
const GENESIS_BLOCK = new Block();

/* Block.isEqual - Compares this block to another block.
 * Returns boolean true if the two blocks are the same. false otherwise
 */
Block.prototype.isEqual = function(block) {
    return (this.index === block.index) &&
           (this.hash  === block.hash) &&
           (this.previousHash === block.previousHash) &&
           (this.timestamp === block.timestamp) &&
           (this.data === block.data);
}

/* Block.isValidBlockStructure - Ensures the block has valid by enforcing
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
    var newBlockHash = calculateHash(newBlock);
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
Blockchain.prototype.generateNextBlock = function(data) {
    function findBlock(newIndex, previousHash, timestamp, difficulty) {
        for (let nonce=0;;++nonce) {
            const params = {
                    index: newIndex,
                    previousHash: previousHash,
                    timestamp: timestamp,
                    data: data,
                    difficulty: difficulty,
                    nonce: nonce
            }
            const hash = calculateHash(params);
            if (hashMatchesDifficulty(hash, difficulty)) {
                return new Block(params);
            }
        }
    }

    const lastBlock = this.getLatestBlock();
    const difficulty = getDifficulty(this.chain);
    const timestamp = utils.getCurrentTimestamp();
    // TODO: Log new difficulty
    var newBlock = findBlock(lastBlock.index+1, lastBlock.hash, timestamp, difficulty);
    this.addBlock(newBlock);
    return newBlock;
}



Blockchain.prototype.getBlockchain = function() {
    return this.chain;
}


/* Returns the cumulative difficulty of this chain
 * Cumulative difficulty is determined as:
 *  2^difficultyOfBlock0 + 2^difficultyOfBlock1 + ... 2^DifficultyOfLastBlock
 */
Blockchain.prototype.getAccumulatedDifficulty = function() {
    return this.chain.map( (block) => block.difficulty)
                     .map( (difficulty) => Math.pow(2, difficulty))
                     .reduce( (a,b) => a+b);
}


module.exports.Block = Block;
module.exports.Blockchain = Blockchain;
