import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Required for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const Data_File = path.join(__dirname, "data", "links.json");

const loadLinks = async () => {
  try {
    const data = await readFile(Data_File, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(Data_File, JSON.stringify({}));
      return {};
    }
    throw error;
  }
};

const saveLinks = async (links) => {
  await writeFile(Data_File, JSON.stringify(links, null, 2));
};

const server = createServer(async (req, res) => {
  const url = req.url;
  const method = req.method;

  if (method === "GET") {
    if (url === "/") {
      try {
        const data = await readFile(path.join(__dirname, "public", "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      } catch {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("404 Page Not Found");
      }
    } else if (url === "/style.css") {
      try {
        const data = await readFile(path.join(__dirname, "public", "style.css"));
        res.writeHead(200, { "Content-Type": "text/css" });
        res.end(data);
      } catch {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("404 Page Not Found");
      }
    } else if (url === "/links") {
      const links = await loadLinks();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(links));
    } else {
      // Attempt redirect
      const links = await loadLinks();
      const code = url.slice(1); // remove leading "/"
      if (links[code]) {
        res.writeHead(302, { Location: links[code] });
        return res.end();
      }
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("Short Link Not Found");
    }
  }

  else if (method === "POST" && url === "/shorten") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { url, shortCode } = JSON.parse(body);
        if (!url) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("URL is required");
        }

        const links = await loadLinks();
        const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

        if (links[finalShortCode]) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short Code already exists. Choose another.");
        }

        links[finalShortCode] = url;
        await saveLinks(links);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Server Error");
      }
    });
  }
else if (method === "DELETE" && url.startsWith("/delete/")) {
  const shortCode = url.split("/delete/")[1];
  const links = await loadLinks();

  if (!links[shortCode]) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Short link not found");
  }

  delete links[shortCode];
  await saveLinks(links);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: true }));
}

  else {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
  }
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
