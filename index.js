const { BrowserWindow, app, Menu, ipcMain } = require("electron");

// require("./api.js");

require("dotenv").config();
const bodyParser = require("body-parser");
const express = require("express");
const sqlite3 = require("sqlite3");
const frontend = express();
const simpleGit = require("simple-git");
const isOnline = require("is-online");

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

//////////////////////////

const repositoryURL =
  "https://github.com/Shefali-Dhanvij/git@github.com:Shefali-Dhanvij/electron-updater.git";

// Set up Git to pull updates
const git = simpleGit({
  baseDir: __dirname,
  binary: "git",
  maxConcurrentProcesses: 6,
});

async function ensureRepository() {
  try {
    const repoStatus = await git.checkIsRepo();
    if (!repoStatus) {
      console.log("Repository not found locally. Cloning...");
      await git.clone(repositoryURL, __dirname);
      console.log("Repository cloned successfully.");
    } else {
      console.log("Repository found locally.");
    }
  } catch (error) {
    console.error("Error ensuring repository:", error);
  }
}

async function checkForUpdates() {
  try {
    const status = await git.fetch();
    if (status.behind > 0) {
      const latestCommit = await git.log(["-1"]);
      mainWindow.webContents.send("update-available", latestCommit.latest.hash);
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
}

async function pullLatestCode() {
  try {
    await git.pull("origin", "main");
    mainWindow.webContents.send("update-complete");
    app.relaunch();
    app.quit();
  } catch (error) {
    console.error("Error pulling latest code:", error);
  }
}

setInterval(async () => {
  if (await isOnline()) {
    await ensureRepository();
    checkForUpdates();
  }
}, 60000);

ipcMain.on("confirm-update", async () => {
  await pullLatestCode();
});

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
