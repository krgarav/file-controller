const processCSV = require("../server.js");

const processFile = async (req, res) => {
  try {
    // Assuming processCSV() is a function that processes the CSV file
    const result = await processCSV();

    // Respond with a success message
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.log(error);
    // Catch errors and send a response with a failure message
    return res.status(500).json({
      success: false,
      message: "Error processing file",
      error: error.message,
    });
  }
};

module.exports = processFile;
