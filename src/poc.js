const axios = require("axios");
const cheerio = require("cheerio");
 
const fs = require('fs');


function getCurrentTimestamp() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-');
    return timestamp;
  }

async function extractParagraphsFromArticle(url) {
  try {
    // Fetch the HTML content of the webpage
    const response = await axios.get(url);
    const html = response.data;

    // Load the HTML content into Cheerio
    const xxx = cheerio.load(html);

    // Extract the article element using a specific selector
    // Extract the article element using a specific selector
    const articleElement = xxx('article');

    // Extract all the paragraphs within the article


    // Extract all the paragraphs within the article
    const paragraphs = articleElement.find("p");
    const chaptertitle = articleElement.find("h3");
    const filteredParagraphs = paragraphs.filter((index, element) => {
      return xxx(element).attr("class") === undefined;
    });
    let content = "";
    if(chaptertitle.length>0)content = xxx(chaptertitle[0]).text() + "\n";
    // Loop through the filtered paragraphs and print their text content
    filteredParagraphs.each((index, element) => {
      if (index < 100) {
        const paragraphText = xxx(element).text();
       // console.log(`Paragraph ${index + 1}: ${paragraphText}`);
       if(paragraphText!="\\n")
        content=content + paragraphText +"\n" ;
      }
    });
    console.log(content);
    const timestamp = getCurrentTimestamp();
    const fileName = `${timestamp}_combined_paragraphs.txt`;
    const filePath = `C:/tmp/${fileName}`;
    fs.writeFileSync(filePath, combinedText, 'utf8');
  } catch (error) {
    console.error("Error:", error.message);
  }
}




// Usage example
const url = "https://ixdzs.tw/read/339561/p1.html"; // Replace with your desired URL

const classSelector = ".article-content"; // Replace with the specific class selector
extractParagraphsFromArticle(url);
