const express = require('express');
const blockchainController = require('./src/controllers/blockchain');

const url = process.env.URL || '0.0.0.0';
const port = process.env.PORT || 4500;

let app = express();
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

let controller = new blockchainController(url, port);
let listener = app.listen(port, url, function () {
  console.log('Server started at ' + listener.address().address + ':' + listener.address().port);
});

app.get('/nodes', controller.getNodes.bind(controller));
app.post('/media', controller.postMedia.bind(controller));
//app.get('/medias', controller.getMedias.bind(controller));
app.get('/mine', controller.mine.bind(controller));
app.get('/blockchain/last-index', controller.getBlockLastIndex.bind(controller));
app.get('/blockchain/:idx', controller.getBlockByIndex.bind(controller));
app.get('/blockchain', controller.getBlockchain.bind(controller));