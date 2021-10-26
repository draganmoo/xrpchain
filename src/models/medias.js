const Media = require('./media');

class Medias {
    constructor() {
        this.list = [];
    }

    add(req, res) {
        let response = '';

        try {
            let tx = new Media(req.body.user, req.body.mediaobj, req.body.key, req.body.data);
            this.list.push(tx);
            response = true;

        } catch (ex) {
            console.log({
                'error': ex.message
            })
            response = false;
        }

        return response;
    }

    get() {
        return this.list;
    }

    reset() {
        this.list = [];
    }
}

module.exports = Medias;