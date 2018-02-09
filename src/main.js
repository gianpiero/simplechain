
var simplechain = require('./simplechain');
var Block = simplechain.Block;
var Blockchain = simplechain.Blockchain;

var test = function() {
    var blockchain = new Blockchain();
    console.log("Before adding new block:\n");
    blockchain.print();
    var newBlock = blockchain.generateNextBlock("I am a new block");
    console.log("After adding new block:\n");
    blockchain.print();
}

test();
