const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mediaDataSchema = new Schema( {
	
	userId: String,
    blockIndex: String,
    fileName: String,
    fileType: String,
    fileSize: String,
	createdAt: {
		type: Date,
		default: Date.now
	}
}),
mediaData = mongoose.model('MediaData', mediaDataSchema);

module.exports = mediaData;