var NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.join(__dirname, "cache");
const IMAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const IMAGE_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};

module.exports = NodeHelper.create({

  start: function () {
    console.log("Starting node_helper for module: " + this.name);
  },

  socketNotificationReceived: async function (notification, payload) {

    var self = this;

    if (notification == "MMM-CARDISPLAY-REQUEST") {
      console.log('MMM-CarDisplay: Updating data for ' + payload.requestUrl);

      this.requestData(payload.instanceId, payload.requestUrl, payload.hassAPIKey, payload.downloadImage);
    }
  },

  requestData: async function(instanceId, requestUrl, hassAPIKey, downloadImage) {
    try {
      const response = await fetch(requestUrl, {
        headers: {
          "Authorization": `Bearer ${hassAPIKey}`
        }
      });
      const jsonData = await response.text();
      var data = JSON.parse(jsonData);
      console.debug(data);
      data.instanceId = instanceId;
      if (downloadImage && typeof data.image === "string" && data.image !== "") {
        const imageFile = await this.downloadImage(requestUrl, data.image, hassAPIKey);
        if (imageFile) {
          data.imageFile = imageFile;
        }
      }
      this.sendSocketNotification('MMM-CARDISPLAY-RESPONSE', data);
    } catch (error) {
      console.error("Could not fetch data!");
      console.error(error);
    }
  },

  findCachedImage: function(prefix) {
    if (!fs.existsSync(CACHE_DIR)) return null;
    return fs.readdirSync(CACHE_DIR).find((f) => f.startsWith(prefix + ".")) || null;
  },

  // Downloads the vehicle image into the module's cache directory and returns its filename.
  // Falls back to a previously downloaded file if the download fails.
  downloadImage: async function(requestUrl, imagePath, hassAPIKey) {
    const imageUrl = new URL(imagePath, requestUrl);
    const prefix = "vehicle_" + crypto.createHash("sha1").update(imageUrl.href).digest("hex").slice(0, 12);
    const cached = this.findCachedImage(prefix);

    if (cached && Date.now() - fs.statSync(path.join(CACHE_DIR, cached)).mtimeMs < IMAGE_MAX_AGE_MS) {
      return cached;
    }

    try {
      console.log("MMM-CarDisplay: Downloading vehicle image from " + imageUrl.href);
      // Only send the token to the same host the data is requested from.
      const headers = imageUrl.origin === new URL(requestUrl).origin
        ? { "Authorization": `Bearer ${hassAPIKey}` }
        : {};
      const response = await fetch(imageUrl, { headers: headers });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const extension = IMAGE_EXTENSIONS[contentType];
      if (!extension) {
        throw new Error("Unsupported content type: " + contentType);
      }
      const buffer = Buffer.from(await response.arrayBuffer());

      fs.mkdirSync(CACHE_DIR, { recursive: true });
      const fileName = prefix + "." + extension;
      fs.writeFileSync(path.join(CACHE_DIR, fileName), buffer);
      if (cached && cached !== fileName) {
        fs.unlinkSync(path.join(CACHE_DIR, cached));
      }
      return fileName;
    } catch (error) {
      console.error("Could not download vehicle image!");
      console.error(error);
      return cached;
    }
  }

});
