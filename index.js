const { BrowserWindow, app, Menu } = require("electron");

// require("./api.js");

require("dotenv").config();
const bodyParser = require("body-parser");
const express = require("express");
const sqlite3 = require("sqlite3");
const frontend = express();
const crypto = require("crypto");

const cors = require("cors");
const path = require("path");
process.env.TZ = "Asia/Kolkata";
const dotenv = require("dotenv");
dotenv.config({ path: ".env" });
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=1500000");

const appExpress = express();
appExpress.use(express.json({ limit: "100mb" }));
appExpress.use(express.urlencoded({ extended: true, limit: "100mb" }));
appExpress.use(bodyParser.json({ limit: "100mb" }));
appExpress.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
appExpress.use(express.json());
appExpress.use(
  express.urlencoded({
    extended: true,
  })
);

const frontendPort = 5001;
const serverPort = 3001;

frontend.use(express.static(path.join(__dirname, "build")));

frontend.listen(frontendPort, function () {
  console.log(`frontend is running on port ${frontendPort}`);
});

frontend.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

appExpress.use(express.static("public"));
// // Try with a larger limit
// appExpress.use(express.json({ limit: "50mb" })); // Increase the limit
// appExpress.use(
//   express.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 })
// );
// appExpress.use(cors());

appExpress.use(cors());

let sql;

const db = new sqlite3.Database("./ssf.db");

const { createServer } = require("http");

///////////////////////////////

function createEncryptText(key) {
  return function encryptText(text) {
    if (!text) return null;
    const algorithm = "aes-256-cbc";
    const keyBuffer = Buffer.alloc(32);
    keyBuffer.write(key, 0, Math.min(key.length, keyBuffer.length), "utf-8");
    const iv = Buffer.from(fixedIv, "utf-8");
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  };
}

function createDecryptText(key) {
  return function decryptText(encryptedText) {
    if (!encryptedText) return null;
    const algorithm = "aes-256-cbc";
    const keyBuffer = Buffer.alloc(32);
    keyBuffer.write(key, 0, Math.min(key.length, keyBuffer.length), "utf-8");
    const iv = Buffer.from(fixedIv, "utf-8");
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  };
}

const fixedIv = "1234567890abcdef";
const decryptKey = "abcde";
// const decryptKey = "abcde";

const encryptionKey = "mgtysm"; // Example key, can be changed as needed
const encryptText = createEncryptText(encryptionKey);
const decryptText = createDecryptText(encryptionKey);

appExpress.post("/addPlan", (req, res) => {
  console.log("addPlan");
  try {
    const planData = req.body;

    // Encrypt sensitive data
    const encryptedPlanName = encryptText(planData.plan_name);
    const encryptedDescription = encryptText(planData.description);

    const sql = `
      INSERT INTO tbl_course (plan_name, duration, fees, description, created_at)
      VALUES (?, ?, ?, ?, ?)`;

    const values = [
      encryptedPlanName,
      planData.duration,
      planData.fees,
      encryptedDescription,
      new Date().toISOString(),
    ];

    db.run(sql, values, function (err) {
      if (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        console.log("New plan added");
        res.json({ error: false, message: "Plan added successfully" });
      }
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

appExpress.get("/viewAllPlan", (req, res) => {
  try {
    const sql = "SELECT * FROM tbl_course";

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Error fetching plans:", err);
        // Send an appropriate error response with status code 500
        return res.status(500).json({
          error: true,
          message: "Internal Server Error",
          data: null,
        });
      }

      // Decrypt sensitive fields if necessary
      const decryptedRows = rows.map((row) => ({
        ...row,
        plan_name: decryptText(row.plan_name),
        description: decryptText(row.description),
      }));

      // Send success response
      res.json({
        error: false,
        message: "Plans fetched successfully",
        data: decryptedRows,
      });
    });
  } catch (error) {
    console.error("Error:", error);
    // Send a generic error response if an exception is caught
    res.status(500).json({
      error: true,
      message: "Internal Server Error",
      data: null,
    });
  }
});

appExpress.post("/deletePlan/:id", (req, res) => {
  try {
    const planId = req.params.id;
    console.log("planid==", planId);

    sql = "DELETE FROM tbl_course WHERE id = ?";
    db.run(sql, [planId], (err) => {
      if (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        res.json({ error: false, message: "plan deleted successfully" });
      }
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

let mainWindow = null;

function startServer() {
  const frontend = express();

  // Serve static files from the build directory
  frontend.use(express.static(path.join(__dirname, "build")));

  const server = createServer(frontend);

  // server.listen(frontendPort, () => {
  //   console.log(`frontend is running on port ${frontendPort}`);
  // });

  return server;
}

function main() {
  const server = startServer();

  mainWindow = new BrowserWindow();

  // Load the URL served by the Express server
  mainWindow.loadURL(`http://localhost:${frontendPort}/`);
  Menu.setApplicationMenu(null);

  // Menu.setApplicationMenu(null);

  mainWindow.webContents.openDevTools();

  // hddserial.first((err, serial) => {
  //   if (err) {
  //     console.error("Error retrieving hard disk serial number:", err);
  //   } else {
  //     console.log("Hard disk serial number:", serial);
  //   }
  // });

  // getAndEncryptSerial();

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Close the Express server when the Electron window is closed
    server.close();
  });

  mainWindow.webContents.on(
    "new-window",
    (event, url, frameName, disposition, options, additionalFeatures) => {
      // Open developer tools in child window
      options.webContents.openDevTools();
    }
  );
}

appExpress.listen(serverPort, () => {
  console.log(`Server is running on port ${serverPort}`);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("ready", main);

app.on("ready", () => {
  process.env.ELECTRON_DISABLE_SECURITY_SANDBOX = "true";
  app.commandLine.appendSwitch("--disable-web-security");
});
