// Import required modules
const express = require("express");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const started = require("electron-squirrel-startup");

// Import your Express controller
const processFile = require("./controller/fileController.js");

if (started) {
  app.quit();
}

// Initialize Express app
const expressApp = express();
const PORT = 4000;

// Use Express to handle routes
expressApp.get("/process", processFile);

// Start Express server in the background
expressApp.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});

const createWindow = () => {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Set up preload.js for the renderer process
    },
  });

  // Load the local index.html file
  mainWindow.loadFile(path.join(__dirname, "index.html")); // Electron will open Express URL
  mainWindow.setMenu(null);
  // Open DevTools if needed
  // mainWindow.webContents.openDevTools();
};

// Electron's initialization logic
app.whenReady().then(() => {
  createWindow();

  // On macOS, recreate window when clicking the dock icon if no window is open
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit the application when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
