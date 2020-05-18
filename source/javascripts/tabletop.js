(function (global) {
  "use strict";

  var inNodeJS = false;
  if (typeof module !== "undefined" && module.exports) {
    inNodeJS = true;
    var request = require("request");
  }

  var supportsCORS = false;
  var inLegacyIE = false;
  try {
    var testXHR = new XMLHttpRequest();
    if (typeof testXHR.withCredentials !== "undefined") {
      supportsCORS = true;
    } else {
      if ("XDomainRequest" in window) {
        supportsCORS = true;
        inLegacyIE = true;
      }
    }
  } catch (e) {}

  // Create a simple indexOf function for support
  // of older browsers.  Uses native indexOf if
  // available.  Code similar to underscores.
  // By making a separate function, instead of adding
  // to the prototype, we will not break bad for loops
  // in older browsers
  var indexOfProto = Array.prototype.indexOf;
  var ttIndexOf = function (array, item) {
    var i = 0,
      l = array.length;

    if (indexOfProto && array.indexOf === indexOfProto)
      return array.indexOf(item);
    for (; i < l; i++) if (array[i] === item) return i;
    return -1;
  };

  /*
    Initialize with Tabletop.init( { key: '0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc' } )
      OR!
    Initialize with Tabletop.init( { key: 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key=0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc&output=html&widget=true' } )
      OR!
    Initialize with Tabletop.init('0AjAPaAU9MeLFdHUxTlJiVVRYNGRJQnRmSnQwTlpoUXc')
  */

  var Tabletop = function (options) {
    this.rateLimit = 0; // init an int at 0 to use as a counter for send xhr request... avoid 429 Too Many Requests status from google
    // Make sure Tabletop is being used as a constructor no matter what.
    //console.log("TABLETOP FUNCTION CREATED");
    console.log("4.", this)
    if (!this || !(this instanceof Tabletop)) {
      return new Tabletop(options);
    }

    //console.log("typeof options", typeof options);
    if (typeof options === "string") {
      options = { key: options };
    }
    //console.log("OPTIONS", options);

    this.callback = options.callback;
    this.wanted = options.wanted || [];
    this.key = options.key;
    this.simpleSheet = !!options.simpleSheet;
    this.parseNumbers = !!options.parseNumbers;
    this.wait = !!options.wait;
    this.reverse = !!options.reverse;
    this.postProcess = options.postProcess;
    this.debug = !!options.debug;
    this.query = options.query || "";
    this.orderby = options.orderby;
    this.endpoint = options.endpoint || "https://spreadsheets.google.com";
    this.singleton = !!options.singleton;
    this.simple_url = !!options.simple_url;
    this.callbackContext = options.callbackContext;

    if (typeof options.proxy !== "undefined") {
      // Remove trailing slash, it will break the app
      this.endpoint = options.proxy.replace(/\/$/, "");
      this.simple_url = true;
      this.singleton = true;
      // Let's only use CORS (straight JSON request) when
      // fetching straight from Google
      supportsCORS = false;
    }

    this.parameterize = options.parameterize || false;

    if (this.singleton) {
      if (typeof Tabletop.singleton !== "undefined") {
        //console.log("WARNING! Tabletop singleton already defined");
      }
      Tabletop.singleton = this;
    }

    /* Be friendly about what you accept */
    if (/key=/.test(this.key)) {
      console.log(
        "You passed an old Google Docs url as the key! Attempting to parse."
      );
      this.key = this.key.match("key=(.*?)(&|#|$)")[1];
    }

    if (/pubhtml/.test(this.key)) {
      console.log(
        "You passed a new Google Spreadsheets url as the key! Attempting to parse."
      );
      this.key = this.key.match("d\\/(.*?)\\/pubhtml")[1];
    }

    if (!this.key) {
      console.log("You need to pass Tabletop a key!");
      return;
    }

    //console.log("Initializing with key " + this.key);

    this.models = {};
    this.model_names = [];
    // https://spreadsheets.google.com/feeds/cells/1c--zHE_kSIKJY9cF8gq9s7Lh077L0Vzfh46tOH6mRmE/1/public/full?alt=json
    this.newKey = this.key.replace(
      "https://docs.google.com/spreadsheets/d/",
      ""
    );
    this.newKey = this.newKey.replace("/edit#gid=0", "");
    //console.log("sheet id", this.newKey);
    this.base_json_path = "/feeds/cells/" + this.newKey + "/1/public/full?alt=";
    this.quizSheet =
      "https://spreadsheets.google.com" + this.base_json_path + "json";

    if (inNodeJS || supportsCORS) {
      this.base_json_path += "json";
    } else {
      this.base_json_path += "json-in-script";
    }

    if (!this.wait) {
      console.log("5. Fetching data");
      this.fetch();
    }
  };

  // A global storage for callbacks.
  Tabletop.callbacks = {};

  // Backwards compatibility.
  Tabletop.init = function (options) {
    console.log("3. TABLETOP CONSTRUCTOR CALLED WITH", options);
    return new Tabletop(options);
  };

  Tabletop.sheets = function () {
    console.log(
      "Times have changed! You'll want to use var tabletop = Tabletop.init(...); tabletop.sheets(...); instead of Tabletop.sheets(...)"
    );
  };

  Tabletop.prototype = {
    fetch: function (callback) {
      console.log("6. FETCHING", "CALLBACK IS", callback);
      if (typeof callback !== "undefined") {
        this.callback = callback;
      }
      // console.log(
      //   "base path",
      //   this.base_json_path,
      //   "loadSheets",
      //   this.loadSheets
      // );
      this.requestData(this.base_json_path, this.loadSheet);
    },

    /*
      This will call the environment appropriate request method.
      
      In browser it will use JSON-P, in node it will use request()
    */
    requestData: function (path, callback) {
      console.log("7. Data request initiated", path, callback);
      if (inNodeJS) {
        //console.log("IN NODE");
        this.serverSideFetch(path, callback);
      } else {
        //CORS only works in IE8/9 across the same protocol
        //You must have your server on HTTPS to talk to Google, or it'll fall back on injection
        var protocol = this.endpoint.split("//").shift() || "http";
        if (supportsCORS && (!inLegacyIE || protocol === location.protocol)) {
          // console.log(
          //   "CALLING XHR FUNCTION",
          //   "PATH",
          //   path,
          //   "CALLBACK",
          //   callback
          // );
          this.xhrFetch(path, callback);
        } else {
          this.injectScript(path, callback);
        }
      }
    },

    /*
      Use Cross-Origin XMLHttpRequest to get the data in browsers that support it.
    */
    xhrFetch: function (path, callback) {
      console.log("8. XHR FETCH INITIATED with callback", callback);
      //support IE8's separate cross-domain object
      var xhr = inLegacyIE ? new XDomainRequest() : new XMLHttpRequest();
      //console.log("XHR", xhr);
      // //console.log("endpoint and path", this.quizSheet); // Why does this keep sending requests? WHY??
      xhr.open("GET", this.quizSheet);
      console.log("9. XHR Opening", this.quizSheet);
      var self = this;
      xhr.onload = function () {
        try {
          var json = JSON.parse(xhr.responseText);
          console.log("10. REQUEST LOADED", json);
          // //console.log(xhr.responseText);
        } catch (e) {
          console.error(e);
        }
        callback.call(self, json);
      };

      !this.rateLimit && xhr.send();

      this.rateLimit++;
    },

    /*
      Insert the URL into the page as a script tag. Once it's loaded the spreadsheet data
      it triggers the callback. This helps you avoid cross-domain errors
      http://code.google.com/apis/gdata/samples/spreadsheet_sample.html

      Let's be plain-Jane and not use jQuery or anything.
    */
    injectScript: function (path, callback) {
      var script = document.createElement("script");
      var callbackName;

      if (this.singleton) {
        if (callback === this.loadSheets) {
          callbackName = "Tabletop.singleton.loadSheets";
        } else if (callback === this.loadSheet) {
          callbackName = "Tabletop.singleton.loadSheet";
        }
      } else {
        var self = this;
        callbackName = "tt" + +new Date() + Math.floor(Math.random() * 100000);
        // Create a temp callback which will get removed once it has executed,
        // this allows multiple instances of Tabletop to coexist.
        Tabletop.callbacks[callbackName] = function () {
          var args = Array.prototype.slice.call(arguments, 0);
          callback.apply(self, args);
          script.parentNode.removeChild(script);
          delete Tabletop.callbacks[callbackName];
        };
        callbackName = "Tabletop.callbacks." + callbackName;
      }

      var url = path + "&callback=" + callbackName;

      if (this.simple_url) {
        // We've gone down a rabbit hole of passing injectScript the path, so let's
        // just pull the sheet_id out of the path like the least efficient worker bees
        if (path.indexOf("/list/") !== -1) {
          script.src =
            this.endpoint + "/" + this.key + "-" + path.split("/")[4];
        } else {
          script.src = this.endpoint + "/" + this.key;
        }
      } else {
        script.src = this.endpoint + url;
      }

      if (this.parameterize) {
        script.src = this.parameterize + encodeURIComponent(script.src);
      }

      document.getElementsByTagName("script")[0].parentNode.appendChild(script);
    },

    /* 
      This will only run if tabletop is being run in node.js
    */
    serverSideFetch: function (path, callback) {
      var self = this;
      request({ url: this.endpoint + path, json: true }, function (
        err,
        resp,
        body
      ) {
        if (err) {
          return console.error(err);
        }
        callback.call(self, body);
      });
    },

    /* 
      Is this a sheet you want to pull?
      If { wanted: ["Sheet1"] } has been specified, only Sheet1 is imported
      Pulls all sheets if none are specified
    */
    isWanted: function (sheetName) {
      if (this.wanted.length === 0) {
        return true;
      } else {
        return ttIndexOf(this.wanted, sheetName) !== -1;
      }
    },

    /*
      What gets send to the callback
      if simpleSheet === true, then don't return an array of Tabletop.this.models,
      only return the first one's elements
    */
    data: function () {
      // If the instance is being queried before the data's been fetched
      // then return undefined.
      if (this.model_names.length === 0) {
        return undefined;
      }
      if (this.simpleSheet) {
        if (this.model_names.length > 1 && this.debug) {
          console.log(
            "WARNING You have more than one sheet but are using simple sheet mode! Don't blame me when something goes wrong."
          );
        }
        console.log("14. Calling all() on this.models[this.model_names[0]]", this.models[this.model_names[0]]);
        return this.models[this.model_names[0]].all();
      } else {
        return this.models;
      }
    },

    /*
      Add another sheet to the wanted list
    */
    addWanted: function (sheet) {
      if (ttIndexOf(this.wanted, sheet) === -1) {
        this.wanted.push(sheet);
      }
    },

    /*
      Load all worksheets of the spreadsheet, turning each into a Tabletop Model.
      Need to use injectScript because the worksheet view that you're working from
      doesn't actually include the data. The list-based feed (/feeds/list/key..) does, though.
      Calls back to loadSheet in order to get the real work done.

      Used as a callback for the worksheet-based JSON
    */
    loadSheets: function (data) {
      var i, ilen;
      var toLoad = [];
      this.foundSheetNames = [];
      //console.log(data);

      for (i = 0, ilen = data.feed.entry.length; i < ilen; i++) {
        this.foundSheetNames.push(data.feed.entry[i].title.$t);
        // Only pull in desired sheets to reduce loading
        if (this.isWanted(data.feed.entry[i].content.$t)) {
          var linkIdx = data.feed.entry[i].link.length - 1;
          var sheet_id = data.feed.entry[i].link[linkIdx].href.split("/").pop();
          var json_path =
            "/feeds/list/" + this.key + "/" + sheet_id + "/public/values?alt=";
          if (inNodeJS || supportsCORS) {
            json_path += "json";
          } else {
            json_path += "json-in-script";
          }
          if (this.query) {
            json_path += "&sq=" + this.query;
          }
          if (this.orderby) {
            json_path += "&orderby=column:" + this.orderby.toLowerCase();
          }
          if (this.reverse) {
            json_path += "&reverse=true";
          }
          toLoad.push(json_path);
        }
      }

      // this was causing a lot of useless requests!!!
      // When this was first written the URL model used by GSheets was different
      this.sheetsToLoad = toLoad.length;
      /*
      for(i = 0, ilen = toLoad.length; i < ilen; i++) {
        this.requestData(toLoad[i], this.loadSheet);
      }
      */
      //console.log("foundSheetNames", this.foundSheetNames);
    },

    /*
      Access layer for the this.models
      .sheets() gets you all of the sheets
      .sheets('Sheet1') gets you the sheet named Sheet1
    */
    sheets: function (sheetName) {
      if (typeof sheetName === "undefined") {
        return this.models;
      } else {
        if (typeof this.models[sheetName] === "undefined") {
          // alert( "Can't find " + sheetName );
          return;
        } else {
          return this.models[sheetName];
        }
      }
    },

    /*
      Parse a single list-based worksheet, turning it into a Tabletop Model

      Used as a callback for the list-based JSON
    */
    loadSheet: function (data) {
      console.log("11. LOADSHEET CALLED WITH", data);
      var model = new Tabletop.Model({
        data: data,
        parseNumbers: this.parseNumbers,
        postProcess: this.postProcess,
        tabletop: this,
      });
      //console.log("CREATED MODEL", model);
      this.models[model.name] = model;
      //console.log("MODELS", this.models);
      if (ttIndexOf(this.model_names, model.name) === -1) {
        //console.log("PUSHING TO MODELS ARRAY", model.name);
        this.model_names.push(model.name);
      }
      this.sheetsToLoad = 0;
      console.log("12. this.sheetsToLoad", this.sheetsToLoad);
      if (this.sheetsToLoad === 0) {
        //console.log("COUNT OF SHEETSTOLOAD", this.sheetsToLoad);
        this.doCallback();
      }
    },

    /*
      Execute the callback upon loading! Rely on this.data() because you might
        only request certain pieces of data (i.e. simpleSheet mode)
      Tests this.sheetsToLoad just in case a race condition happens to show up
    */
    doCallback: function () {
      console.log("13. doCallback()");
      if (this.sheetsToLoad === 0) {
        this.callback.apply(this.callbackContext || this, [this.data(), this]);
      }
    },

    log: function (msg) {
      if (this.debug) {
        if (
          typeof console !== "undefined" &&
          typeof console.log !== "undefined"
        ) {
          Function.prototype.apply.apply(console.log, [console, arguments]);
        }
      }
    },
  };

  /*
    Tabletop.Model stores the attribute names and parses the worksheet data
      to turn it into something worthwhile

    Options should be in the format { data: XXX }, with XXX being the list-based worksheet
  */
  Tabletop.Model = function (options) {
    //console.log("CREATING MODEL WITH ", options);
    var i, j, ilen, jlen;
    this.column_names = [];
    this.name = options.data.feed.title.$t;
    this.elements = [];
    //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
    this.raw = options.data; // A copy of the sheet's raw data, for accessing minutiae
    //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
    this.rawArray = [];
    //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
    for (let item in this.raw.feed.entry) {
      // Need to turn this indexed object into an array
      //console.log(this.raw.feed.entry[item]);
      //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
      this.rawArray[item] = this.raw.feed.entry[item];
    }

    //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
    // Now that we have the indexed obj as an array we can do negative indexing to get the last item
    // //console.log("xxxxxxxx", this.rawArray[this.rawArray.length-1]);
    this.questionCount =
      this.rawArray[this.rawArray.length - 1]["gs$cell"].row - 1;
    //console.log(this.questionCount);
    // this.elements = Array(this.questionCount).fill({}); // Reference by value error... wow.
    let iterCount = 0;
    while (iterCount < this.questionCount) {
      //console.log(iterCount);
      this.elements[iterCount] = [];
      iterCount++;
    } // Replacement for Array().fill()
    //console.log("!!!!!!!!!!!!!!!!!!!! this.elements", this.elements);
    // this.elements = Array(3).fill({});

    // if (typeof options.data.feed.entry === "undefined") {
    //   //console.log(
    //     "Missing data for " +
    //       this.name +
    //       ", make sure you didn't forget column headers"
    //   );
    //   this.elements = [];
    //   return;
    // }

    for (var key in options.data.feed.entry[0]) {
      // Changed this to fix column_names update... was originally not loading the data at index 0 into the column_names array
      //if (/^gsx/.test(key)) this.column_names.push(key.replace("gsx$", ""));
    }

    let column_number = 0;
    while (column_number < 10) {
      this.column_names.push(
        options.data.feed.entry[column_number]["gs$cell"]["$t"]
      );
      column_number++;
    }

    //console.log("COLUMNS:", this.column_names);
    /*
    0: "description"
    1: "question"
    2: "a"
    3: "b"
    4: "c"
    5: "d"
    6: "answer"
    7: "incorrect"
    8: "correct"
    9: "hint"
    */

    /*
    input: array of objects
    currentQuestion: row
    column: key
    input[0].description -> description of first question
    input[currentQuestion][column]

    [
    {a: "dfghjk",
     b: "uytrefg"},
     {}
    ]
    
    */

    for (i = 10, ilen = options.data.feed.entry.length; i < ilen; i++) {
      //console.log("~~~~~~~~~~~~~~~~~~~ I is ", i);
      var source = options.data.feed.entry[i];
      var cell = source["gs$cell"];
      var cellContent = cell["$t"];
      var cellRow = cell.row - 2;
      var cellCol = cell.col - 1;
      var cellColName = this.column_names[cellCol];
      //console.log("THS.ELEMENTS", this.elements); // TODO!!!!!!!!!!!!!!!!!!!! NEED TO FIX THIS.ELEMENTS!!! WHY IS IT COPYING EVERRYTHING MULTIPLE TIMES
      var element = this.elements[cellRow];
      //console.log("!@#$",element);
      //console.log(Object.keys(element).length, "!@#$");

      element[cellColName] = cellContent;
      Object.keys(element).length == 0 && (element[cellColName] = "");

      if (options.postProcess) options.postProcess(element);
    }

    this.elements[cellRow] = element;
    //console.log("Added element", typeof element, element)
    console.log("elements", this.elements);
  };

  Tabletop.Model.prototype = {
    /*
      Returns all of the elements (rows) of the worksheet as objects
    */
    all: function () {
      console.log("15. In all() RETURNING", this.elements);
      return this.elements;
    },

    /*
      Return the elements as an array of arrays, instead of an array of objects
    */
    toArray: function () {
      var array = [],
        i,
        j,
        ilen,
        jlen;
      for (i = 0, ilen = this.elements.length; i < ilen; i++) {
        var row = [];
        for (j = 0, jlen = this.column_names.length; j < jlen; j++) {
          row.push(this.elements[i][this.column_names[j]]);
        }
        array.push(row);
      }
      //console.log("RETURNING", array);
      return array;
    },
  };

  if (inNodeJS) {
    module.exports = Tabletop;
  } else {
    global.Tabletop = Tabletop;
  }
})(this);
