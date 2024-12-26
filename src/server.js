const fs = require("fs-extra");
const xmlbuilder = require("xmlbuilder");
const archiver = require("archiver");
const csv = require("csv-parser");
const path = require("path");
const crypto = require("crypto");
const mime = require("mime-types");

const metadataFile = "files/Data.csv"; // Path to your metadata CSV file
const bitstreamsDir = "files/"; // Directory containing the uploaded digital files (e.g., images)
const outputDir = "archives/"; // SAF structure output directory
const outputZip = "dspace_archive.zip"; // Final zip file
const csvDir = "CSVDdir/";

async function processCSV() {
  // Check if the metadata file exists
  if (!fs.existsSync(metadataFile)) {
    throw new Error(`Metadata file not present`);
  }
  await fs.ensureDir(csvDir);
  await fs.ensureDir(bitstreamsDir);
  // Ensure the output directory is clean
  await fs.remove(outputDir);
  await fs.ensureDir(outputDir);

  const transformedData = [];
  const contentsData = [];
  // Read and process the CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(metadataFile)
      .pipe(csv())
      .on("data", (row) => {
        const transformedItem = {};
        for (const key in row) {
          if (key === "Path") {
            // Extract the base name of the file
            const fileName = path.basename(row[key]);
            transformedItem["dc.file_name"] = fileName; // Save only the file name
            delete row["Path"];
          } else {
            transformedItem[`dc.${key}`] = row[key];
          }
        }
        transformedData.push(transformedItem);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  // Process each row and create required files/directories
  const tasks = transformedData.map(async (row, index) => {
    console.log(row, index);
    const itemDir = `${outputDir}/${row["item_id"] || `item_${index + 1}`}`;
    await fs.ensureDir(itemDir);

    // Create dublin_core.xml with the transformed metadata
    const metadata = [];
    for (const key in row) {
      if (key.startsWith("dc.")) {
        const element = key.split(".")[1]; // Get the part after 'dc.'
        metadata.push({
          element,
          value: row[key],
        });
      }
    }

    const dublinCoreFilePath = `${itemDir}/dublin_core.xml`;
    await createDublinCoreXML(metadata, row, itemDir); // Include metadata and bitstream data

    const bitstreamPath = `${bitstreamsDir}/${row["dc.file_name"]}`;
    if (fs.existsSync(bitstreamPath)) {
      const itemBitstreamPath = `${itemDir}/${row["dc.file_name"]}`;
      await fs.copy(bitstreamPath, itemBitstreamPath);
      const fileSize = getFileSize(itemBitstreamPath);
      const checksum = calculateChecksum(itemBitstreamPath);
      const mimeType =
        mime.lookup(itemBitstreamPath) || "application/octet-stream";

      contentsData.push(`${row["dc.file_name"]}`);
      // contentsData.push(`${mimeType}`);
      // contentsData.push(`${fileSize}`);
      // contentsData.push(`${checksum}`);
      contentsData.push(""); // Blank line to separate entries

      const contentsFilePath = `${itemDir}/contents`;
      fs.writeFileSync(contentsFilePath, contentsData.join("\n"), "utf8");
      contentsData.length = 0;
    } else {
      console.error(`File not found: ${bitstreamPath}`);
    }
  });

  // Wait for all tasks to complete
  await Promise.all(tasks);

  // Save the transformed data to a new CSV file in the specified csvDir
  const outputCSVPath = path.join(csvDir, "transformed_data.csv");
  const writeStream = fs.createWriteStream(outputCSVPath);
  const keys = Object.keys(transformedData[0]);

  // Write the CSV headers
  writeStream.write(keys.join(",") + "\n");

  // Write the rows
  transformedData.forEach((row) => {
    const rowValues = keys.map((key) => row[key]);
    writeStream.write(rowValues.join(",") + "\n");
  });

  writeStream.end();

  // Create the zip file
  await createZip(outputDir, outputZip);

  console.log("Processing complete and zip file created.");
}

// Generate dublin_core.xml with metadata and bitstream data and output it to a specified directory
function createDublinCoreXML(metadata, row, itemDir) {
  // Define the path for the Dublin Core XML file
  const outputFile = path.join(itemDir, "dublin_core.xml");

  // Create the XML document
  const xml = xmlbuilder.create("dublin_core", { encoding: "UTF-8" });
  xml.att("schema", "dc");

  // Add metadata elements to the XML
  metadata.forEach(({ element, value }) => {
    if (value) {
      const dcValue = xml.ele("dcvalue", { element });
      dcValue.txt(value);
    }
  });

  // Add bitstream information
  const bitstreamsElement = xml.ele("bitstreams");
  const bitstreamElement = bitstreamsElement.ele("bitstream");
  bitstreamElement.ele("name", {}, row["dc.file_name"]);
  bitstreamElement.ele(
    "mime_type",
    {},
    row["dc.mime_type"] || "application/octet-stream"
  );
  bitstreamElement.ele("size", {}, row["dc.file_size"] || "0");
  bitstreamElement.ele("checksum", {}, row["dc.checksum"] || "no-checksum");
  bitstreamElement.ele("format", {}, "File Format");

  // Write the generated XML to the output file
  fs.writeFileSync(outputFile, xml.end({ pretty: true }));
}

// Function to calculate the checksum (MD5) of a file
function calculateChecksum(filePath) {
  const hash = crypto.createHash("md5");
  const fileBuffer = fs.readFileSync(filePath);
  hash.update(fileBuffer);
  return hash.digest("hex");
}

// Function to get the file size in bytes
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

// Create a zip file from the SAF directory
function createZip(sourceDir, zipFile) {
  const output = fs.createWriteStream(zipFile);
  const archive = archiver("zip");

  output.on("close", () => {
    console.log(`Zip file created: ${zipFile} (${archive.pointer()} bytes)`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);
  archive.finalize();
}

module.exports = processCSV;
