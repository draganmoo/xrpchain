class Block {
    constructor() {
        this.index = 0;
        this.previousHash = '';
        this.hash = '';
        this.timestamp = Math.floor(+new Date() / 1000);
        this.nonce = 0;
        this.medias = [];
    }

    get key() {
        return JSON.stringify(this.medias) + this.index + this.previousHash + this.nonce;
    }

    addMedias(medias) {
        medias.list.forEach(media => {
            this.medias.push(media);
        });
        medias.reset();
    }

}

module.exports = Block;