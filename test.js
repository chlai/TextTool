const axios = require('axios');
const cheerio = require('cheerio');

async function extractBookNames(startUrl, endUrl) {
    const commonPrefix = startUrl.substring(0, startUrl.lastIndexOf('_') + 1);
    const startNum = parseInt(startUrl.split('_').pop());
    const endNum = parseInt(endUrl.split('_').pop());

    const bookNames = [];

    for (let i = startNum; i <= endNum; i++) {
        const url = `${commonPrefix}${i}.html`;

        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const namesInPage = [];
        $('div.box span[itemprop="name"]').each(function() {
            const bookName = $(this).text();
            namesInPage.push(bookName);
        });
        Array.prototype.push.apply(bookNames, namesInPage);

    }

    return bookNames;
}

const startUrl = "https://big5.quanben.io/c/zhichang_1.html";
const endUrl = "https://big5.quanben.io/c/zhichang_10.html";

extractBookNames(startUrl, endUrl)
    .then(bookNames => {
        for (const name of bookNames) {
            console.log(name);
        }
    });

  