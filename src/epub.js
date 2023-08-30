const epubParser = require('epub-parser');
const fs = require('fs');

const epubFilePath = 'C:/Users/User/Downloads/0405.epub';
epubParser.open(epubFilePath, function (err, epubData) {
 
    if(err) return console.log(err);
    console.log(epubData.easy);
    console.log(epubData.raw.json.ncx);
 
});
