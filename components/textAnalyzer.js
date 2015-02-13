module.exports = function(models) {
    function extractKeywords(text) {
        var stopWords = require("./../stop-words/de.json");

        var keywords = {};

        var textParts = text.split(" ");
        var analyzeParts = text.split(" ");

        for(var length = 2; length <= 2; length++) {
            for(var i = 0; i <= textParts.length - length; i++) {
                analyzeParts.push(textParts.slice(i, i+length).join(" "));
            }
        }

        analyzeParts.forEach(function(word) {
            word = word.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ' ').trim();
            word = word.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");

            if (word != "" && word.length >= 3 && stopWords.indexOf(word) <= -1) {
                if (keywords.hasOwnProperty(word)) {
                    keywords[word] += 1;
                } else {
                    keywords[word] = 1;
                }
            }
        });

        return Object.keys(keywords).map(function(value) {
            return {
                word: value,
                count: keywords[value]
            }
        });
    }

    function calculateAverage(wordCount, field, textFilesCount) {
        var words = wordCount.slice();

        words = words.map(function(word){
            word['average' + field.substr(0, 1).toUpperCase() + field.substr(1)] = word[field] / textFilesCount;
            return word;
        });

        return words;
    }

    function mapArrayToObject(array, field) {
        var obj = {};

        array.forEach(function(item) {
            obj[item[field]] = item;
        });

        return obj;
    }

    function analyzeTexts(textFiles, existingData, analyzedDocumentCount, progressCallback) {
        var keywords = existingData || {};

        textFiles.forEach(function(file, index) {
            if(progressCallback) progressCallback(index+1, textFiles.length);

            var textKeywords = extractKeywords(file);

            textKeywords.forEach(function(keyword){
                if(keywords.hasOwnProperty(keyword.word)) {
                    keywords[keyword.word].count += keyword.count;
                    keywords[keyword.word].absoluteCount += 1;
                } else {
                    keyword.absoluteCount = 1;
                    keywords[keyword.word] = keyword;
                }
            });
        });

        var mappedKeywords = Object.keys(keywords).map(function(key) {
            return keywords[key];
        });

        mappedKeywords = calculateAverage(mappedKeywords, 'count', textFiles.length + (analyzedDocumentCount || 0));
        mappedKeywords = calculateAverage(mappedKeywords, 'absoluteCount', textFiles.length + (analyzedDocumentCount || 0));

        mappedKeywords = mappedKeywords.sort(function(a, b){
            return b.absoluteCount - a.absoluteCount;
        });

        return mappedKeywords;
    }

    function analyzeTextsToDatabase(textFiles, dataType, callback, progressCallack) {
        models.DocumentType.findOne({name: dataType}, function(err, doc) {
            if(!err) {
                var existingData = doc ? mapArrayToObject(doc.keywords, 'word') : {};
                var keywords = analyzeTexts(textFiles, existingData, doc ? doc.analyzedDocuments : 0, progressCallack);

                if(doc) {
                    models.DocumentType.findByIdAndUpdate(doc._id, {
                        keywords: keywords,
                        analyzedDocuments: (doc ? doc.analyzedDocuments : 0) + textFiles.length
                    }, function(err2, doc2){
                        callback(err2, doc2);
                    });
                }else{
                    var type = new models.DocumentType({name: dataType, analyzedDocuments: textFiles.length, keywords: keywords});
                    type.save(function(err2, doc2){
                        callback(err2, doc2);
                    });
                }
            } else {
                callback(true, null);
            }
        });
    }

    function calculateSimilarity(textFile, averageCountList) {
        var wordList = extractKeywords(textFile);
        var averageCounts = {};
        var averageSum = 0;

        averageCountList.filter(function(word) {
            return word.absoluteCount > 1;
        }).forEach(function(word) {
            averageCounts[word.word] = word;
            averageSum += word.averageAbsoluteCount
        });

        var similarity = 0;

        wordList.forEach(function(word) {
            if(averageCounts.hasOwnProperty(word.word)) {
                similarity += averageCounts[word.word].averageAbsoluteCount;
            }
        });

        return similarity / averageSum;
    }

    function calculateSimilarities(text, callback) {
        models.DocumentType.find(function(err, types) {
            if(!err) {
                var similarities = [];

                types.forEach(function(type) {
                    similarities.push({
                        _id: type._id,
                        type: type.name,
                        similarity: calculateSimilarity(text, type.keywords)
                    });
                });

                similarities.sort(function(a, b) {
                    return b.similarity - a.similarity;
                });

                callback(false, similarities);
            } else {
                callback(err, null);
            }
        });
    }

    function guessDocumentType(text, callback) {
        calculateSimilarities(text, function(err, similarities){
            if(!err) {
                if(similarities.length > 0) {
                    callback(false, similarities[0]);
                } else {
                    callback(false, null);
                }
            }else{
                callback(err, null);
            }
        });
    }

    function getDocumentTypes(callback) {
        models.DocumentType.aggregate([{
            $group: {
                _id: "$name"
            }
        }], function(err, docs){
            if(!err) {
                callback(false, docs.map(function(doc){return doc._id}));
            } else {
                callback(err, null);
            }
        });
    }

    return {
        analyzeTextsToDatabase: analyzeTextsToDatabase,
        analyzeTexts: analyzeTexts,
        calculateSimilarities: calculateSimilarities,
        guessDocumentType: guessDocumentType,
        getDocumentTypes: getDocumentTypes
    }
};