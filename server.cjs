var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.post("/api/upload-asset", import_express.default.raw({ type: "*/*", limit: "150mb" }), (req, res) => {
    const fileName = req.headers["x-file-name"];
    if (!fileName) {
      console.warn("[Server]: Missing x-file-name header on upload request");
      return res.status(400).json({ error: "Missing x-file-name header" });
    }
    console.log(`[Server]: Received persistent upload request for asset: ${fileName}`);
    let targetPath = "";
    if (fileName === "warriorTest.glb" || fileName === "mech_frame.glb") {
      targetPath = import_path.default.join(process.cwd(), "public", "assets", "models", "mechs", fileName);
    } else if (fileName === "enviroTest.glb" || fileName === "bog_enviro.glb") {
      targetPath = import_path.default.join(process.cwd(), "public", "assets", "tiles", fileName);
    } else {
      console.warn(`[Server]: Unrecognized or restricted file upload target: ${fileName}`);
      return res.status(400).json({ error: "Invalid or restricted asset filename for direct workspace sync." });
    }
    try {
      const dir = import_path.default.dirname(targetPath);
      if (!import_fs.default.existsSync(dir)) {
        import_fs.default.mkdirSync(dir, { recursive: true });
      }
      import_fs.default.writeFileSync(targetPath, req.body);
      console.log(`[Server]: Successfully saved and persisted asset at: ${targetPath}`);
      return res.json({ success: true, path: targetPath });
    } catch (error) {
      console.error(`[Server]: Failed to save asset ${fileName}:`, error);
      return res.status(500).json({ error: error.message || "Failed to write asset file." });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  if (process.env.NODE_ENV !== "production") {
    app.use(import_express.default.static(import_path.default.join(process.cwd(), "public")));
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server]: Game engine dynamic server running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
