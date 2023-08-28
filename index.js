const express = require("express");
const path = require('path');
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
 
app.get('/main', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

app.post("/download", async (req, res) => {
  // const url = req.body.url;
  // const start = parseInt(req.body.start);
  // const finish = parseInt(req.body.finish);
  const { bookName, url, start, finish, repeat } = req.body;
  try {
    let startLocal = parseInt(start);
    let finishLocal = parseInt(finish);
    let combinedText ="";
    let repeatLocal = parseInt(repeat);
    const diff = finishLocal - startLocal;
    const htmltail = "</body>\n</html>\n";
    for (let repeatCount = 0; repeatCount < repeatLocal; repeatCount++) {
      combinedText =
      "<!DOCTYPE html>\n" +
      "<html>\n" +
      "<head>\n" +
      '<meta charset="utf-8">\n' +
      "<title>Web Content Downloader</title>\n" +
      "</head>\n" +
      "<body>\n";
      for (let index = startLocal; index <= finishLocal; index++) {
        const currentUrl = `${url}${index}.html`;
        // Fetch the HTML content of the webpage
        const response = await axios.get(currentUrl);
        const html = response.data;

        // Load the HTML content into Cheerio
        const $ = cheerio.load(html);
        const articleElement = $("article");

        // Extract all the paragraphs within the article
        const allparagraphs = articleElement.find("p");
        const chaptertitle = articleElement.find("h3");
        const paragraphs = allparagraphs.filter((index, element) => {
          return $(element).attr("class") === undefined;
        });
        // Combine paragraphs into a single text string
        if (chaptertitle.length > 0)
          combinedText += "<h3 style=\"color:red;\">" + $(chaptertitle[0]).text() + "</h3>\n";
        paragraphs.each((index, element) => {
          const paragraphText = $(element).text();
          combinedText += paragraphText + "\n";
        });
      }
      
      const fileName = `${bookName}_${startLocal}-${finishLocal}.html`;

      const filePath = `C:/Users/User/Dropbox/books/${fileName}`;
      combinedText += htmltail;
      // Append the combined text to an existing file or create a new file if it doesn't exist
      fs.appendFileSync(filePath, combinedText, "utf8");
      console.log(`Paragraphs appended to: ${filePath}`);
      combinedText="";
      startLocal = finishLocal + 1;
      finishLocal = startLocal + diff;
    }

    // Set the URL, start, and finish values as cookies
    const cookieOptions = [
      `bookName=${encodeURIComponent(bookName)}`,
      `url=${encodeURIComponent(url)}`,
      `start=${startLocal}`,
      `finish=${finishLocal}`,
      `repeat=${repeat}`
    ];
    res.setHeader("Set-Cookie", cookieOptions);

    res.sendStatus(200);
  } catch (error) {
    console.error("Error:", error.message);
    res.sendStatus(500);
  }
});

function getCurrentTimestamp() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-");
  return timestamp;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
