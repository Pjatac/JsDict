const express = require('express');
const app = module.exports = express();
const port = process.env.port || 3000;
const base64 = require('node-base64-image');
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const google = require("googlethis");

//#region init
const mongoose = require('mongoose');
const cors = require('cors');
var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200
}
const request = require('request');

app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ extended: true }));

var localDbConn = mongoose.createConnection('mongodb://localhost/wordsData')
//var cloudDbConn = mongoose.createConnection('mongodb+srv://dbadmin:DostupMongo21!@dictionariesdata.ckf2j.mongodb.net/myFirstDatabase?retryWrites=true&w=majority');

const WordAudioData = localDbConn.model('WordAudioData', require('./wordAudioDataModel'));
const WordImageData = localDbConn.model('WordImageData', require('./wordImageDataModel'));
//const Dictionary = cloudDbConn.model('Dictionary', require('./dictionaryModel'));
const Dictionary = localDbConn.model('Dictionary', require('./dictionaryModel'));

// mongoose.connect()
// .then(() => console.log('Connect to DB sucess'))
// .catch((err) => console.log(err));


app.use(cors(corsOptions));

// app.use('/api', purchaseRouter);
// app.use('/api', priceRouter);
// #endregion
app.get('/', (req, res) => {
    // res.json('Test!');
});

app.get('/getByNameAndAuthor', async (req, res) => {
    const query = Dictionary.where({ name: req.query.name, autor: req.query.author });
    query.find(function (err, dict) {
        if (err) return res.json({});
        if (dict) {
            return res.json(dict);
        }
    });
});

app.get('/getWordAudioData', async (req, res) => {
    const count = await WordAudioData.countDocuments({ name: `${req.query.lang}-${req.query.name}` });
    if (count == 0) {
        const audioData = await synthesizeSpeech(req.query.name, langToCode(req.query.lang));
        if (audioData != undefined) {
            const newWordAudioData = new WordAudioData({ name: `${req.query.lang}-${req.query.name}`, audioData: Buffer.from(audioData).toString('base64') });
            newWordAudioData.save();
            res.json(newWordAudioData.audioData);
        }
        else {
            await delay(1000);
            res.json("Failed");
        }
    }
    else {
        const wordAudioData = await WordAudioData.findOne({ name: `${req.query.lang}-${req.query.name}` }).exec();
        res.json(wordAudioData.audioData);
    }
});

app.get('/search', async (req, res) => {
    let queryObj = {};
    if (req.query.author)
        queryObj['author'] = req.query.author;
    if (req.query.name)
        queryObj['name'] = req.query.name;
    if (req.query.from)
        queryObj['from'] = req.query.from;
    if (req.query.to)
        queryObj['to'] = req.query.to;
    const query = Dictionary.where(queryObj);
    query.find(function (err, dict) {
        if (err) return res.json({});
        if (dict) {
            return res.json(dict);
        }
    });
});

app.post('/checkExisting', async (req, res) => {
    let data = req.body;
    const count = await Dictionary.countDocuments({ name: data.name, author: data.author, from: data.from, to: data.to }).exec();
    if (count == 0) {
        return res.json("done");
    }
    else
        return res.json("exist");
});

app.get('/getByLangFrom', async (req, res) => {
    const dicts = await Dictionary.find({ from: req.query.lang }).exec();
    res.json(dicts);
});

app.get('/getByLangTo', async (req, res) => {
    const dicts = await Dictionary.find({ to: req.query.lang }).exec();
    res.json(dicts);
});

app.get('/getByName', async (req, res) => {
    const dicts = await Dictionary.find({ name: req.query.name }).exec();
    res.json(dicts);
});

app.get('/getByAuthor', async (req, res) => {
    const dicts = await Dictionary.find({ author: req.query.author }).exec();
    res.json(dicts);
});

//calling on load to learn
app.get('/getById', async (req, res) => {
    const dict = await Dictionary.findById(req.query.id).exec();
    let toClientDict = {};
    toClientDict.from = dict.from;
    toClientDict.to = dict.to;
    toClientDict.words = await buildStartDictData(dict);
    res.json(toClientDict);
});

app.post('/getById', async (req, res) => {
    const dict = await Dictionary.findById(req.query.id).exec();
    let toClientDict = {};
    toClientDict.from = dict.from;
    toClientDict.to = dict.to;
    toClientDict.words = await buildFullDictData(dict, req.body);
    res.json(toClientDict);
});

app.get('/getAll', async (req, res) => {
    const dicts = await Dictionary.find().select('name author from to').exec();
    res.json(dicts);
});

app.post('/createNew', async (req, res) => {
    let collectionLength = await Dictionary.count();
    let existCount = (await Dictionary.find().where('author').equals(req.body.author).where('name').equals(req.body.name).where('from').equals(req.body.from).where('to').equals(req.body.to).exec()).length;
    if (collectionLength == 0 || existCount == 0) {
        await checkAndFillImages(req.body);
        await checkAndFillAudios(req.body);
        const newDict = new Dictionary(req.body);
        newDict.save();
        res.json({ id: newDict._id, message: "New dictionary added." });
    }
    else
        res.json({ message: "Dictionary allready exist." });
});

app.get('/getImages', async (req, res) => {
    let word = JSON.parse(req.query.word);
    let dbImages = await getDbImages(word);
    dbImages = dbImages.map(img => img = { imageRef: img.id, data: img.imageData });

    let googleImagesTo = [];
    let googleImagesFrom = [];
    let tryCounter = 0;
    console.time('googleFull');
    while (googleImagesTo.length == 0 && tryCounter < 10) {
        googleImagesTo = await getGoogleImages(Object.values(word)[1]);
        tryCounter++;
        console.log(`tryNumber=${tryCounter} length=${googleImagesTo.length}`);
    }
    googleImagesTo = googleImagesTo.map(img => img = { data: img });
    while (googleImagesFrom.length == 0 && tryCounter < 10) {
        googleImagesFrom = await getGoogleImages(Object.values(word)[0]);
        tryCounter++;
        console.log(`tryNumber=${tryCounter} length=${googleImagesFrom.length}`);
    }
    googleImagesFrom = googleImagesFrom.map(img => img = { data: img });
    let images = dbImages.concat(googleImagesTo).concat(googleImagesFrom);
    console.timeEnd('googleFull');
    res.json(images);
});

app.get('/getWordImageDataByUrl', async (req, res) => {
    let data = await getBase64FromUrl(req.query.url);
    res.json(data);
});

app.listen(port, () => {
    console.log(`Running on port ${port}`);
});

async function getDbImages(word) {
    let from = Object.keys(word)[0];
    let to = Object.keys(word)[1];
    let key1 = `${from}-${word[from]}`;
    let key2 = `${to}-${word[to]}`
    let existing = await WordImageData.find({ $or: [{ names: key1 }, { names: key2 }] }).exec();
    return existing;
}

async function checkAndFillAudios(dict) {
    let code = langToCode(dict.from);
    let wFrom = dict.from;
    await Promise.all(dict.words.map(async (word) => {
        let wText = word[wFrom];
        const count = await WordAudioData.countDocuments({ name: `${wFrom}-${wText}` });
        if (count == 0) {
            const audioData = await synthesizeSpeech(wText, code);
            if (audioData != undefined) {
                const newWordAudioData = new WordAudioData({ name: `${wFrom}-${wText}`, audioData: Buffer.from(audioData).toString('base64') });
                newWordAudioData.save();
            } else {
                const audioData = await synthesizeSpeech(wText, code);
                if (audioData != undefined) {
                    const newWordAudioData = new WordAudioData({ name: `${wFrom}-${wText}`, audioData: Buffer.from(audioData).toString('base64') });
                    newWordAudioData.save();
                }
            }
        }
    }));
}

async function checkAndFillImages(dict) {
    let from = dict.from;
    let to = dict.to;
    await Promise.all(dict.words.map(async (word) => {
        let key1 = `${from}-${word[from]}`;
        let key2 = `${to}-${word[to]}`;
        if (!word.imageRef) {
            let names = [key1, key2];
            let newImage = new WordImageData({ names: names, imageData: word["imageData"] });
            newImage.save();
            delete word["imageData"];
            word.imageRef = newImage.id;
        } else {
            //let existing = await WordImageData.find({ $or: [{ names: key1 }, { names: key2 }] }).exec();
            let existing = await WordImageData.findOne({ _id: word.imageRef }).exec();
            existing.names = existing.names.filter(name => name != key1 && name != key2);
            existing.names.push(key1);
            existing.names.push(key2);
            existing.save();
        }
    }));
}

async function buildFullDictData(dict, toLoadData) {
    let data = [];
    let words = dict.words;
    let from = dict.from;
    //let to = dict.to;
    await Promise.all(words.map(async (word, index) => {
        if (toLoadData[index].audioDataNeeded) {
            let audio = await WordAudioData.findOne().where('name').equals(`${from}-${word[from]}`).exec();
            word.audioData = audio.audioData;
        }
        if (toLoadData[index].imageDataNeeded) {
            let image = await WordImageData.findOne({ _id: word.imageRef }).exec();
            //let image = await WordImageData.findOne({ $or: [ { names: `${from}-${word[from]}`}, { names: `${to}-${word[to]}` } ] });
            word.imageData = image.imageData;
        }
        delete word["imageRef"];
        data.push(word);
    }));
    return dict.words = data;
}

async function buildStartDictData(dict) {
    let data = [];
    let words = dict.words;
    await Promise.all(words.map(async (word) => {
        delete word["imageRef"];
        data.push(word);
    }));
    return dict.words = data;
}

async function synthesizeSpeech(word, lang) {
    return new Promise(async (resolve, reject) => {
        const speechConfig = sdk.SpeechConfig.fromSubscription("9b651f535f544cd29fa899f6b81aa377", "eastus");
        speechConfig.speechSynthesisLanguage = lang;
        speechConfig.speechSynthesisOutputFormat = 5; // mp3
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
        synthesizer.speakTextAsync(
            word,
            result => {
                const { audioData } = result;
                synthesizer.close();
                resolve(audioData);
            },
            error => {
                synthesizer.close();
                reject(error);
            });
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGoogleImages(toSearchString) {
    const options = {
        safe: 'false',
        additional_params: {
            //as_rights: '(cc_publicdomain|cc_attribute|cc_sharealike).-(cc_noncommercial|cc_nonderived)',
            //as_filetype: 'png', //- work for bmp, gif, png, jpg, and svg
            //imgc: 'gray',// - work for mono gray color
            //tbs: 'isz:ex,iszw:640,iszh:480' // works
            tbs: 'imgsz:medium', // works icon|small|medium|large|xlarge
            num: '10'
        }
    }
    let images = [];
    try {
        images = await google.image(toSearchString, options);
    }
    catch (ex) {
        console.log(ex);
        return [];
    }
    // if (images.length == 0) {
    //     console.log('reasked')
    //     images = await google.image(toSearchString, options);
    // }
    //console.log(images);
    let urls = images.map(i => i.url);
    console.time('googleImagesConvert');
    let strs64 = await Promise.all(urls.map(async (img) => {
        let data = await getBase64FromUrl(img);
        if (data != null)
            return data;
    }));
    console.timeEnd('googleImagesConvert');
    return strs64.filter(el => el != null && el != undefined);
}

async function getBase64FromUrl(url) {
    const options = {
        string: true,
        headers: {
            "User-Agent": "Dict-trainer"
        }
    };
    try {
        let data = `data:image/png;base64,` + await base64.encode(url, options);
        return data;
    }
    catch (e) {
        console.log(e);
        return null;
    }
}

function langToCode(lang) {
    let codes = { en: "en-US", ru: "ru-RU", he: "he-IL", fr: "fr-FR", sp: "es-ES" };
    return codes[lang];
}