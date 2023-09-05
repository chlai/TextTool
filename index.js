const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });
let processSocket = null;
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/download", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "download.html"));
});
app.get("/uploadepub", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "uploadepub.html"));
});
app.get("/testsocket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "testsocket.html"));
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  // File upload successful, move the file to a specific directory
  const destinationDir = "uploads/";
  const fileName = req.body.file;
  const filePath = destinationDir + fileName;

  // Move the file to the destination directory
  const fs = require("fs");
  fs.renameSync(req.file.path, filePath);

  res.redirect("/");
});
app.post("/download", async (req, res) => {
  // const url = req.body.url;
  // const start = parseInt(req.body.start);
  // const finish = parseInt(req.body.finish);
  const { bookName, url, start, finish, repeat } = req.body;
  try {
    let startLocal = parseInt(start);
    let finishLocal = parseInt(finish);
    let combinedText = "";
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
        if (chaptertitle.length > 0) {
          combinedText +=
            '<h3 style="color:red;">' + $(chaptertitle[0]).text() + "</h3>\n";
          if (processSocket != null) {
            processSocket.emit("progress", $(chaptertitle[0]).text());
          }
        }
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
      combinedText = "";
      startLocal = finishLocal + 1;
      finishLocal = startLocal + diff;
    }

    // Set the URL, start, and finish values as cookies
    const cookieOptions = [
      `bookName=${encodeURIComponent(bookName)}`,
      `url=${encodeURIComponent(url)}`,
      `start=${startLocal}`,
      `finish=${finishLocal}`,
      `repeat=${repeat}`,
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

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const io = socketIo(server);

//socket is return from html page io.connect
io.on("connection", (socket) => {
  const referer = socket.request.headers.referer;
  console.log(`Client connected from ${referer}`);
  if (referer.includes('testsocket')) {
    //it is a demo for socket.io
    const timer = setInterval(() => {
      // Generate a random progress value between 0 and 100
      const progress = Math.floor(Math.random() * 101);
      // Send the progress value to the client
      socket.emit("progress", progress);
      // If the progress value reaches 100, stop the timer
      if (progress === 100) {
        clearInterval(timer);
      }
    }, 1000);
  } else if (referer.includes("download")) {
    processSocket = socket;
  }
  socket.on("disconnect", () => {
    console.log("Client " + socket.request.headers.referer+" disconnected");
    processSocket = null;
  });
});
