// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(morgan("combined"));
app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Helper function to validate URLs
function isValidUrl(string) {
  try {
    const parsed = new URL(string);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
}

// Route handler using route parameter with wildcard
app.use("/:target(*)", async (req, res) => {
  try {
    // Extract the target URL from the route parameter
    const targetUrl = req.params.target;

    console.log(`Received request for target URL: ${targetUrl}`); // Logging

    if (!isValidUrl(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    // Prepare the axios request configuration
    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers },
      // Remove 'host' header to avoid conflicts
      // It's safer to delete it directly here
      // as transformRequest is not intended for this purpose
      // Ensure that the 'host' header is not sent to the target server
      // Note: Axios sets the 'host' header automatically based on the URL
      // So manually deleting it may not be necessary
      // However, if you need to remove it, do it here:
      // We'll create a new headers object without the 'host' header
      // to avoid mutating the original headers
      // This ensures cleaner and safer header management
      headers: Object.keys(req.headers).reduce((acc, key) => {
        if (key.toLowerCase() !== "host") {
          acc[key] = req.headers[key];
        }
        return acc;
      }, {}),
      // Include query parameters
      params: req.query,
      // Handle request body for applicable methods
      data: req.body,
      responseType: "stream",
      validateStatus: () => true, // Allow handling of all status codes
    };

    // Make the request to the target URL
    const response = await axios(axiosConfig);

    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    res.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );

    // Forward response headers (optional, can be customized)
    // It's better to selectively forward headers to prevent issues
    // Here, we'll exclude 'transfer-encoding' to avoid conflicts
    Object.entries(response.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    // Pipe the response data
    response.data.pipe(res);
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

// Handle preflight requests
app.options("/:target(*)", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.set(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.status(204).send("");
});

// Start the server
app.listen(PORT, () => {
  console.log(`CORS Proxy is running at http://localhost:${PORT}/`);
});
