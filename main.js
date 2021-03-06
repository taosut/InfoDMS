/**
 * Created by leobernard on 13/02/15.
 */

console.log("Starting app");

console.log("   Initializing Database...");
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/infodms');

console.log("   Initializing Models...");
var models = require("./models")(mongoose);

console.log("   Initializing Components...");
var textAnalyzer = require("./components/textAnalyzer")(models);

console.log("App initialized.");
console.log("--------------------------");
console.log("");

function getUTF8String(buffer) {
    var detector = require('node-icu-charset-detector');
    var Iconv = require('iconv').Iconv;

    var charset = "utf8";

    try {
        charset = detector.detectCharset(buffer).toString();
    } catch(e) {
        if(buffer.length == 0) return "";
    }

    try {
        return buffer.toString(charset);
    } catch (x) {
        var charsetConverter = new Iconv(charset, "utf8");
        return charsetConverter.convert(buffer).toString();
    }
}

function addDocument(type, path) {
    var fs = require('fs');

    fs.readFile(path, function(err, buffer) {
        textAnalyzer.analyzeTextsToDatabase([getUTF8String(buffer)], type, function(err, data) {
            if(!err) {
                data.keywords = data.keywords.slice(0, 25);
                console.log(data);
                console.log("Success!");
                process.exit();
            } else {
                console.error(err);
            }
        }, function(index, length) {
            console.log("Analyzing", index, "of", length, "documents...");
        });
    });
}

function addDocuments(type, path) {
    var fs = require('fs');

    fs.readdir(path, function(err, files) {
        var texts = [];

        files.filter(function(file) {
            return file.substr(0, 1) != ".";
        }).forEach(function(file){
            var buffer = fs.readFileSync(path + file);
            texts.push(getUTF8String(buffer));
        });

        textAnalyzer.analyzeTextsToDatabase(texts, type, function(err, data) {
            if(!err) {
                data.keywords = data.keywords.slice(0, 25);
                console.log(data);
                console.log("Success!");
                process.exit();
            } else {
                console.error(err);
            }
        }, function(index, length) {
            console.log("Analyzing", index, "of", length, "documents...");
        });
    });
}

function guessType(path) {
    var fs = require('fs');

    fs.readFile(path, function(err, buffer) {
        textAnalyzer.calculateSimilarities(getUTF8String(buffer), function(err, data) {
            if(!err) {
                console.log(data);
                console.log("Success!");
                process.exit();
            } else {
                console.error(err);
            }
        });
    });
}

function uploadDocumentToDatabase(filePath, savePath, callback) {
    var fs = require('fs');
    var pathModule = require('path');
    var readStream = fs.createReadStream(filePath, {
        'flags': 'r',
        'encoding': 'utf8',
        'bufferSize': 4 * 1024
    });
    var writeStream = fs.createWriteStream(savePath);
    readStream.pipe(writeStream);

    readStream.on('end', function() {
        writeStream.end();
    });

    writeStream.on('finish', function() {
        textAnalyzer.calculateDocumentHash(savePath, null, function(err, data) {
            var hashValue = data;

            var documentName = pathModule.basename(filePath);
            var uploadedDate = Date.now();
            var lastEditedDate = uploadedDate;

            callback(false);
        });

    });

    readStream.on('error', function(err) {
       callback(err);
    });

    writeStream.on('error', function(err) {
        callback(err);
    });
}

console.log(process.argv[2] + ":");

switch(process.argv[2]) {
    case "types":
        textAnalyzer.getDocumentTypes(function(err, data) {console.log(data);process.exit();});
        break;

    case "addDocument":
        addDocument(process.argv[3], process.argv[4]);
        break;

    case "addDocuments":
        addDocuments(process.argv[3], process.argv[4]);
        break;

    case "guessType":
        guessType(process.argv[3]);
        break;

    case "guessLanguage":
        textAnalyzer.guessDocumentLanguage(process.argv[3]);
        break;

    case "calculateHash":
        textAnalyzer.calculateDocumentHash(process.argv[3], null, function(err, data) {
            console.log(data);
        });
        break;

    case 'mau?':
        uploadDocumentToDatabase("/Users/leobernard/Desktop/02182015164813.pdf", "/Users/leobernard/Desktop/Zeugnisse/bla.pdf", function(err){console.log(err)});
        break;


    default:
        console.error("Please use a correct command.");
}