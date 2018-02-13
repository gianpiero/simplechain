/*
 * (c) 2005-2018  Copyright, Real-Time Innovations, Inc. All rights reserved.
 * Subject to Eclipse Public License v1.0; see LICENSE.md for details.
 */

"use strict";

// ***************************************************************************
// Imported modules
// ***************************************************************************
var mod_rti         = require('rticonnextdds-connector');
var mod_simplechain = require('./simplechain');
var mod_uuid        = require('uuid');

var Block = mod_simplechain.Block;
var Blockchain = mod_simplechain.Blockchain;

const MessageType_QUERY_LATEST          = 0;
const MessageType_QUERY_ALL             = 1;
const MessageType_RESPONSE_BLOCKCHAIN   = 2;


// ***************************************************************************
// P2P Class Definition
// ***************************************************************************
var P2P = function(blockchain, verbose, xmlFile, participantName, readerName, writerName) {

    // TODO: Remove me and use QoS to do the same thing
    this.uuid = mod_uuid();             // Generates a unique UUID
    this.blockchain = blockchain;       // Reference to the current Blockchain
    this.verbose = verbose;
    if (!xmlFile) {
        throw new Error("XML File not specified");
    }
    if (!participantName) {
        throw new Error("Participant name not specified");
    }
    if (!participantName) {
        throw new Error("Participant name not specified");
    }
    if (!readerName) {
        throw new Error("Data Reader name not specified");
    }
    if (!writerName) {
        throw new Error("Data Writer name not specified");
    }

    if (this.verbose) {
        console.log("Initializing ConnextDDS-Connector P2P:");
        console.log("   App-Config XML File: " + xmlFile);
        console.log("   Participant        : " + participantName);
        console.log("   Data Reader        : " + readerName);
        console.log("   Data Writer        : " + writerName);
    }

    let connector = new mod_rti.Connector(participantName, xmlFile);
    this.input = connector.getInput(readerName);
    this.output = connector.getOutput(writerName);

    let me = this;
    connector.on('on_data_available', function() { onDataAvailable(me); });
}

function onDataAvailable(p2p) {
    p2p.input.take();
    for (let i=1; i <= p2p.input.samples.getLength(); i++) {
        if (p2p.input.infos.isValid(i)) {
            let msg = p2p.input.samples.getJSON(i);
            if (msg.src == p2p.uuid) {
                // Ignore messages coming from ourself
                continue;
            }
            switch (msg.type) {
                case MessageType_QUERY_LATEST:
                    if (p2p.verbose) console.log("[P2P ]: Received message: QUERY_LATEST");
                    p2p.broadcastLatest();
                    break;

                case MessageType_QUERY_ALL:
                    if (p2p.verbose) console.log("[P2P ]: Received message: QUERY_ALL");
                    p2p.broadcastAllChain();
                    break;

                case MessageType_RESPONSE_BLOCKCHAIN:
                    if (p2p.verbose) console.log("[P2P ]: Received message: RESPONSE_BLOCKCHAIN");
                    var receivedBlocks = msg.data;
                    if (receivedBlocks === null) {
                        console.log("invalid blocks received");
                    }
                    if (p2p.verbose) {
                        console.log("[P2P ]: \tReceived Blocks:\n"+receivedBlocks);
                    }
                    var receivedBlocksObj = JSON.parse(receivedBlocks);
                    var receivedBlocksArray;
                    if (!Array.isArray(receivedBlocksObj)) {
                        receivedBlocksArray = [];
                        receivedBlocksArray.push(receivedBlocksObj)
                    } else {
                        receivedBlocksArray = receivedBlocksObj
                    }
                    p2p.handleBlockchainResponse(receivedBlocksArray);
                    break;
            }
        }
    }
}

/* P2P.handleBlockchainResponse - Process the array of blocks received from the
 * RESPONSE_BLOCKCHAIN message
 */
P2P.prototype.handleBlockchainResponse = function(receivedBlocks) {
    if (receivedBlocks.length === 0) {
        console.log('[P2P ]: \t!!received block chain size of 0 (msg ignored)');
        return;
    }
    // Convert the received block array of generic objects into an array of Block objects
    var chain = [];
    try {
        for (let i = 0; i < receivedBlocks.length; ++i) {
            chain.push(new Block(receivedBlocks[i]));
        }
    } 
    catch(e) {
        console.log("[P2P ]: \t!! Received an invalid block: " + e.message);
        console.log(e.stack);
        return;
    }
    var latestBlockReceived = chain[chain.length - 1];

    try {
        var latestBlockHeld = this.blockchain.getLatestBlock();
        if (latestBlockReceived.index <= latestBlockHeld.index) {
            console.log('[P2P ]: \t!!Received blockchain is not longer than my blockchain. Ignoring it...');
            return;
        }
        if (this.verbose) {
            console.log('[P2P ]: \tBlockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        }

        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            // Hash is valid, block received is good, we accept it
            this.blockchain.addBlock(latestBlockReceived);  // Might throw if latest block cannot be accepted
            this.broadcastLatest();
            return;
        } 
        if (receivedBlocks.length === 1) {
            if (this.verbose) {
                console.log('[P2P ]: \tReceived only one block, need to query the chain from our peer');
            }
            this.broadcastQueryAll();
            return;
        }
        // else, the received blockchain is longer than our, replace it
        if (this.verbose) {
            console.log('[P2P ]: \tReceived blockchain is longer than current blockchain, replacing it...');
        }
        this.blockchain.replaceChain(chain);
        this.broadcastLatest();
        return;
    }
    catch(e) {
        console.log("[P2P ]: \t!! Cannot process incoming chain: " + e.message);
        console.log(e.stack);
    }
}

/* P2P.broadcastLatest - Broadcast the latest block of our chain
 */
P2P.prototype.broadcastLatest = function() {
    if (this.verbose) {
        console.log("[P2P ]: Sending RESPONSE_BLOCKCHAIN with latest block...");
    }
    this.output.instance.setString("src", this.uuid);
    this.output.instance.setNumber("type", MessageType_RESPONSE_BLOCKCHAIN);
    this.output.instance.setString("data", JSON.stringify(this.blockchain.getLatestBlock()))
    this.output.write();
}

/* P2P.broadcastAllChain - Broadcast the entire chain
 */
P2P.prototype.broadcastAllChain = function() {
    if (this.verbose) {
        console.log("[P2P ]: Sending RESPONSE_BLOCKCHAIN with the entire blockchain...");
    }
    this.output.instance.setString("src", this.uuid);
    this.output.instance.setNumber("type", MessageType_RESPONSE_BLOCKCHAIN);
    this.output.instance.setString("data", this.blockchain.toString());
    this.output.write();
}


/* P2P.broadcastQueryAll - Broadcast the entire chain
 */
P2P.prototype.broadcastQueryAll = function() {
    if (this.verbose) {
        console.log("[P2P ]: Sending QUERY_ALL...");
    }
    this.output.instance.setString("src", this.uuid);
    this.output.instance.setNumber("type", MessageType_QUERY_ALL);
    this.output.instance.setString("data", "null");
    this.output.write();
}

module.exports.P2P = P2P;

