class Media {
    constructor(user, mediaobj, key, data = null) {
        if (!user || !mediaobj || !key)
            throw new Error('Invalid data');

        this.user = user;
        this.mediaobj = mediaobj;
        this.key = key;
        this.data = data;
        this.timestamp = Math.floor(+new Date() / 1000);
    }
}

module.exports = Media;