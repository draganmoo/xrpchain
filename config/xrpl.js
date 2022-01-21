const path = require('path')
const uuid = require('uuid')
const Files = require('../models/files');
const serviceKey = path.join(__dirname, './keys.json')
const qr = require("qrcode");
var md5 = require('md5');

const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.stringEncKey || 'thisisaSecret');

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

const fileSys = require('fs-extra');
const Yaml = require('js-yaml');
const logs = require('./log');
const prompt = require('prompt-sync')({
  sigint: true
});
const RippleAPI = require('ripple-lib').RippleAPI;
const {
  create,
  globSource
} = require('ipfs-core');
const nunjucks = require('nunjucks');
const open = require('open');
const xAddr = require('xrpl-tagged-address-codec')
const Hash = require('ipfs-only-hash')
const qrcode = require('qrcode-terminal');
const figlet = require('figlet');
const inquirer = require('inquirer');
const colorize = require('json-colorizer');
const createTorrent = require('create-torrent')
const parseTorrent = require('parse-torrent');
const AWS = require('aws-sdk');
const pinataSDK = require('@pinata/sdk');
const CID = require('cids')

var crypto = require('crypto'),
  algorithm = 'aes-256-ctr';


let config;
try {
  config = Yaml.load(fileSys.readFileSync('setup.yml', 'utf8'));
} catch (error) {
  // Dies hard this way.. This is a major issue we just fail outright on
  console.log(`Error in server.js: ${error}`);
  process.exit(-1);
}

// Global Things
const xAPI = new RippleAPI({
  server: config.xrp.network
});
let iAPI;
qrcode.setErrorLevel('H');
// Register plugin
inquirer.registerPrompt('search-list', require('inquirer-search-list'));
let epochCreateTime = Date.now();

async function WriteMetaData(configSettings) {
  try {
    let metaFile = configSettings.buildDestFolder + path.sep + "meta.json";
    logs.info(`writting data to meta file: ${metaFile}`);
    fileSys.writeFileSync(metaFile, JSON.stringify(configSettings.meta, null, 4));
  } catch (error) {
    CatchError(error)
  }
}

// Write JSON to System State file
async function ValidateFunding(walletAddress) {
  try {
    try {
      await xAPI.connect();
      await xAPI.getSettings(walletAddress);
      logs.info(`validating ${walletAddress} is funded...`)
      return true;
    } catch (error) {
      console.log(error)
      switch (error.data.error) {
        case "NotConnectedError":
          logs.warn(`reconnecting to XRP Ledger...`);
          xAPI.connect();
          break

        case "actNotFound":
          logs.debug(`account validation waiting, last check results: ${error.data.error}`)
          break;

        default:
          logs.warn(`encountered error during validation of wallet funding: ${JSON.stringify(error, null, 2)}`)
          return false;
          break
      }
    }
  } catch (error) {
    CatchError(error)
  }
}

// Upload NFT files to IPFS, returns root string
async function UploadBuildFilesIPFS(configSettings) {
  try {
    logs.info(`if your pushing a large NFT over a slow connection, this may take some time...`)
    //options specific to globSource
    const globSourceOptions = {
      recursive: true
    };

    //example options to pass to IPFS
    const addOptions = {
      pin: true,
      wrapWithDirectory: true,
      cidVersion: 0, //Reverted back to v0 to save space in Domain field
      timeout: 300000
    };
    let rootFolderCID = "";
    //let includeHead = configSettings.buildDestFolder.split(path.sep).pop();
    for await (const file of iAPI.addAll(globSource(configSettings.buildDestFolder, globSourceOptions), addOptions)) {
      logs.info(`pushing content files: ${file.path} :: ${file.size} :: ${file.cid}`);
      if (!file.path || file.path === "") {
        rootFolderCID = file;
      }
    }

    //Sanity check
    if (rootFolderCID === "") {
      throw Error("invalid cid returned, empty string")
    }

    return rootFolderCID

  } catch (error) {
    CatchError(error)
  }
}

// Fetch nft-content files cids, returns cids for nft content files
// - Also gathers SHA256 for each file
async function GetNFTFileHashes(contentDirectory) {
  try {
    logs.info(`gathering IPFS CID & SHA256 hashes to add to meta data file...`)
    //options specific to globSource
    const globSourceOptions = {
      recursive: true
    };

    let cids = [];
    let excludeHead = path.sep + contentDirectory.split(path.sep).pop();
    excludeHead = excludeHead.replace(/\//g, "").replace(/\\/g, "")

    for await (let value of globSource(contentDirectory, globSourceOptions)) {
      if (!value.path.endsWith(excludeHead)) {
        let fileData = await fileSys.readFileSync(value.content.path);
        const cid = await Hash.of(fileData);
        const hash = crypto.createHash('sha256');
        hash.update(fileData);
        const hdigest = hash.digest('hex');
        cids.push({
          'file': value.path,
          'cid': cid,
          'sha256': hdigest
        })
        logs.info(`adding '${value.path}' with cid hash '${hdigest}' to meta data...`)
      }
    }
    return cids
  } catch (error) {
    CatchError(error)
  }
}

// Update xrp wallet data
async function updateXRPWalletData(walletData, walletAddress, fileObj) {
  try {
    //Get some account info
    // - Fee calculation
    let fee = await xAPI.getFee();
    fee = (parseFloat(fee) * 1000000).toFixed(0) + "";
    // Seq calculation
    let accInfo = await xAPI.getAccountInfo(walletAddress.address);
    let seqNum = accInfo.sequence;

    // TX Template for update
    let tempWalletData = {
      "TransactionType": "AccountSet",
      "Account": walletAddress.address,
      "Fee": fee,
      "Sequence": seqNum,
      "SetFlag": 5
    }

    //Merge options with template
    let txWallet = {
      ...tempWalletData,
      ...walletData
    };

    //Prepare TX for sending to ledger
    let txJSON = JSON.stringify(txWallet);
    let signedTX = xAPI.sign(txJSON, walletAddress.secret);

    //Submit the signed transaction to the ledger (need to add validation here)
    let submit = await xAPI.submit(signedTX.signedTransaction).then(function (tx) {
      logs.debug(`attempting submition of transaction: ${txJSON}`);
      logs.debug(`tentative message: ${tx.resultMessage}`);
      logs.info(`tx status code: ${tx.resultCode} , tx hash ${tx.tx_json.hash}`);

      return {
        "status": "ok",
        "tx": tx,
        "data": txJSON
      }
    }).catch(function (e) {
      logs.warn(`tran failure to send data: ${e}`);
      return {
        "status": "not validated.",
        "tx": "failed",
        "data": e
      }
    });

    return submit;
  } catch (error) {
    CatchError(error)
  }
}

// Get or Create XRP Address
// - convert this to inquire later...
async function GetXRPWalletAddress() {
  try {
    // - (options) Use existing address seed OR create a new wallet address
    let address = {};
    let secret;
    let validAcc = false;
    address = await xAPI.generateAddress();
    validAcc = true;
    //return the results
    return address
  } catch (error) {
    CatchError(error)
  }
}

// Build Domain Field Pointer information
async function BuildDomainPointer(resources) {
  /* 
      Example

      @xnft:
      btih:1e3ec2d9d231b7dbe0b0ba2db911cb97eadd40bb
      ipfs:Qmct4KDxLbpXTgpKPXYv6enj4yRBCNkxtfAEWP9jFqLtkW
      ilpd:$ilp.uphold.com/ZQ9a44qFAxLk
      http:nft.xrpfs.com
      
      157 bytes of 256 MAX

      OR

      @xnft:meta.json
      btih:1e3ec2d9d231b7dbe0b0ba2db911cb97eadd40bb
      ipfs:Qmct4KDxLbpXTgpKPXYv6enj4yRBCNkxtfAEWP9jFqLtkW
      ilpd:$ilp.uphold.com/ZQ9a44qFAxLk
      http:nft.xrpfs.com
      
      166 bytes of 256 MAX

      -------------------------------------------------------------------------------------------------------------

      @[xnft]: <- Defines this group of resources is a XRP NFT resource group | meta.json <- additional data (opt.)
      [btih]:[Torrent Hash Address]
      [ipfs]:[IPFS Data]
      [ilpd]:[Dynamic ILP pointer, overrides defined meta pointer data]
      [http]:[Domain hosting data (base url)]

      [service identification]::
      [protocal]:[resource address / instruction] (pointers)

      Must be less then 256 Chars / bytes
      NewLine sep

      resources -> k/v Obj {"protocol" : "resource address / instruction", "protocol" : "resource address / instruction", ...}
      Max 256 data, will fail if over!

  */
  try {
    //Build the domain value out
    let domainValue = "";
    domainValue += "@xnft:\n";
    //Add the protos and resources
    // - Add size validation here, add as much as possible, then warn on failed additions / rev2
    Object.entries(resources).forEach(([key, value]) => {
      domainValue += `${key}:${value}\n`
    });

    //Validate the size of the output does not exceed byte limit
    let bufSize = Buffer.from(domainValue).length
    if (bufSize > 256) {
      throw Error(`Domain value exceeds max value of 256, ${bufSize}`)
    }
    //Some Logging
    logs.info(`Domain value: \n${domainValue}Value size: ${bufSize} of 256 bytes used`)

    //Convert for use in Domain Account set
    let hexDomValue = new Buffer.from(domainValue).toString('hex').toUpperCase();
    logs.info(`Domain value in hex: ${hexDomValue}`)
    return hexDomValue

  } catch (error) {
    CatchError(error)
  }
}

// Functions
function CatchError(err) {
  if (typeof err === 'object') {
    if (err.message) {
      logs.error(err.message)
    }
    if (err.stack) {
      logs.error('StackTrace:')
      logs.error(err.stack);
    }
  } else {
    logs.error('error in CatchError:: argument is not an object');
  }
  process.exit()
}

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



module.exports = function () {

  this.encryptString = function (string) {
    const encryptedString = cryptr.encrypt(string);
    return encryptedString;
  }

  this.decryptString = function (string) {
    const decryptedString = cryptr.decrypt(string);
    return decryptedString;
  }

  this.encryptBinary = function (chunk, password) {
    var cipher,
      result,
      iv;
    iv = crypto.randomBytes(16);
    cipher = crypto.createCipheriv(algorithm, password, iv);
    result = Buffer.concat([iv, cipher.update(chunk), cipher.final()]);
    return result;
  }

  this.decryptFile = function (chunk, password) {
    var decipher,
      result,
      iv;
    iv = chunk.slice(0, 16);
    chunk = chunk.slice(16);
    decipher = crypto.createDecipheriv(algorithm, password, iv);
    result = Buffer.concat([decipher.update(chunk), decipher.final()]);
    return result;
  }

  this.xrpl__download_enc = async function (req, res, media) {
    let options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    let mediaurl = decryptString(media.mediaobj);
    let getKey = decryptString(media.fileKey);
    let getData = JSON.parse(decryptString(media.data));
    let getFileName = mediaurl.substring(mediaurl.lastIndexOf('/') + 1);

    const [url] = await bucket.file(getFileName).getSignedUrl(options);
    try {
      const response = await got(url, {
        responseType: 'buffer'
      });
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

  this.xrpl__download = async function (req, res, media) {
    let options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };
    let mediaurl = decryptString(media.mediaobj);
    let getKey = decryptString(media.fileKey);
    let getData = JSON.parse(decryptString(media.data));
    let getFileName = mediaurl.substring(mediaurl.lastIndexOf('/') + 1);

    const [url] = await bucket.file(getFileName).getSignedUrl(options);
    try {
      const response = await got(url, {
        responseType: 'buffer'
      });
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
  this.xrpl__makenft = async function (fileObj) {
    // - Testing, seems updated IPFS package has some bugs
    //iAPI = await create({ repo: config.ipfs.node});

    let buildSettings = {
      meta: {
        hashes: {},
        details: {},
        created: "",
        framework: "HubSecure"
      }
    };

    await xAPI.connect();
    let address = await GetXRPWalletAddress()

    buildSettings.meta.hashes = fileObj.hash
    buildSettings.meta.details.NFTWalletAddress = address.address.toString()
    buildSettings.meta.details.NFTWalletXAddress = address.xAddress.toString()
    buildSettings.meta.created = epochCreateTime;
    buildSettings.meta.framework = "Ahmed Rizawan";

    let getData = JSON.parse(decryptString(fileObj.data));
    let resources = {
      name: fileObj.hash.cid,
      ekey: md5(fileObj.fileKey),
      ipfs: "TBA"
    }
    let xrpDomainField = await BuildDomainPointer(resources)
    let qrc = await qr.toDataURL(address.address)
    var nft_details = {
      buildSettings: buildSettings,
      address: address,
      xrpDomainField: xrpDomainField,
      paymentQR: qrc,
      trans_add: "https://testnet.xrpl.org/accounts/" + address.address,
    };
    var query = {
      'unique_id': fileObj.unique_id
    };
    var update = {
      nft_details: nft_details,
      nft_validated: "No"
    }

    var updatedata = await Files.findOneAndUpdate(query, update, {
      multi: true
    });

    return {
      qr: qrc,
      trans_add: "https://testnet.xrpl.org/accounts/" + address.address
    }
  }

  this.xrpl_validatefunding = async function (fileObj) {
    let validate = await ValidateFunding(fileObj.nft_details.address.address)
    if (validate) {
      let txData = await updateXRPWalletData({
        "Domain": fileObj.nft_details.xrpDomainField
      }, fileObj.nft_details.address, fileObj)

      var query = {
        'unique_id': fileObj.unique_id
      };
      var update = {
        nft_validated: "Yes",
        trans_info: txData
      }

      if(txData.status == "ok"){
        await Files.findOneAndUpdate(query, update, {
          multi: true
        });
  
        return txData;
      }else{
        return txData;
      }
      
    } else {
      return {
        "status": "not validated."
      }
    }

  }

  this.xrpl__postMedia = function (req, res) {

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

              const cid = Hash.of(req.file.buffer).then(function (cid_hash) {
                const hash = crypto.createHash('sha256');
                hash.update(req.file.buffer);
                const hdigest = hash.digest('hex');
                let fileUID = uuid.v4();
                let newMedia = new Files({
                  user_id: req.session.userId,
                  unique_id: fileUID,
                  fileName: encryptString(req.file.originalname),
                  fileType: encryptString(req.file.mimetype),
                  fileSize: encryptString(req.file.size),
                  fileKey: req.body.key,
                  data: req.body.data,
                  mediaobj: req.body.mediaobj,
                  hash: {
                    'file': req.file.originalname,
                    'cid': cid_hash,
                    'sha256': hdigest
                  }
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
                      res.redirect('/pay/' + fileUID);
                    });
                  }
                });
              });

            })
            .on('error', (err) => {
              console.log(`Unable to upload image, something went wrong`, err)
              res.json({
                error: "Something went wrong."
              });
            })
            .end(fileBuffer)

        }
      });
    }

  }


}