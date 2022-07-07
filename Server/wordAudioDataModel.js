const mongoose = require('mongoose');
const { Schema } = mongoose;

const WordAudioModelShema = new Schema({
    name: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 60
    },
    audioData: {
        type: String
    }
});
module.exports = WordAudioModelShema;