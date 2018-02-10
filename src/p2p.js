var simplechain = require('./simplechain');
var Block = simplechain.Block;
var Blockchain = simplechain.Blockchain;

var rti   = require('rticonnextdds-connector');
var DEBUG = true;
var MessageType = {"QUERY_LATEST":0, "QUERY_ALL":1, "RESPONSE_BLOCKCHAIN":2};

var P2P = function(blockchain) {
    this.blockchain = blockchain;

    var connector = new rti.Connector("MyParticipantLibrary::Simplechain","./Simplechain.xml");
    this.input = connector.getInput("MySubscriber::SimplechainReader");
    this.output = connector.getOutput("MyPublisher::SimplechainWriter");

    this.blockchain.setP2P(this);
    var that = this;
    connector.on('on_data_available',
    function() {
        that.input.take();
            for (i=1; i <= that.input.samples.getLength(); i++) {
                if (that.input.infos.isValid(i)) {
                    var msg = that.input.samples.getJSON(i);
                    switch (msg.type) {
                        case MessageType.QUERY_LATEST:
                            that.broadcastLatest();
                            break;
                        case MessageType.QUERY_ALL:
                            that.broadcastAllChain();
                            break;
                        case MessageType.RESPONSE_BLOCKCHAIN:
                            var receivedBlocks = msg.data;
                            if (receivedBlocks === null) {
                                console.log("invalid blocks received");
                            }
                            if (DEBUG) console.log("Received Blocks:\n"+receivedBlocks);
                            var receivedBlocksObj = JSON.parse(receivedBlocks);
                            var receivedBlocksArray;
                            if (!Array.isArray(receivedBlocksObj)) {
                                receivedBlocksArray = [];
                                receivedBlocksArray.push(receivedBlocksObj)
                            } else {
                                receivedBlocksArray = receivedBlocksObj
                            }
                            that.handleBlockchainResponse(receivedBlocksArray);
                            break;
                    }
            }
        }
    });
}

P2P.prototype.handleBlockchainResponse = function(receivedBlocks) {
    if (receivedBlocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    var latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    console.log(latestBlockReceived)
    if (!simplechain.isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    var latestBlockHeld = this.blockchain.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: '
            + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            if (this.blockchain.addBlock(latestBlockReceived)) {
                this.broadcastLatest();
            }
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer');
            this.broadcastQueryAll();
        } else {
            console.log('Received blockchain is longer than current blockchain');
            this.blockchain.replaceChain(receivedBlocks);
        }
    } else {
        console.log('received blockchain is not longer than my blockchain. Do nothing');
    }
}
P2P.prototype.broadcastLatest = function() {
        this.output.instance.setNumber("type", MessageType.RESPONSE_BLOCKCHAIN);
        this.output.instance.setString("data", JSON.stringify(this.blockchain.getLatestBlock()))
        this.output.write();
}

P2P.prototype.broadcastAllChain = function() {
        this.output.instance.setNumber("type", MessageType.RESPONSE_BLOCKCHAIN);
        this.output.instance.setString("data", JSON.stringify(this.blockchain.chain))
        this.output.write();
}


P2P.prototype.broadcastQueryAll = function() {
        this.output.instance.setNumber("type", MessageType.QUERY_ALL);
        this.output.instance.setString("data", JSON.stringify(null))
        this.output.write();
}

module.exports.P2P = P2P;
