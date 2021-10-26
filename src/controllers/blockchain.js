const Medias = require('../models/medias');
const Blockchain = require('../models/blockchain');
const Nodes = require('../models/nodes');

const util = require('util')
const { nanoid } = require('nanoid')
const gc = require('../../config/config')
const bucket = gc.bucket('moo-demo-xrpl')
const {
    format
} = util

const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.stringEncKey || 'thisisaSecret');


var crypto = require('crypto'),
    algorithm = 'aes-256-ctr';

function encryptString(string){
    const encryptedString = cryptr.encrypt(string);
    return encryptedString;
}

function decryptString(string){
    const decryptedString = cryptr.decrypt(string);
    return decryptedString;
}

function encryptBinary(chunk, password){
    var cipher,
	    result,
	    iv;
	iv = crypto.randomBytes(16);
	cipher = crypto.createCipheriv(algorithm, password, iv);
	result = Buffer.concat([iv, cipher.update(chunk), cipher.final()]);
	return result;
}

function decryptFile(chunk, password){
    var decipher,
	    result,
	    iv;
	iv = chunk.slice(0, 16);
	chunk = chunk.slice(16);
	decipher = crypto.createDecipheriv(algorithm, password, iv);
	result = Buffer.concat([decipher.update(chunk), decipher.final()]);
	return result;
}


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
        const genFileEncKey = nanoid(32);
        var fileBuffer = encryptBinary(req.file.buffer, genFileEncKey);
        const blob = bucket.file((nanoid(13)+"_"+req.file.originalname).replace(/ /g, "_"))
        const blobStream = blob.createWriteStream({
            resumable: false
        })
        blobStream.on('finish', () => {
                const publicUrl = format(
                    `https://storage.googleapis.com/${bucket.name}/${blob.name}`
                )
                
                // Add to chain
                req.body.mediaobj = encryptString(publicUrl);
                req.body.key = encryptString(genFileEncKey);
                if (this.medias.add(req, res)) {
                    res.json(this.blockchain.mine(this.medias, res));
                } else {
                    res.json({
                        error: "Something went wrong."
                    });
                }
            })
            .on('error', (err) => {
                console.log(`Unable to upload image, something went wrong`, err)

                res.json({
                    error: "Something went wrong."
                });
            })
            .end(fileBuffer)
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