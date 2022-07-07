const mongoose = require('mongoose');
const { Schema } = mongoose;

const WordImageModelShema = new Schema({
    names: [],
    imageData: {
        type: String,
    }

});
module.exports = WordImageModelShema;