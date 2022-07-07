const mongoose = require('mongoose');
const { Schema } = mongoose;

const DictionaryModelShema = new Schema({
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 30
    },
    author: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 30
    },
    from: {
        type: String,
        required: true,
        length:2
    },
    to: {
        type: String,
        required: true,
        length:2
    },
    words: []
});
module.exports = DictionaryModelShema;