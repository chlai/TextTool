const express = require("express");
const multer = require("multer");         
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const diff = require("diff");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const WebSocket = require("ws");

const app = express();
const port = 3000;
const downloadPath = getDownloadedFilePath();
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
app.get("/booklist", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "bookList.html"));
});

app.get("/testsocket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "testsocket.html"));
});
app.get("/testwebsocket", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "testwebsocket.html"));
});
app.get("/admin", (req, res) => {
  // Read the admin.json file
  const adminData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "public", "admin.json"))
  );

  // Load the admin.html file
  let adminHtml = fs.readFileSync(
    path.join(__dirname, "public", "admin.html"),
    "utf8"
  );
  const index = 0;
  const $ = cheerio.load(adminHtml);

  $("input[name='bookurl']").val(adminData.configurations[index].bookurl);
  $("input[name='elementType']").val(adminData.configurations[index].elementType);
  $("input[name='class']").val(adminData.configurations[index].class);
  $("input[name='headingkey']").val(adminData.configurations[index].headingkey);
  $("input[name='paragraphkey']").val(adminData.configurations[index].paragraphkey);
  $("p[name='data']").text(JSON.stringify(adminData));
  if (adminData.configurations.length > 0) {
    adminData.configurations.forEach(ele => {
      $("select[name='urls']").append(`<option>${ele.bookurl}</option>`);
    });
  }
  // Modify the input values with the data from admin.json

  // Send the updated HTML to the client
  res.send($.html());
});
app.post("/admin", (req, res) => {
  // Read the admin.json file
  const adminData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "public", "admin.json"))
  );
  //search for id
  const index = adminData.configurations.findIndex(config => config.bookurl === req.body.bookurl);
  if (index === -1) {
    //add new
    const config =
      { bookurl: req.body.bookurl, elementType: req.body.elementType, class: req.body.class, headingkey: req.body.headingkey, paragraphkey: req.body.paragraphkey };
    adminData.configurations.push(config);
  } else {
    // Update the data with the form values
    adminData.configurations[index].elementType = req.body.elementType;
    adminData.configurations[index].class = req.body.class;
    adminData.configurations[index].headingkey = req.body.headingkey;
    adminData.configurations[index].paragraphkey = req.body.paragraphkey;
  }


  // Write the updated data back to the admin.json file
  fs.writeFileSync(
    path.join(__dirname, "public", "admin.json"),
    JSON.stringify(adminData)
  );
  // Send the updated HTML to the client
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
app.post("/bookpath", async (req, res) => {
  const { bookpath, bookpathend } = req.body;
  const contents = getUrlStructure(bookpath, bookpathend);
  console.log(contents);
  if (contents.status === "False") {
    res.send("Unable to get the index of bookpath and bookpathend");
    return;
  }
  let resultStr = "";
  for (let index = contents.startIndex; index <= contents.endIndex; index++) {
    const currentUrl = `${contents.startString}${index}${contents.endString}`;
    // Fetch the HTML content of the webpage
    const response = await axios.get(currentUrl);
    const html = response.data;
    // Load the HTML content into Cheerio
    const $ = cheerio.load(html);
    const mainElement = $("main");
    // Extract all h3
    const booknames = mainElement.find("h3");

    booknames.each((k, element) => {
      const bookname = "<H1>" + $(element).text() + "</H1>\n";
      resultStr += bookname;
      if (k % 20 === 0) {
        console.log($(element).text());
      }
    });
  }
  res.send(resultStr);
});
app.post("/download", async (req, res) => {
  // const url = req.body.url;
  // const start = parseInt(req.body.start);
  // const finish = parseInt(req.body.finish);
  const { bookName, url, start, finish, repeat, offset } = req.body;
  const adminData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "public", "admin.json"))
  );
  const indCfg = adminData.configurations.findIndex(ele => url.includes(ele.bookurl));
  if (indCfg === -1) {
    if (processSocket != null) {
      processSocket.emit("chapter", "Error:No setting for this url");
    }
    return;
  }
  fs.mkdir(downloadPath + "/Shelf/" + bookName, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("Folder created successfully");
    }
  });
  try {
    let startLocal = parseInt(start);
    let finishLocal = parseInt(finish);
    const offsetvalue = parseInt(offset);
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
      '<br><a href="#_tableofcontent">文件結束</a>' +
      script +
      "</body></html>\n";
    //get the selection keys
    let selectkey = adminData.configurations[indCfg].elementType;
    if (adminData.configurations[indCfg].class !== "") {
      selectkey = adminData.configurations[indCfg].elementType + "." + adminData.configurations[indCfg].class;
    }


    for (
      let repeatCount = 0;
      repeatCount < repeatLocal && !stopDownload;
      repeatCount++
    ) {
      //handle each chapter
      let missingLink = 0;
      for (
        let index = startLocal;
        index <= finishLocal && !stopDownload;
        index++
      ) {
        const currentUrl = `${url}${index + offsetvalue}.html`;
        // Check the existence of the URL
        try {
          const responseA = await axios.head(currentUrl);
          if (!responseA.status === 200) {
            // URL does not exist, handle the error
            if (processSocket != null) {
              processSocket.emit("chapter", `Error: URL ${currentUrl} does not exist`);
            }
            continue;
          }
        } catch (error) {
          continue;
        }


        // Fetch the HTML content of the webpage
        const response = await axios.get(currentUrl);
        const html = response.data;
        // Load the HTML content into Cheerio
        const $ = cheerio.load(html);
        //extract book content

        const articleElement = $(selectkey);
        if (articleElement.length === 0) {
          //try more attempts
          missingLink++;
          if(missingLink>3){ 
          if (processSocket != null) {
            processSocket.emit("chapter", "No more chapters");
          }
          break;} else {
            continue;
          }

        }
        // Extract all the paragraphs within the article
        const allparagraphs = articleElement.find(adminData.configurations[indCfg].paragraphkey);
        const chaptertitle = articleElement.find(adminData.configurations[indCfg].headingkey);
        const paragraphs = allparagraphs.filter((ind, element) => {
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
          if (smallParagraphs.length > 300) {
            combinedText += "<p>" + smallParagraphs + "</p>\n";
            smallParagraphs = "";
          }
        });
        if (smallParagraphs.length > 0) {
          combinedText += "<p>" + smallParagraphs + "</p>\n";
        }
      }
      //reading chapter finish
      const fileName = `${bookName}_${startLocal}-${finishLocal}.html`;
      const filePath = downloadPath + "Shelf/" + bookName + "/" + fileName;
      if (combinedText.length === 0) {
        if (processSocket != null) {
          processSocket.emit("chapter", "Empty content");
        }
        tableOfContent = "";
        startLocal = finishLocal + 1;
        finishLocal = startLocal + diff;
        continue;
      }
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
    if (processSocket != null) {
      processSocket.emit("chapter", "Download completed");
    }
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

function getDownloadedFilePath() {
  if (process.platform === "win32") {
    return "C:/Users/User/Dropbox/books/";
  } else if (process.platform === "linux") {
    return "/home/chlai/Downloads/TextTool/";
  } else if (process.platform === "darwin") {
    return "/Users/chlai/Dropbox/books/";
  }
}

function getUrlStructure(string1, string2) {
  const regex = /\d+/g;
  const match1 = string1.match(regex);
  const match2 = string2.match(regex);
  if (!match1 || !match2 || match1.length !== match2.length) {
    return { status: "False" };
  }
  //get the index of different element
  const indexes = [];
  for (let i = 0; i < match1.length; i++) {
    if (match1[i] !== match2[i]) {
      indexes.push(i);
    }
  }
  //check ambiguous
  if (indexes.length > 1) {
    return { status: "False" };
  }
  //get the first part of string
  let startIndex = 0;
  //[0,4,2,0,1] , [0,4,2,0,117]
  for (let i = 0; i <= indexes[0]; i++) {
    startIndex =
      string1.indexOf(match1[i], startIndex) + match1[i].toString().length;
  }
  //part 2
  const endString = string1.substring(startIndex);
  const startString = string1.substring(
    0,
    startIndex - match1[indexes[0]].toString().length
  );
  return {
    status: "True",
    startString,
    endString,
    startIndex: parseInt(match1[indexes[0]]),
    endIndex: parseInt(match2[indexes[0]]),
  };
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
