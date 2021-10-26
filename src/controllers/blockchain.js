const Medias = require('../models/medias');
const Blockchain = require('../models/blockchain');
const Nodes = require('../models/nodes');

class BlockchainController {
    constructor(url, port) {
        this.blockchain = new Blockchain(url, port);
        this.nodes = new Nodes(url, port);
        this.medias = new Medias();
    }

    resolve(req, res) {
        this.nodes.resolve(res, this.blockchain);
    }

    getNodes(req, res) {
        res.json(this.nodes.list);
    }

    postMedia(req, res) {
        if (this.medias.add(req, res)) {
            res.json(this.blockchain.mine(this.medias, res));
        } else {
            res.json({
                error: "Something went wrong."
            });
        }
    }

    getMedias(req, res) {
        res.json(this.medias.get());
    }

    mine(req, res) {
        res.json(this.blockchain.mine(this.medias, res));
    }

    getBlockchain(req, res) {
        res.json(this.blockchain.blocks);
    }

    getBlockByIndex(req, res) {
        res.json(this.blockchain.getBlockByIndex(req.params.idx));
    }

    getBlockLastIndex(req, res) {
        res.json(this.blockchain.getBlockLastIndex());
    }
}

module.exports = BlockchainController;