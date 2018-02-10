
var simplechain = require('./simplechain');
var p2p = require('./p2p');
var P2P = p2p.P2P;
var Block = simplechain.Block;
var Blockchain = simplechain.Blockchain;

var bodyParser = require('body-parser');
var express = require('express');

var httpPort = parseInt(process.env.HTTP_PORT) || 3001;

var blockchain = new Blockchain();
var p2p = new P2P(blockchain);

var initHttpServer = function (myHttpPort) {
    var app = express();
    app.use(bodyParser.json());
    app.get('/blocks', function (req, res) {
        res.send(blockchain.getBlockchain());
    });
    app.post('/mineBlock', function (req, res) {
        var newBlock = blockchain.generateNextBlock(req.body.data);
        res.send(newBlock);
    });
    app.listen(myHttpPort, function () {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);

var test = function() {

    var blockchain = new Blockchain();
    var p2p = new P2P(blockchain);
    console.log("Before adding new block:\n");
    blockchain.print();
    var newBlock = blockchain.generateNextBlock("I am a new block");
    console.log("After adding new block:\n");
    blockchain.print();
}
