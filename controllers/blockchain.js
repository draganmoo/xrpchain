const Medias = require('../models/medias');
const Blockchain = require('../models/blockchain');
const Nodes = require('../models/nodes');
const User = require('../models/user');
const MediaData = require('../models/mediaData');

const util = require('util')
const got = require('got');
const {
    nanoid
} = require('nanoid')
const gc = require('../config/config')
const bucket = gc.bucket('moo-demo-xrpl')
const {
    format
} = util

const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.stringEncKey || 'thisisaSecret');


var crypto = require('crypto'),
    algorithm = 'aes-256-ctr';

function encryptString(string) {
    const encryptedString = cryptr.encrypt(string);
    return encryptedString;
}

function decryptString(string) {
    const decryptedString = cryptr.decrypt(string);
    return decryptedString;
}

function encryptBinary(chunk, password) {
    var cipher,
        result,
        iv;
    iv = crypto.randomBytes(16);
    cipher = crypto.createCipheriv(algorithm, password, iv);
    result = Buffer.concat([iv, cipher.update(chunk), cipher.final()]);
    return result;
}

function decryptFile(chunk, password) {
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

    async download_enc (req, res){
        let options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
          };
        let getBlock = this.blockchain.getBlockByIndex(req.params.id)
        let mediaurl = decryptString(getBlock.medias[0].mediaobj);
        let getKey = decryptString(getBlock.medias[0].key);
        let getData = JSON.parse(decryptString(getBlock.medias[0].data));
        let getFileName = mediaurl.substring(mediaurl.lastIndexOf('/')+1);
        const [url] = await bucket.file(getFileName).getSignedUrl(options);
        try {
            const response = await got(url, { responseType: 'buffer' });
            const fileData = (response.body)
            const fileName = getData.filename
            const fileType = getData.type
            
            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': fileType,
            })

            const download = Buffer.from(fileData, 'base64')
            res.end(download)
            

        } catch (error) {
            console.log(error.body);
        }
    }

    async download(req, res){
        let options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
          };
        let getBlock = this.blockchain.getBlockByIndex(req.params.id)
        let mediaurl = decryptString(getBlock.medias[0].mediaobj);
        let getKey = decryptString(getBlock.medias[0].key);
        let getData = JSON.parse(decryptString(getBlock.medias[0].data));
        let getFileName = mediaurl.substring(mediaurl.lastIndexOf('/')+1);
        const [url] = await bucket.file(getFileName).getSignedUrl(options);
        try {
            const response = await got(url, { responseType: 'buffer' });
            const fileData = decryptFile(response.body, getKey)
            const fileName = getData.filename
            const fileType = getData.type
            
            res.writeHead(200, {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': fileType,
            })

            const download = Buffer.from(fileData, 'base64')
            res.end(download)
            

        } catch (error) {
            console.log(error.body);
        }


        //res.redirect(url);
    }


    resolve(req, res) {
        this.nodes.resolve(res, this.blockchain);
    }

    getNodes(req, res) {
        res.json(this.nodes.list);
    }

    postMedia(req, res) {
        if (!req.session.userId) {
            res.json({
                error: "User must login."
            });
        } else {

            User.findOne({
                unique_id: req.session.userId
            }, (err, user) => {
                if (!user) {
                    res.redirect('/');
                } else {

                    if(parseInt(user.credit) >= 1){

                        const genFileEncKey = nanoid(32);
                    var fileBuffer = encryptBinary(req.file.buffer, genFileEncKey);
                    const blob = bucket.file((nanoid(13) + "_" + req.file.originalname).replace(/ /g, "_"))
                    const blobStream = blob.createWriteStream({
                        resumable: false
                    })
                    blobStream.on('finish', () => {
                            const publicUrl = format(
                                `https://storage.googleapis.com/${bucket.name}/${blob.name}`
                            )

                            // Add to chain
                            req.body.user = req.session.userId
                            req.body.mediaobj = encryptString(publicUrl);
                            req.body.key = encryptString(genFileEncKey);
                            req.body.data = encryptString(JSON.stringify({
                                filename: req.file.originalname,
                                filesize: req.file.size,
                                type: req.file.mimetype
                            }))
                            if (this.medias.add(req, res)) {
                                let mineResult = (this.blockchain.mine(this.medias));
                                if (!mineResult.error) {

                                    let newMedia = new MediaData({
                                        userId: req.session.userId,
                                        blockIndex: mineResult.index,
                                        fileName: encryptString(req.file.originalname),
                                        fileType: encryptString(req.file.mimetype),
                                        fileSize: encryptString(req.file.size),
                                    });

                                    newMedia.save((err, Media) => {
                                        if (err) {
                                            console.log(err);
                                            res.json(err);
                                        } else {
                                            console.log('Success');

                                            let statusData = {
                                                $inc: {
                                                    credit: -1
                                                }
                                            }
                                            User.findByIdAndUpdate({
                                                "_id": user._id
                                            }, statusData, function (err, result) {
                                                res.redirect('/profile');
                                            });

                                            
                                        }
                                    });
                                }
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

                    }else{
                        res.json({
                            error: "No credit left, please buy some."
                        });
                    }  
                }
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