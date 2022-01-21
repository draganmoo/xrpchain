const mongoose = require('mongoose');
const Schema = mongoose.Schema;

fileSchema = new Schema( {
	unique_id: String,
    user_id: String,
    fileName: String,
    fileSize: String,
    fileType: String,
    fileKey: String,
    data: Schema.Types.Mixed,
    mediaobj: Schema.Types.Mixed,
    hash: Schema.Types.Mixed,
    ipfs: String,
    s3:String,
    nft_details: Schema.Types.Mixed,
	xrp_reciving_wallet: String,
    xrp_amount: String,
    nft_validated : String,
    trans_info : Schema.Types.Mixed,
	type: String,
	createdAt: {
		type: Date,
		default: Date.now
	}
}),
Files = mongoose.model('files', fileSchema);

module.exports = Files;