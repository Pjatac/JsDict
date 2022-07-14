let dict = [];
let newDictInfo;
let selectedImageIndex;
let imagesToSelectRefs = [];
let navLinks = ['home', 'select', 'learn', 'add', 'show'];
let currentDict;
let rightAnswerPos = 0;
let questionId = 0;
let newToLearn = false;
let currentProgress = { right: 0, wrong: 0, total: 0 };
let failed = [];
let currentState = null;

const srvURL = "http://localhost:3000/";

window.indexedDB = window.indexedDB || window.mozIndexedDB ||
    window.webkitIndexedDB || window.msIndexedDB;

//prefixes of window.IDB objects
window.IDBTransaction = window.IDBTransaction ||
    window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange ||
    window.msIDBKeyRange

if (!window.indexedDB) {
    window.alert("Your browser doesn't support a stable version of IndexedDB.")
}

var db;
var request = window.indexedDB.open("Trainie", 1);

request.onerror = function (event) {
    console.log("error: ");
};

request.onsuccess = function (event) {
    db = request.result;
    console.log("success: " + db);
};

request.onupgradeneeded = function (event) {
    var db = event.target.result;
    db.createObjectStore("audio");
    db.createObjectStore("image");
}

async function getAllList() {
    $('#dictsList').empty();
    let requestPath = `${srvURL}getAll`;
    var settings = {
        'cache': false,
        "async": true,
        "url": requestPath,
        "mode": "cors",
        "method": "GET",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    await $.get(settings, function (data) {
        if (data.length != undefined && data.length == 0)
            alert("Nothing found...");
        else {
            data.forEach(d => {
                $('#dictsList').append(`<button id="${d._id}" class="btn btn-primary">Author: ${d.author} Name: ${d.name} We learn ${d.from} on ${d.to}</button>`);
                $(`#${d._id}`).on('click', async () => {
                    await startLearningLoaded(d._id);
                });
            });
            $('#dictsList').removeClass("d-none");
        }
    })
        .fail(function () {
            alert('Sorry, you have network connection problem');
        });
}

async function getSearched(searchPath) {
    $('#dictsList').empty();
    let requestPath = `${srvURL}search${searchPath}`;
    var settings = {
        'cache': false,
        "async": true,
        "url": requestPath,
        "mode": "cors",
        "method": "GET",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    await $.get(settings, function (data) {
        if (data.length != undefined && data.length == 0)
            alert("Nothing found...");
        else {
            data.forEach(d => {
                $('#dictsList').append(`<button id="${d._id}" class="btn btn-primary">Author: ${d.author} Name: ${d.name} We learn ${d.from} on ${d.to}</button>`);
                $(`#${d._id}`).on('click', async () => {
                    await startLearningLoaded(d._id);
                });
            });
            $('#dictsList').removeClass("d-none");
        }
    })
        .fail(function () {
            alert('Sorry, you have network connection problem');
        });
}

async function startLearningLoaded(id) {
    $('#spinner').removeClass('d-none');
    let loadModal = $('<div>').dialog({ modal: true });
    loadModal.dialog('widget').hide();
    setProgress();
    //$('#select').addClass("d-none"); ///ean
    goToTab('learn');
    let requestPath = `${srvURL}getById?id=${id}`;
    let settings = {
        'cache': false,
        "async": true,
        "url": requestPath,
        "mode": "cors",
        "method": "GET",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    await $.get(settings, async function (data, err) {
        data.words.map(el => el['key'] = function (n) {
            return this[Object.keys(this)[n]];
        });
        currentDict = { name: data.name, autor: data.author, from: data.from, to: data.to };
        dict = data.words;

        // for (const w of dict) {
        //     //await delay(500)
        //     await loadAudioKeyData(w.key(0), data.from);
        // }

        // for (const word of failed) {
        //     //await delay(500)
        //     await loadAudioKeyData(word.w, word.lang);
        // }
        // failed = [];

        let toLoadStruct = await buildToLoadStruct(dict, currentDict.from);
        if (toLoadStruct.length > 0) {
            settings.data = JSON.stringify(toLoadStruct);
            settings.method = "POST";
            await $.post(settings, async function (data, err) {
                data.words.map(el => el['key'] = function (n) {
                    return this[Object.keys(this)[n]];
                });
                await Promise.all(data.words.map(async (word) => {
                    if (word.audioData !== undefined) {
                        let t1 = `audio-${currentDict.from}-${word.key(0)}`
                        await addAudio(`audio-${currentDict.from}-${word.key(0)}`, word.audioData);
                    }
                    if (word.imageData !== undefined) {
                        let t2 = `img-${currentDict.from}-${word.key(0)}`
                        await addImage(`img-${currentDict.from}-${word.key(0)}`, word.imageData);
                    }
                }))
            });
        }


        $('#dictTitle').text(`Your current learning dictionary: ${data.name}`)
        $('#learn').removeClass("d-none");
        $('.learn').removeClass('disabled');
        getNewWord();
        loadModal.dialog('close');
        $('#spinner').addClass('d-none');
    })
        .fail(function (err) {
            alert('Sorry, you have network connection problem');
        });
}

function delay(ms) {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

async function getNewWord() {
    $('#wrongAnswerResult').addClass("d-none");
    for (let i = 1; i < 5; i++)
        $(`#q${i}`).removeClass('unclickable');
    clearFields();
    questionId = Math.floor(Math.random() * dict.length);
    $('#question').text(dict[questionId].key(0));
    let elem = $('.replay');
    elem.unbind("click");
    elem.click(async function () {
        await getAndPlay(dict[questionId].key(0), currentDict.from);
    });
    elem.onclick = async () => {
        await getAndPlay(dict[questionId].key(0), currentDict.from);
    };
    let included = [questionId];
    rightAnswerPos = Math.floor(Math.random() * 4) + 1;
    let posted = [rightAnswerPos];
    $(`#q${rightAnswerPos}`).text(dict[questionId].key(1));
    for (let i = 0; i < 3; i++) {
        let setted = false;
        while (!setted) {
            let wrongId = Math.floor(Math.random() * dict.length);
            if (included.indexOf(wrongId) == -1) {
                let placed = false;
                while (!placed) {
                    let wrongAnswerPos = Math.floor(Math.random() * 4) + 1;
                    if (posted.indexOf(wrongAnswerPos) == -1) {
                        placed = true;
                        included.push(wrongId);
                        posted.push(wrongAnswerPos);
                        $(`#q${wrongAnswerPos}`).text(dict[wrongId].key(1));
                    }
                }
                setted = true;
            }
        }
    }
    await getAndPlay(dict[questionId].key(0), currentDict.from);
}

async function buildToLoadStruct(words, from) {
    let toLoadStruct = [];
    let needToLoad = false;
    for (const word of words) {
        let audioDataNeeded = await getAudio(`audio-${from}-${word.key(0)}`) == undefined ? true : false;
        let imageDataNeeded = await getImage(`img-${from}-${word.key(0)}`) == undefined ? true : false;
        if (audioDataNeeded || imageDataNeeded) {
            needToLoad = true;
        }
        toLoadStruct.push({ audioDataNeeded: audioDataNeeded, imageDataNeeded: imageDataNeeded });
    }
    return needToLoad ? toLoadStruct : [];
}

async function getAndPlay(word, lang) {
    let data = await loadAudioKeyData(word, lang);
    await play(base64ToArrayBuffer(data));
}

async function tryAnswer(answerPos) {
    for (let i = 1; i < 5; i++)
        $(`#q${i}`).addClass('unclickable');
    let imageData = await imgFromStorage(dict[questionId].key(0), currentDict.from);
    if (answerPos == rightAnswerPos) {
        let image = $('#successedImage');
        image.attr('src', imageData);
        $('#successResult').removeClass("d-none");
        $('#next_word').addClass("d-none");
        currentProgress.right++;
        setTimeout(() => {
            $('#successResult').addClass("d-none");
            getNewWord();
            $('#next_word').removeClass("d-none");
        }
            , 1000);
    }
    else {
        let image = $('#failedImage');
        image.attr('src', imageData);
        $('#correctAnswer').text(dict[questionId].key(1));
        $('#wrongAnswerResult').removeClass("d-none");
        currentProgress.wrong++;
    }
    currentProgress.total++;
    setProgress();
}
function clearFields() {
    for (let i = 1; i < 5; i++)
        $(`#q${i}`).text('');
    $('#question').text('');
}

async function readFile(e) {
    let file = e.target.files[0];
    if (!file) return;
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = async (e) => {
            let dictMap = new Map();
            let rawDictData = e.target.result;
            let dictData = rawDictData.split(/\r\n|\r|\n/); // Lin—"\n", Mac—"\r", MS—"\r\n", RegEx— 4All OS
            dictData = dictData.filter(str => str != '');
            let newDict = [];
            if (dictData.length < 4) {
                alert('Minimum words count is 4');
            }
            else {
                let valid = true;
                let isDoubling = false;
                let doubling = '';
                for (let i = 0; i < dictData.length; i++) {
                    dictData[i] = dictData[i].replace(/(\r\n|\n|\r)/gm, "");
                    let pairArr = dictData[i].split('\t');
                    if (i == 0) {
                        dictMap.set(pairArr[0], true);
                        dictMap.set(pairArr[1], true);
                    }
                    if (pairArr.length != 2 || pairArr[0] == '' || pairArr[1] == '') {
                        valid = false;
                        break;
                    }
                    else {
                        if (i > 0 && dictMap.has(pairArr[0])) {
                            isDoubling = true;
                            doubling = pairArr[0];
                            valid = false;
                            break;
                        }
                        else if (i > 0 && dictMap.has(pairArr[1])) {
                            isDoubling = true;
                            doubling = pairArr[1];
                            valid = false;
                            break;
                        }
                        else {
                            newDict.push({
                                [newDictInfo.from]: pairArr[0], [newDictInfo.to]: pairArr[1], key: function (n) {
                                    return this[Object.keys(this)[n]];
                                }
                            });
                            dictMap.set(pairArr[0], true);
                            dictMap.set(pairArr[1], true);
                        }
                    }
                }
                if (valid) {
                    dict = newDict;
                    await fillImages(newDictInfo.from, newDictInfo.to, newDict);
                    await Promise.all(dict.map(async (el) => {
                        if (!el.imageRef)
                            el.imageData = await getImage(`img-${newDictInfo.from}-${el.key(0)}`);
                    }));
                    if (newToLearn) {
                        newToLearn = false;
                        resolve(startLearning());
                    }
                    else {
                        let newToLoadDict = { name: newDictInfo.name, author: newDictInfo.author, from: newDictInfo.from, to: newDictInfo.to, words: dict };
                        await uploadNewDictAsync(newToLoadDict);
                    }
                }
                else {
                    if (isDoubling) {
                        alert(`Your dictionaty has doubling word - ${doubling}`);
                    }
                    else {
                        alert('Error on parsing.');
                    }
                }
            }
            $("#dictFileLoad")[0].value = '';
        }
        reader.readAsText(file);
    });
}

async function uploadNewDictAsync(newToLoadDict) {
    let requestPath = `${srvURL}createNew`;
    var settings = {
        'cache': false,
        "async": true,
        "data": JSON.stringify(newToLoadDict),
        "url": requestPath,
        "mode": "cors",
        "method": "POST",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    return new Promise((resolve, reject) => {
        $.post(settings, function (data) {
            $('#addSelection').removeClass('d-none');
            $('#fillNewLoadDict').addClass('d-none');
            resolve(data);
        })
            .fail(function () {
                reject({ message: "Sorry, network connection problem." });
            })
    });
}

async function fillImages(from, to, words) {
    $('#spinner').removeClass('d-none');
    for (const word of words) {
        let storedImg = await imgFromStorage(word.key(0), from);
        if (storedImg == null || storedImg == undefined) {
            let request = JSON.stringify({ [from]: word.key(0), [to]: word.key(1) });
            let imageDataId = await getImageFromUser(request);
            let imgSrc = imagesToSelectRefs[imageDataId].data;
            if (imagesToSelectRefs[imageDataId].imageRef) {
                word.imageRef = imagesToSelectRefs[imageDataId].imageRef;
                await imgToStorage(word.key(0), from, imagesToSelectRefs[imageDataId].data);
            }
            else {
                let compressedData = await loadImgStr64(imgSrc);
                await imgToStorage(word.key(0), from, compressedData);
            }
            $('#imageSelectButton').off('click');
        }
    }
    $('#spinner').addClass('d-none');
}

async function getImageFromUser(word) {
    $('#spinner').removeClass('d-none');
    imagesToSelectRefs = await getImages(word);
    let imagesDialog = $('#imagesModal');
    $('.dialog-title').text(word);
    let imagesContainer = $('#imagesCollection');
    await imagesToSelectRefs.forEach(img => {
        let image = document.createElement("img");
        image.width = 100;
        image.className = 'ui-widget-content';
        image.onload = () => {
            imagesContainer.append(image);
        }
        image.src = img.data;
    });
    $('#spinner').addClass('d-none');
    return await showImageSelectDialog(imagesDialog);
}

// function getDictFromFileAndLearn() {
//     newToLearn = true;
//     $('#addSelection').addClass('d-none');
//     $('#fillNewLoadDict').removeClass('d-none');
// }

function getDictFromFileAndAdd() {
    $('#addSelection').addClass('d-none');
    $('#fillNewLoadDict').removeClass('d-none');
}

function fillNewDict() {
    $('#addSelection').addClass('d-none');
    $('#fillNewDict').removeClass('d-none');
}

async function getImages(word) {
    let requestPath = `${srvURL}getImages?word=${word}`;
    var settings = {
        'cache': false,
        "async": true,
        "url": requestPath,
        "mode": "cors",
        "method": "GET",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    return await $.get(settings, function (data) {
        return data;
    });
}

function goToTab(navLink) {
    navLinks.forEach(link => {
        if (link == navLink) {
            //$(`#${link}`).removeClass("d-none"); ///ean
            $(`.${link}`).addClass('text-decoration-underline');
            $(`.${link}`).parent().removeClass('active');
        }
        else {
            //$(`#${link}`).addClass("d-none"); ///ean
            $(`.${link}`).removeClass('text-decoration-underline');
            $(`.${link}`).parent().addClass('active');
        }
    });
}

function startLearning() {
    setProgress();
    //$('#select').addClass("d-none"); ///ean
    $('.learn').removeClass('disabled');
    goToTab('learn');
    $('#dictTitle').text(`Your current learning dictionary: ${currentDict.name}`);
    $('#learn').removeClass("d-none");
    getNewWord();
}

function setProgress() {
    $('#total').text(currentProgress.total);
    $('#wrong').text(currentProgress.wrong);
    $('#right').text(currentProgress.right);
}

$(function () {
    $("#newDictTitle").on("submit", async function (event) {
        event.preventDefault();
        let titleData = new FormData(this);
        let title = Object.fromEntries(titleData.entries());
        let res = await validateNewDictTitle(title);
        if (res != "")
            alert(res);
        else {
            newDictInfo = { author: title.author, name: title.name, from: convertLanguageToCode(title.from), to: convertLanguageToCode(title.to), words: [] };
            startFullfill();
        }
    })

    $("#findForm").on("submit", async function (event) {
        event.preventDefault();
        let titleData = new FormData(this);
        let title = Object.fromEntries(titleData.entries());
        if (title.author == "" && title.name == "" && title.from == "" && title.to == "")
            getAllList();
        else {
            title.from = title.from == "" ? "Empty" : title.from;
            title.to = title.to == "" ? "Empty" : title.to;
            let searchRequest = "?";
            if (title.author != "")
                searchRequest += "author=" + title.author + "&";
            if (title.name != "")
                searchRequest += "name=" + title.name + "&";
            if (convertLanguageToCode(title.from) != "")
                searchRequest += "from=" + convertLanguageToCode(title.from) + "&";
            if (convertLanguageToCode(title.to) != "")
                searchRequest += "to=" + convertLanguageToCode(title.to);
            getSearched(searchRequest);
        }

    })

    $("#newLoadDictTitle").on("submit", async function (event) {
        event.preventDefault();
        let titleData = new FormData(this);
        let title = Object.fromEntries(titleData.entries());
        let res = await validateNewDictTitle(title);
        if (res != "")
            alert(res);
        else {
            newDictInfo = { author: title.author, name: title.name, from: convertLanguageToCode(title.from), to: convertLanguageToCode(title.to), words: [] };
            $('#dictFileLoad').click();
        }
    })

    $("#newWord").on("submit", async function (event) {
        event.preventDefault();
        let wordData = new FormData(this);
        let word = Object.fromEntries(wordData.entries());
        if (word.fromWord == "" || word.toWord == "")
            alert("You can't use an empty values for word");
        else {
            newDictInfo.words.push({
                [newDictInfo.from]: word.fromWord, [newDictInfo.to]: word.toWord, key: function (n) {
                    return this[Object.keys(this)[n]];
                }
            });
            let storedImg = await imgFromStorage(word.fromWord, newDictInfo.from);
            if (storedImg == undefined) {
                let request = JSON.stringify({ [newDictInfo.from]: word.fromWord, [newDictInfo.to]: word.toWord });
                let imageDataId = await getImageFromUser(request);
                let imgSrc = imagesToSelectRefs[imageDataId].data;
                if (imagesToSelectRefs[imageDataId].imageRef) {
                    newDictInfo.words[newDictInfo.words.length - 1].imageRef = imagesToSelectRefs[imageDataId].imageRef;
                    await imgToStorage(word.fromWord, newDictInfo.from, imagesToSelectRefs[imageDataId].data);
                }
                else {
                    let compressedData = await loadImgStr64(imgSrc);
                    await imgToStorage(word.fromWord, newDictInfo.from, compressedData);
                }

                $('#imageSelectButton').off('click');
                addNewWordToDictionaryView(imgSrc);
            }
            else {
                addNewWordToDictionaryView(storedImg);
            }
        }
    })

    $(function () {
        let sel = $(".selectable");
        sel.selectable({
            selected: function (event, ui) {
                $(event.target).children('.ui-selected').not(':first').removeClass('ui-selected');
            }
        });

    });
});



function removeWord(from) {
    $(`#newDictWord${from}`).remove();
    newDictInfo.words = newDictInfo.words.filter((value) => value[newDictInfo.from] != from);
}

function startFullfill() {
    currentState = 'newOnSite';
    $('#startFullfillButton').addClass('d-none');
    $('#finishAndStart').removeClass('d-none');
    $('#finishAndStart').addClass('d-block');
    $('#newWord').removeClass('d-none');
    $('#wordList').removeClass('d-none');
    $('#wordList').addClass('d-flex');
}

async function validateNewDictTitle(title) {
    if (title.from == title.to)
        return "You could't create dictionary with same 'from' and 'to'";
    if (!newToLearn) {
        let newDict = { name: title.name, author: title.author, from: convertLanguageToCode(title.from), to: convertLanguageToCode(title.to), words: [] };
        let requestPath = `${srvURL}checkExisting`;
        var settings = {
            'cache': false,
            "async": true,
            "data": JSON.stringify(newDict),
            "url": requestPath,
            "mode": "cors",
            "method": "POST",
            "crossdomain": true,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        }
        let exist = "";
        await $.post(settings, function (data) {
            if (data != "done")
                exist = "Dictionary of this author with same name for given languages allredy exist in the system";
        })
        return exist;
    }
    else {
        currentDict = { author: title.author, name: title.name, from: convertLanguageToCode(title.from), to: convertLanguageToCode(title.to), words: [] };
        return "";
    }
}

function convertLanguageToCode(lang) {
    let codes = { Empty: "", English: "en", Russian: "ru", Hebrew: "he", France: "fr", Spain: "sp" };
    return codes[lang];
}

function convertCodeToLanguage(code) {
    let languages = { en: "English", ru: "Russian", he: "Hebrew", fr: "France", sp: "Spain" };
    return languages[code];
}

async function finishAndStart() {
    if (newDictInfo.words.length < 4)
        alert("You could'n start with less than 4 words");
    else {
        dict = newDictInfo.words;
        currentDict = { name: newDictInfo.name, autor: newDictInfo.author, from: newDictInfo.from, to: newDictInfo.to };
        await Promise.all(newDictInfo.words.map(async (w) => {
            if (!w.imageRef)
                w.imageData = await getImage(`img-${currentDict.from}-${w.key(0)}`);
        }));

        let result = await uploadNewDictAsync(newDictInfo);
        alert(result.message);
        if (result.id) {
            await startLearningLoaded(result.id);
            newDictInfo = [];
        }
    }
}

async function play(data) {
    if (data != undefined && data.byteLength != 0) {
        const context = new AudioContext();
        const buffer = await context.decodeAudioData(data);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start();
    }
}

function base64ToArrayBuffer(base64) {
    try {
        var binary_string = window.atob(base64);
        var len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
    catch (ex) {
        console.log(base64)
    }
}

async function loadAudioKeyData(key) {
    let audioKey = `audio-${currentDict.from}-${key}`;
    let data = await getAudio(audioKey);
    if (data == undefined || data == null) {
        let requestPath = `${srvURL}getWordAudioData?name=${key}&lang=${currentDict.from}`;
        var settings = {
            "async": true,
            "url": requestPath,
            "mode": "cors",
            "method": "GET",
            "crossdomain": true,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        }
        await $.get(settings, async function (data) {
            if (data != "Failed") {
                await addAudio(audioKey, data);
                return data;
            }
            else {
                failed.push({ w: key, lang: currentDict.from });
                //await delay(5000);
            }
        })
            .fail(function () {
                return undefined;
            });
    }
    else {
        return data;
    }
}

async function showImageSelectDialog(imagesDialog) {
    imagesDialog.modal('show');
    return new Promise((resolve, reject) =>
        $('#imageSelectButton').on('click', () => {
            let sel = $(".selectable");
            selectedImageIndex = null;
            sel.children().each(function (index) {
                if ($(this).hasClass("ui-selected")) {
                    selectedImageIndex = index;
                }
            });
            if (selectedImageIndex == null) {
                $('#imageSelectButton').text('You must select any image!');
                setTimeout(() => { $('#imageSelectButton').text('Select and close modal'); }, 500);
            } else {
                sel.empty();
                $('#imagesModal').modal('hide');
                resolve(selectedImageIndex);
            }
        }
        )
    );
}

async function addNewWordToDictionaryView(img) {
    let word = newDictInfo.words[newDictInfo.words.length - 1];
    let container = document.createElement("div");
    container.setAttribute('class', 'new-word-container');
    container.setAttribute("id", `newDictWord${word.key(0).replace(/\s+/g, '')}`);
    let from = document.createElement("div");
    from.append(`${newDictInfo.from}: ${word.key(0)}`);
    let to = document.createElement("div");
    to.append(`${newDictInfo.to}: ${word.key(1)}`);
    let removeButton = document.createElement("button");
    removeButton.innerHTML = "X";
    removeButton.onclick = () => {
        removeWord(word.key(0).replace(/\s+/g, ''));
    };
    from.append(removeButton);
    container.append(from);
    container.append(to);
    let image = document.createElement("img");
    image.src = img;
    image.width = 100;
    container.append(image);
    $('#wordList').append(container);
    $('#fromWord').val("");
    $('#toWord').val("");
}

async function imgToStorage(key, lang, data) {
    await addImage(`img-${lang}-${key}`, data);
}

const imgFromStorage = async (key, lang) => { return await getImage(`img-${lang}-${key}`) }

function loadImgStr64(sourceUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute('crossorigin', 'anonymous');

        img.onerror = async () => {
            alert("Error loading image string...")
        }
        img.onload = () => {
            const canvas = document.createElement("canvas");
            let maxSide = Math.max(img.width, img.height);
            let coefficient = 1;
            switch (maxSide == img.width) {
                case true:
                    coefficient = 200 / img.width;
                    break;
                case false:
                    coefficient = 200 / img.height;
                    break;
            }
            canvas.width = img.width * coefficient;
            canvas.height = img.height * coefficient;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, img.width, img.height,
                0, 0, canvas.width, canvas.height);
            const dataURL = canvas.toDataURL("image/png");
            resolve(dataURL);
        }
        img.src = sourceUrl;
    })
}

async function getImageDataFromServerByUrl(imageUrl) {
    let requestPath = `${srvURL}getWordImageDataByUrl?url=${imageUrl}`;
    var settings = {
        "async": true,
        "url": requestPath,
        "mode": "cors",
        "method": "GET",
        "crossdomain": true,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    }
    let uncompressedData = await $.get(settings);
    return await loadImgStr64(uncompressedData);
}

//load new added and old added
async function loadNewAddedDictData(id) {
    let uploaded = newDictInfo;
    uploaded.words = [];
}
