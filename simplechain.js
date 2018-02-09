"use strict";
var SHA256 = require("crypto-js/sha256");

var Block = function(params) {
    this.index = params.index;
    this.previousHash = params.previousHash;
    this.timestamp = params.timestamp;
    this.data = params.data;
    this.hash = params.hash;
}

Block.prototype.toString = function() {
    return "index: " + this.index + "\npreviousHash: " + this.previousHash + "\ntimestamp: " + this.timestamp + "\ndata: " + this.data + "\nhash: " + this.hash;
}

var isValidBlockStructure = function(block) {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};

var isValidNewBlock = function(params) {
    var newBlock = params.newBlock;
    var previousBlock = params.previousBlock;
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid structure');
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    }
    return true;
};

var genesisBlock = new Block({index: 0, hash: "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", previousHash: null, timestamp: 1465154705, data: 'my genesis block!!'})

var Blockchain = function(genesisBlock) {
    this.chain = [];
    this.chain.push(genesisBlock);
}

Blockchain.prototype.print = function() {
    for(var i=0; i < this.chain.length; i++) {
        console.log(this.chain[i].toString());
        console.log("-----");
    }
}

Blockchain.prototype.getLatestBlock = function() {
    return this.chain[this.chain.length -1]
}

Blockchain.prototype.addBlock = function(block) {
    if (isValidNewBlock({newBlock: block, previousBlock: this.getLatestBlock()})) {
        this.chain.push(block);
    }
}



var calculateHash = function(params) {
    return SHA256(params.index + params.previousHash + params.timestamp + params.data).toString();
}

var calculateHashForBlock = function(block) {
    return calculateHash({index: block.index, previousHash: block.previousHash, timestamp: block.timestamp, data: block.data})
}

Blockchain.prototype.generateNextBlock= function(blockData) {
    var previousBlock = this.getLatestBlock();
    var nextIndex = previousBlock.index + 1;
    var nextTimestamp = new Date().getTime() / 1000;
    var nextHash = calculateHash({index: nextIndex, previousHash: previousBlock.hash, timestamp: nextTimestamp, data:blockData});
    var newBlock = new Block({index: nextIndex, hash: nextHash, previousHash: previousBlock.hash, timestamp: nextTimestamp, data: blockData});
    this.addBlock(newBlock);
//    broadcastLatest();
    return newBlock;
}


var test = function() {
    var blockchain = new Blockchain(genesisBlock);
    console.log("Before adding new block:\n");
    blockchain.print();
    var newBlock = blockchain.generateNextBlock("I am a new block");
    console.log("After adding new block:\n");
    blockchain.print();
}

test();
