import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Custom API Route: Persistent Asset Upload
  app.post("/api/upload-asset", express.raw({ type: "*/*", limit: "150mb" }), (req, res) => {
    const fileName = req.headers["x-file-name"] as string;
    if (!fileName) {
      console.warn("[Server]: Missing x-file-name header on upload request");
      return res.status(400).json({ error: "Missing x-file-name header" });
    }

    console.log(`[Server]: Received persistent upload request for asset: ${fileName}`);

    // Determine target location in workspace based on standard file names
    let targetPath = "";
    if (fileName === "warriorTest.glb" || fileName === "mech_frame.glb") {
      targetPath = path.join(process.cwd(), "public", "assets", "models", "mechs", fileName);
    } else if (fileName === "enviroTest.glb" || fileName === "bog_enviro.glb") {
      targetPath = path.join(process.cwd(), "public", "assets", "tiles", fileName);
    } else {
      console.warn(`[Server]: Unrecognized or restricted file upload target: ${fileName}`);
      return res.status(400).json({ error: "Invalid or restricted asset filename for direct workspace sync." });
    }

    try {
      // Ensure target directories exist on workspace
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write raw binary content directly to the file
      fs.writeFileSync(targetPath, req.body);
      console.log(`[Server]: Successfully saved and persisted asset at: ${targetPath}`);
      return res.json({ success: true, path: targetPath });
    } catch (error: any) {
      console.error(`[Server]: Failed to save asset ${fileName}:`, error);
      return res.status(500).json({ error: error.message || "Failed to write asset file." });
    }
  });

  // API Status health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite development middleware vs Static Production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server]: Game engine dynamic server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
