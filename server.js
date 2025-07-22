// server.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(morgan("combined"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function isValidUrl(string) {
  try {
    const parsed = new URL(string);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (_) {
    return false;
  }
}

app.use("/:target(*)", async (req, res) => {
  try {
    const targetUrl = req.params.target;

    console.log(`Received request for target URL: ${targetUrl}`);

    if (!isValidUrl(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const axiosConfig = {
      method: req.method,
      url: targetUrl,
      headers: { ...req.headers },
      headers: Object.keys(req.headers).reduce((acc, key) => {
        if (key.toLowerCase() !== "host") {
          acc[key] = req.headers[key];
        }
        return acc;
      }, {}),
      params: req.query,
      data: req.body,
      responseType: "stream",
      validateStatus: () => true,
    };

    const response = await axios(axiosConfig);

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    res.set(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );

    Object.entries(response.headers).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (!['transfer-encoding', 'content-length', 'connection'].includes(lower)) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);

    const isJson = (response.headers['content-type'] || '').includes('application/json');
    if (isJson) {
      let data = '';
      response.data.on('data', chunk => {
        data += chunk;
      });
      response.data.on('end', () => {
        res.send(data);
      });
      response.data.on('error', err => {
        res.status(500).json({ error: 'Proxy stream error' });
      });
    } else {
      response.data.pipe(res);
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

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

app.listen(PORT, () => {
  console.log(`CORS Proxy is running at http://localhost:${PORT}/`);
});
