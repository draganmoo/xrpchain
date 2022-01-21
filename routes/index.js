const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Files = require('../models/files');
require('../config/xrpl')();

// Routes

router.get('/', (req, res, next) => {
	return res.render('login.ejs');
});

router.get('/register', (req, res, next) => {
	return res.render('index.ejs');
});

router.post('/', (req, res, next) => {
	let personInfo = req.body;

	if (!personInfo.email || !personInfo.username || !personInfo.password || !personInfo.passwordConf) {
		res.send();
	} else {
		if (personInfo.password == personInfo.passwordConf) {

			User.findOne({
				email: personInfo.email
			}, (err, data) => {
				if (!data) {
					let c;
					User.findOne({}, (err, data) => {

						if (data) {
							c = data.unique_id + 1;
						} else {
							c = 1;
						}

						let newPerson = new User({
							unique_id: c,
							email: personInfo.email,
							username: personInfo.username,
							password: personInfo.password,
							passwordConf: personInfo.passwordConf,
							wallet: "",
							credit: 10,
							type: "free"
						});

						newPerson.save((err, Person) => {
							if (err)
								console.log(err);
							else
								console.log('Success');
						});

					}).sort({
						_id: -1
					}).limit(1);
					res.send({
						"Success": "You are regestered,You can login now."
					});
				} else {
					res.send({
						"Success": "Email is already used."
					});
				}

			});
		} else {
			res.send({
				"Success": "password is not matched"
			});
		}
	}
});

router.post('/register-metamask', (req, res, next) => {

	User.findOne({
		wallet: req.body.user_wallet
	}, (err, data) => {
		if (!data) {
			let c;
			User.findOne({}, (err, data) => {

				if (data) {
					c = data.unique_id + 1;
				} else {
					c = 1;
				}

				let newPerson = new User({
					unique_id: c,
					email: "",
					username: req.body.id,
					password: "",
					passwordConf: "",
					wallet: req.body.user_wallet,
					credit: 10,
					type: "free"
				});

				newPerson.save((err, Person) => {
					if (err) {
						console.log(err);
					} else {
						req.session.userId = Person.unique_id;
						res.send({
							"success": "yes"
						});
					}

				});

			}).sort({
				_id: -1
			}).limit(1);

		} else {
			req.session.userId = data.unique_id;
			res.send({
				"success": "yes"
			});
		}

	});
});

router.get('/login', (req, res, next) => {
	return res.render('login.ejs');
});

router.post('/login', (req, res, next) => {
	User.findOne({
		email: req.body.email
	}, (err, data) => {
		if (data) {

			if (data.password == req.body.password) {
				req.session.userId = data.unique_id;
				res.send({
					"Success": "Success!"
				});
			} else {
				res.send({
					"Success": "Wrong password!"
				});
			}
		} else {
			res.send({
				"Success": "This Email Is not regestered!"
			});
		}
	});
});

router.get('/profile', (req, res, next) => {
	User.findOne({
		unique_id: req.session.userId
	}, (err, data) => {
		if (!data) {
			res.redirect('/');
		} else {
			let allMedia = [];
			Files.find({
				user_id: req.session.userId + ""
			}, (err, medias) => {
				medias.forEach(media => {
					console.log(media.nft_details.trans_add)
					allMedia.push({
						name: decryptString(media.fileName),
						size: decryptString(media.fileSize),
						type: decryptString(media.fileType),
						nft_validated: media.nft_validated,
						nft_check_link: (media.nft_details.trans_add) ? media.nft_details.trans_add : "",
						unique_id: media.unique_id
					})
				});
				return res.render('data.ejs', {
					"name": data.username,
					"wallet": data.wallet,
					"email": data.email,
					"credit": data.credit,
					"xrp_wallet": "raividsZTNN3mUzu7UEE6uBxKmt6FHoQUX",
					"medias": allMedia
				});
			});

		}
	});
});

router.get('/logout', (req, res, next) => {
	if (req.session) {
		// delete session object
		req.session.destroy((err) => {
			if (err) {
				return next(err);
			} else {
				return res.redirect('/');
			}
		});
	}
});

router.get('/forgetpass', (req, res, next) => {
	res.render("forget.ejs");
});



router.post('/forgetpass', (req, res, next) => {
	User.findOne({
		email: req.body.email
	}, (err, data) => {
		if (!data) {
			res.send({
				"Success": "This Email Is not regestered!"
			});
		} else {
			if (req.body.password == req.body.passwordConf) {
				data.password = req.body.password;
				data.passwordConf = req.body.passwordConf;

				data.save((err, Person) => {
					if (err)
						console.log(err);
					else
						console.log('Success');
					res.send({
						"Success": "Password changed!"
					});
				});
			} else {
				res.send({
					"Success": "Password does not matched! Both Password should be same."
				});
			}
		}
	});

});

router.get('/download-enc/:id', (req, res, next) => {

	Files.findOne({
		"unique_id": req.params.id + ""
	}, (err, media) => {
		if (err) {
			res.json(err);
		}
		if (media) {
			return xrpl__download_enc(req, res, media);
		}
	});
});

router.get('/download/:id', (req, res, next) => {
	Files.findOne({
		"unique_id": req.params.id + ""
	}, (err, media) => {
		if (err) {
			res.json(err);
		}
		if (media) {
			return xrpl__download(req, res, media);
		}
	});
});

router.post('/upload-file', (req, res, next) => {
	return xrpl__postMedia(req, res);
});

router.get('/pay/:id', async (req, res, next) => {

	const result = await Files.findOne({
		"unique_id": req.params.id + ""
	});
	if(result){
		let setNFT = await xrpl__makenft(result);
		res.render("qr.ejs", {
			src: setNFT.qr,
			"link": setNFT.trans_add,
			"id": req.params.id + ""
		});
	}else{
		res.redirect('/profile');
	}
	
});

router.get('/validate/:id', async (req, res, next) => {
	const result = await Files.findOne({
		"unique_id": req.params.id + ""
	});
	let validateTrns = await xrpl_validatefunding(result);
	res.json(validateTrns);
});

module.exports = router;