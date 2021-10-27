const express = require('express');
const ejs = require('ejs');
const path = require('path');
const app = express();
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const multer  = require('multer')
const blockchainController = require('./controllers/blockchain');

const url = process.env.URL || '0.0.0.0';
const port = process.env.PORT || 4500;

const multerMid = multer({
  storage: multer.memoryStorage(),
})
const MongoDBURI = process.env.MONGO_URI || 'mongodb+srv://root:thunder.32@cluster0.tjbvj.mongodb.net/myFirstDatabase?retryWrites=false';
let controller = new blockchainController(url, port);

mongoose.connect(MongoDBURI, {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
});

app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: db
  })
}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.disable('x-powered-by')
app.use(multerMid.single('file'))
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.use(express.static(__dirname + '/views'));

const index = require('./routes/index');
app.use('/', index);

app.get('/nodes', controller.getNodes.bind(controller));
app.post('/media', controller.postMedia.bind(controller));
//app.get('/medias', controller.getMedias.bind(controller));
app.get('/mine', controller.mine.bind(controller));
app.get('/blockchain/last-index', controller.getBlockLastIndex.bind(controller));
app.get('/blockchain/:idx', controller.getBlockByIndex.bind(controller));
app.get('/blockchain', controller.getBlockchain.bind(controller));
app.get('/download-enc/:id', controller.download_enc.bind(controller));
app.get('/download/:id', controller.download.bind(controller));

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('File Not Found');
  err.status = 404;
  next(err);
});

// error handler
// define as the last app.use callback
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send(err.message);
});

// listen on port 3000
app.listen(port, () => {
  console.log('Express app listening on port '+port);
});