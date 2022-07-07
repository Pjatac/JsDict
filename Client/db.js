function getAudio(key) {
    return new Promise((resolve, reject) => {
        var transaction = db.transaction(["audio"]);
        var objectStore = transaction.objectStore("audio");
        var request = objectStore.get(key);

        request.onerror = function (event) {
            reject(() => alert("Unable to retrieve data from database!"));
        };

        request.onsuccess = function (event) {
            resolve(request.result);
        };
    })
}

function addAudio(key, value) {
    return new Promise((resolve, reject) => {
        var request = db.transaction(["audio"], "readwrite")
            .objectStore("audio")
            .add(value, key);

        request.onsuccess = function (event) {
            resolve(true);
        };

        request.onerror = function (event) {
            reject(() => alert("Unable to save data to database!"));
        }
    });
}
function getImage(key) {
    return new Promise((resolve, reject) => {
        var transaction = db.transaction(["image"]);
        var objectStore = transaction.objectStore("image");
        var request = objectStore.get(key);

        request.onerror = function (event) {
            reject(() => alert("Unable to retrieve data from database!"));
        };

        request.onsuccess = function (event) {
            resolve(request.result);
        };
    })
}

function addImage(key, value) {
    return new Promise((resolve, reject) => {
        var request = db.transaction(["image"], "readwrite")
            .objectStore("image")
            .add(value, key);

        request.onsuccess = function (event) {
            resolve(true);
        };

        request.onerror = function (event) {
            reject(() => alert("Unable to save data to database!"));
        }
    });
}