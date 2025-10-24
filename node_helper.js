var NodeHelper = require("node_helper");
const spawn = require("child_process").spawn;

module.exports = NodeHelper.create({

  start: function () {
    console.log("Starting node_helper for module: " + this.name);
  },

  socketNotificationReceived: async function (notification, payload) {

    var self = this;

    if (notification == "MMM-CARDISPLAY-REQUEST") {
      console.log('MMM-CarDisplay: Updating data for ' + payload.requestUrl);

      this.requestData(payload.instanceId, payload.requestUrl, payload.hassAPIKey);
    }
  },

  requestData: async function(instanceId, requestUrl, hassAPIKey) {
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
      this.sendSocketNotification('MMM-CARDISPLAY-RESPONSE', data);
    } catch (error) {
      console.error("Could not fetch data!");
      console.error(error);
    }
  }

});
