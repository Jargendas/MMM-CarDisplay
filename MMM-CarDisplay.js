const kmPerMile = 1.60934;

Module.register("MMM-CarDisplay", {
  defaults: {
    artwork: "",
    refresh: 1,
    vehicleOpacity: 0.75,
    useUSUnits: false,
    showMileage: true,
    showElectricPercentage: true,
    showElectricRange: true,
    showFuelRange: true,
    showLastUpdated: true,
    lastUpdatedText: "last updated",
    hassAPIKey: ""
  },

  getStyles: function () {
    return ["MMM-CarDisplay.css"];
  },

  getScripts: function () {
    return ["moment.js"];
  },

  uuidv4: function() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    if (!("requestUrl" in this.config))
      console.error("Please set a requestUrl for MMM-CarDisplay!");

    this.instanceId = this.uuidv4();
    this.carInfo = {};
    this.getInfo();
    var self = this;
    this.updateTimer = setInterval(function(){self.getInfo()}, this.config.refresh * 60 * 1000);
    this.refreshTimer = setInterval(function(){self.updateDom(0)}, 30000); // Update DOM more often for "last updated" field to refresh.
  },

  getInfo: function () {
    this.sendSocketNotification("MMM-CARDISPLAY-REQUEST", {
      instanceId: this.instanceId,
      requestUrl: this.config.requestUrl,
      hassAPIKey: this.config.hassAPIKey
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (
      notification === "MMM-CARDISPLAY-RESPONSE" &&
      Object.keys(payload).length > 0 &&
      payload["instanceId"] == this.instanceId
    ) {
      this.carInfo = payload;
      if (this.config.useUSUnits) {
          this.carInfo.mileage = Math.round(this.carInfo.mileage/kmPerMile);
          this.carInfo.electricRange = Math.round(this.carInfo.electricRange/kmPerMile);
          this.carInfo.fuelRange = Math.round(this.carInfo.fuelRange/kmPerMile);
      }
      this.updateDom(100);
    }
  },

  faIconFactory: function (icon) {
    var faIcon = document.createElement("i");
    faIcon.classList.add("fas");
    faIcon.classList.add(icon);
    return faIcon;
  },

  getDom: function () {
    var wrapper = document.createElement("div");
	  wrapper.classList.add("car-wrapper");

    if (!("requestUrl" in this.config) && (this.config.requestUrl === "")) {
      wrapper.innerHTML = "Missing configuration.";
      return wrapper;
    }

    if (Object.keys(this.carInfo).length === 0) {
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!!this.carInfo.error) {
	    wrapper.innerHTML = this.carInfo.error;
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    let info = this.carInfo;

    var carContainer = document.createElement("div");
    carContainer.classList.add("car-container");

    var imageContainer = document.createElement("span");
    var imageObject = document.createElement("img");
    imageObject.setAttribute('src', "/modules/MMM-CarDisplay/"+this.config.artwork);
    imageObject.setAttribute('style', 'opacity: ' + this.config.vehicleOpacity + ';');
    imageContainer.appendChild(imageObject);
    carContainer.appendChild(imageContainer);
    
    wrapper.appendChild(carContainer);

    carContainer = document.createElement("div");
    carContainer.classList.add("car-container");

    var battery = document.createElement("span");
    battery.classList.add("battery");
    
    if (this.config.showElectricPercentage  && ("electric_range" in info)) {
      var plugged = document.createElement("span");
      plugged.classList.add("plugged");

      if ("connector_status" in info) {
        if (info.connector_status) {
          plugged.appendChild(this.faIconFactory("fa-bolt"));
        } else {
          //plugged.appendChild(this.faIconFactory("fa-plug"));
          plugged.appendChild(document.createTextNode("\u00a0"));
        }
      }
      battery.appendChild(plugged);

      switch (true) {
        case (info.state_of_charge < 25):
          battery.appendChild(this.faIconFactory("fa-battery-empty"));
          break;
        case (info.state_of_charge < 50):
          battery.appendChild(this.faIconFactory("fa-battery-quarter"));
          break;
        case (info.state_of_charge < 75):
          battery.appendChild(this.faIconFactory("fa-battery-half"));
          break;
        case (info.state_of_charge < 100):
          battery.appendChild(this.faIconFactory("fa-battery-three-quarters"));
          break;
        default:
          battery.appendChild(this.faIconFactory("fa-battery-full"));
          break;
      }

      battery.appendChild(document.createTextNode(info.state_of_charge + " %"));
    } else {
      battery.appendChild(document.createTextNode("⠀")); // For spacing
    }
    carContainer.appendChild(battery);
    wrapper.appendChild(carContainer);

    var mileage = document.createElement("span");
    mileage.classList.add("mileage");
    if (this.config.showMileage && ("mileage" in info)) {
      mileage.appendChild(this.faIconFactory("fa-road"));
      mileage.appendChild(document.createTextNode(info.mileage + (this.config.useUSUnits ? ' mi' : ' km')));
    } else {
      mileage.appendChild(document.createTextNode("\u00a0"));
    }
    carContainer.appendChild(mileage);
    wrapper.appendChild(carContainer);

    carContainer = document.createElement("div");
    carContainer.classList.add("car-container");

    var elecRange = document.createElement("span");
    elecRange.classList.add("elecRange");
    if (this.config.showElectricRange && ("electric_range" in info)) {
      elecRange.appendChild(this.faIconFactory("fa-charging-station"));
      elecRange.appendChild(document.createTextNode(info.electric_range + (this.config.useUSUnits ? ' mi' : ' km')));
    } else {
      elecRange.appendChild(document.createTextNode("\u00a0"));
    }
    carContainer.appendChild(elecRange);
    wrapper.appendChild(carContainer);

    carContainer = document.createElement("div");
    carContainer.classList.add("car-container");
    carContainer.classList.add("spacer");
    wrapper.appendChild(carContainer);

    carContainer = document.createElement("div");
    carContainer.classList.add("car-container");

    var locked = document.createElement("span");
    locked.classList.add("locked");
    if ("door_lock" in info) {
      if (!info.door_lock) {
        locked.appendChild(this.faIconFactory("fa-lock"));
      } else {
        locked.appendChild(this.faIconFactory("fa-lock-open"));
      }
    }
    carContainer.appendChild(locked);
    
    var fuelRange = document.createElement("span");
    fuelRange.classList.add("fuelRange");
    if ((this.config.showFuelRange) && ("fuel_range" in info)) {
      fuelRange.appendChild(this.faIconFactory("fa-gas-pump"));
      fuelRange.appendChild(document.createTextNode(info.fuel_range + (this.config.useUSUnits ? ' mi' : ' km')));
    } else {
      fuelRange.appendChild(document.createTextNode("\u00a0"));
    }
    carContainer.appendChild(fuelRange);
    wrapper.appendChild(carContainer);
    
    carContainer = document.createElement("div");
    carContainer.classList.add("car-container");
    carContainer.classList.add("updated");
    
    var updated = document.createElement("span");
    updated.classList.add("updated");
    if (this.config.showLastUpdated && ("update_time" in info)) {
      updated.appendChild(this.faIconFactory("fa-info"));
      var lastUpdateText = this.config.lastUpdatedText + " " + moment(info.update_time).fromNow();
    } else {
      lastUpdateText = "";
    }
    updated.appendChild(document.createTextNode(lastUpdateText));
    carContainer.appendChild(updated);
    wrapper.appendChild(carContainer);
    
    return wrapper;
  }
});
