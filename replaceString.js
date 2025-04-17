const fs = require("fs");
const path = require("path");

// Define the folder path and the string to replace
const folderPath = "/Users/chlai/Dropbox/books/Shelf/權色官途"; // Replace with your folder path
const stringToReplace = "~~~飄逸的《都市第一混》《瀟雨驚龍》很有看點，你看了沒~~~"; // Replace with the string you want to remove

// Get all files in the folder
fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error("Error reading folder:", err);
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(folderPath, file);

    // Check if it's a file (not a directory)
    if (fs.lstatSync(filePath).isFile()) {
      // Read the file content
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
          console.error(`Error reading file ${file}:`, err);
          return;
        }

        // Replace all occurrences of the string
        if(data.indexOf("~~~")>=0){
        // const updatedData = data.replace(new RegExp(stringToReplace, "g"), "");
        const updatedData = data.replace(/~~~飄逸的.*?沒~~~/gs, "");

        // Write the updated content back to the file
        fs.writeFile(filePath, updatedData, "utf8", (err) => {
          if (err) {
            console.error(`Error writing file ${file}:`, err);
          } else {
            console.log(`Updated file: ${file}`);
          }
        });
        
           
        }
        
      });
    }
  });
});