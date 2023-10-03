const express = require("express");
const multer = require("multer");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const WebSocket = require("ws");
const app = express();
const port = 3000;

const webserver = new WebSocket.Server({ port: 30009 });
const upload = multer({ dest: "uploads/" });
var processSocket = null;
var stopDownload = false;
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
app.get("/testwebsocket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "testwebsocket.html"));
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
    const headers =
      "<!DOCTYPE html>\n" +
      "<html>\n" +
      "<head>\n" +
      '<meta charset="utf-8">\n' +
      "<title>Web Content Downloader</title>\n" +
      "</head>\n" +
      "<body>\n" +
      '<button id ="_tableofcontent" type="button" style="width: 100%;text-align: left;" >*</button>\n' +
      '<div style="display:none;">';
    let combinedText = "";
    let tableOfContent = "";
    let currentTitle = "";
    let repeatLocal = parseInt(repeat);
    stopDownload = false;
    const diff = finishLocal - startLocal;
    const script =
      "<script>\n" +
      'var coll = document.getElementById("_tableofcontent");\n' +
      'coll.addEventListener("click", function() {\n' +
      "var content = this.nextElementSibling;\n" +
      'if (content.style.display === "block") {\n' +
      'content.style.display = "none";\n' +
      "} else {\n" +
      'content.style.display = "block";\n' +
      "}\n" +
      "});\n" +
      "</script>\n";
    const htmltail =
      '<br>\n<a href="#_tableofcontent">文件結束</a>' +
      script +
      "</body>\n</html>\n";
    for (
      let repeatCount = 0;
      repeatCount < repeatLocal && !stopDownload;
      repeatCount++
    ) {
      for (
        let index = startLocal;
        index <= finishLocal && !stopDownload;
        index++
      ) {
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
          currentTitle = $(chaptertitle[0]).text();
          tableOfContent += `<a href="#_name${index}">${currentTitle}</a><br>\n`;
          combinedText +=
            `<a href="#_tableofcontent" name="_name${index}">` +
            '<h3 style="color:red;">' +
            currentTitle +
            "</h3></a>\n";
          if (processSocket != null) {
            processSocket.emit("chapter", currentTitle);
          }
        }
        let smallParagraphs = "";
        paragraphs.each((index, element) => {
          const paragraphText = $(element).text();
          smallParagraphs += paragraphText;
          if (index%10 ==9) {
            combinedText += "<p>" + smallParagraphs + "</p>\n";
            smallParagraphs = "";
          }
        });
        combinedText += "<p>" + smallParagraphs + "</p>\n";
      }

      const fileName = `${bookName}_${startLocal}-${finishLocal}.html`;

      const filePath = `C:/Users/User/Dropbox/books/${fileName}`;
      combinedText =
        headers + tableOfContent + "</div>\n" + combinedText + htmltail;
      // Append the combined text to an existing file or create a new file if it doesn't exist
      fs.appendFileSync(filePath, combinedText, "utf8");
      tableOfContent = "";
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
  console.log(`Client connected from ${referer}\n${new Date()}`);
  if (referer.includes("testsocket")) {
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
    socket.on("message", (data) => {
      console.log(`Received message: ${data}`);
      // Do something with the message data
    });
  } else if (referer.includes("download")) {
    processSocket = socket;
  }
  socket.on("disconnect", () => {
    stopDownload = true;
    console.log(
      "Client " +
        socket.request.headers.referer +
        " disconnected.\n" +
        new Date()
    );
    processSocket = null;
  });
});

webserver.on("connection", (socket) => {
  console.log("WebSocket client connected");

  socket.on("message", (message) => {
    console.log(`Received message: ${message}`);

    // Send a response message back to the client
    socket.send(`You said: ${message}`);
  });

  socket.on("close", () => {
    console.log("WebSocket Client disconnected");
  });
});
