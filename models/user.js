const mongoose = require('mongoose');
const Schema = mongoose.Schema;

userSchema = new Schema( {
	unique_id: Number,
	email: String,
	wallet: String,
	xrp_wallet: String,
	credit: Number,
	type: String,
	username: String,
	password: String,
	passwordConf: String,
	createdAt: {
		type: Date,
		default: Date.now
	}
}),

User = mongoose.model('User', userSchema);

module.exports = User;