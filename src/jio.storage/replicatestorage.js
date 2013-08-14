/*jslint indent: 2, maxlen: 80, nomen: true, regexp: true */
/*global define, jIO */

// {
//   "type": "replicate",
//   "storage_list": [<storage spec>, ...]
//   "conditions": {
//     "modified": "greatest date",
//     "type": {"action": "afs", "coefficient": 2},
//   }
// }

// conditions:
// - lastest date (ld)/ earliest date (ed)
// - greatest number (gn) / lowest number (ln) // 2 > 1
// - alphabeticaly farthest string (afs) / alph.. closest string (acs)
// - greatest version (gv) / lowest version (lv) // '1.10c' > '1.9c'
// - longest list (ll) / shortest list (sl) // [0].length > [].length
// - longest string (ls) / shortest string (ss) // 'a'.length > ''.length
// - contains content type (contentType) // ["aa", "text/plain"] > ["zz", "zz"]
// - contains DCMIType vocabulary (DCMIType)
//                                    // ["aa", "Text"] > ["zz", "Web Page"]

// define([module_name], [dependencies], module);
(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  module(jIO);
}(['jio'], function (jIO) {
  "use strict";

  var actions = {}, content_type_re = new RegExp(
    "^\\s*([a-z]+/[a-zA-Z0-9\\+\\-\\.]+)\\s*" +
      "(?:;\\s*charset\\s*=\\s*([a-zA-Z0-9\\-]+)\\s*)?$"
  ), dcmi_types = {
    'Collection': 'Collection',
    'Dataset': 'Dataset',
    'Event': 'Event',
    'Image': 'Image',
    'InteractiveResource': 'InteractiveResource',
    'MovingImage': 'MovingImage',
    'PhysicalObject': 'PhysicalObject',
    'Service': 'Service',
    'Software': 'Software',
    'Sound': 'Sound',
    'StillImage': 'StillImage',
    'Text': 'Text'
  };

  ////////////////////////////////////////////////////////////
  // replicate storage tools

  /**
   * Returns the number with the lowest value
   *
   * @param  {Number} *values The values to compare
   * @return {Number} The minimum
   */
  function min() {
    var i, val;
    for (i = 1; i < arguments.length; i += 1) {
      if (val === undefined || val > arguments[i]) {
        val = arguments[i];
      }
    }
    return val;
  }

  /**
   * Creates a new array of numbers, strings, or booleans from a metadata array.
   *
   * @param  {Array} array The metadata array
   * @return {Array} The new array
   */
  function metadataArrayToContentArray(array) {
    var i;
    array = array.slice();
    for (i = 0; i < array.length; i += 1) {
      if (typeof array[i] === 'object') {
        array[i] = array[i].content;
      }
    }
    return array;
  }

  // initialize actions

  /**
   * Comparison function to compare element as date.  This function can be used
   * in the Array.prototype.sort method.
   *
   *     0 = 'Thu Jan 01 1970 01:00:00 GMT+0100 (CET)'
   *     '2012' < 2013
   *     'oesrucah' = 'srcheasu'
   *     'abrebcu' < 0
   *
   * @param  {Any} a The first value
   * @param  {Any} b The second value
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.ld = function compareAsDate(a, b) {
    if (a < 0) {
      a = NaN;
    }
    if (b < 1) {
      b = NaN;
    }
    a = new Date(a);
    b = new Date(b);
    if (isNaN(a.getTime())) {
      if (isNaN(b.getTime())) {
        return 0;
      }
      return -1;
    }
    if (isNaN(b.getTime())) {
      return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  };
  actions['lastest date'] = actions.ld;

  actions.ed = function (a, b) {
    return -actions.ld(a, b);
  };
  actions['earliest date'] = actions.ed;

  /**
   * Comparison function to compare elements as numbers.  This function can be
   * used in the Array.prototype.sort method.
   *
   *     -1 < 2
   *     'a' < 0
   *
   * @param  {Any} a The first value
   * @param  {Any} b The second value
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.gn = function compareAsNumber(a, b) {
    a = parseFloat(a);
    b = parseFloat(b);
    if (a < b) {
      return -1;
    }
    if (b < a) {
      return 1;
    }
    if (isNaN(a)) {
      if (isNaN(b)) {
        return 0;
      }
      return -1;
    }
    if (isNaN(b)) {
      return 1;
    }
    return 0;
  };
  actions['greatest number'] = actions.gn;

  actions.ln = function (a, b) {
    return -actions.gn(a, b);
  };
  actions['lowest number'] = actions.ln;

  /**
   * Comparision function to compare elements as strings.  This function can be
   * used in the Array.prototype.sort method.
   *
   *     'abc' < 'def'
   *     ["abcd"] = 'abcd'
   *     ["abc", "def"] = 'abc, def'
   *     ["abc", {"content": "def"}] = 'abc, def'
   *
   * @param  {Any} a The first value
   * @param  {Any} b The second value
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.afs = function compareAsString(a, b) {
    if (Array.isArray(a)) {
      a = metadataArrayToContentArray(a).join(', ');
    } else if (typeof a === 'object') {
      a = a.content.toString();
    } else {
      a = a.toString();
    }
    if (Array.isArray(b)) {
      b = metadataArrayToContentArray(b).join(', ');
    } else if (typeof b === 'object') {
      b = b.content.toString();
    } else {
      a = a.toString();
    }
    return a < b ? -1 : a > b ? 1 : 0;
  };
  actions['alphabeticaly farthest string'] = actions.afs;

  actions.acs = function (a, b) {
    return -actions.afs(a, b);
  };

  /**
   * Comparision function to compare elements as list length.  This function can
   * be used in the Array.prototype.sort method.
   *
   *     ['abc'] = 'def'
   *     ["zzz"] < ["a", "a"]
   *
   * @param  {Any} a The first value
   * @param  {Any} b The second value
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.ll = function compareLengthAsList(a, b) {
    if (!Array.isArray(a)) {
      a = 1;
    } else {
      a = a.length;
    }
    if (!Array.isArray(b)) {
      b = 1;
    } else {
      b = b.length;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  };
  actions['longest list'] = actions.ll;

  actions.sl = function (a, b) {
    return -actions.ll(a, b);
  };
  actions['shortest list'] = actions.sl;


  /**
   * Comparision function to compare elements as string length.  This function
   * can be used in the Array.prototype.sort method.
   *
   *     ['abcdef'] < 'def'
   *     'abc' = 'def'
   *     'abcdef' > 'def'
   *
   * @param  {Any} a The first value
   * @param  {Any} b The second value
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.ls = function compareLengthAsString(a, b) {
    a = a.toString().length;
    b = b.toString().length;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  actions['longest string'] = actions.ls;

  actions.ss = function (a, b) {
    return -actions.ls(a, b);
  };
  actions['shortest string'] = actions.ss;

  /**
   * Splits the version into an array of numbers and separators
   *
   * @param {String} str The string to split
   * @return {Array} The splited version
   */
  function versionSplit(str) {
    var part, res = [];
    if (str === undefined || str === null) {
      return [];
    }
    str = str.toString().trim();
    while (part !== null && str !== '') {
      part = /([0-9]+)?([^0-9]+)?/.exec(str);
      if (part[1] !== undefined) {
        res[res.length] = parseInt(part[1], 10);
      }
      res[res.length] = part[2];
      str = str.slice(part[0].length);
    }
    return res;
  }

  /**
   * Comparison function to compare version string.  This function can be used
   * in the Array.prototype.sort method.
   *
   *     '1.9.3a' < '1.10.0' < '1.10.0a'
   *
   * @param  {String} a The first value to compare
   * @param  {String} b The second value to compare
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.gv = function compareVersion(a, b) {
    var i, l;
    a = versionSplit(a);
    b = versionSplit(b);
    l = min(a.length, b.length);
    for (i = 0; i < l; i += 1) {
      if (a[i] < b[i]) {
        return -1;
      }
      if (a[i] > b[i]) {
        return 1;
      }
    }
    if (i < a.length) {
      return 1;
    }
    if (i < b.length) {
      return -1;
    }
    return 0;
  };
  actions['greatest version'] = actions.gv;

  actions.lv = function (a, b) {
    return -actions.gv(a, b);
  };
  actions['lowest version'] = actions.lv;

  /**
   * Returns the content type set in the metadata value.
   *
   * @param  {String,Number,Array,Object} meta The metadata value
   * @return {String} The content type or undefined
   */
  function getMetadataContentType(meta) {
    var i, res;
    if (!Array.isArray(meta)) {
      meta = [meta];
    }
    for (i = 0; i < meta.length; i += 1) {
      if (typeof meta[i] === 'object') {
        res = meta[i].content;
      } else {
        res = meta[i];
      }
      res = content_type_re.exec(res.toString());
      if (res !== null) {
        return res[1] + (res[2] !== undefined ? ";charset=" + res[2] : "");
      }
    }
  }

  /**
   * Comparison function to find content type.  This function can be used in the
   * Array.prototype.sort method.
   *
   *     'a' = 'bc'
   *     'aeiouy' < 'text/plain'
   *     'text/plain;charset=utf-8' = 'text/html'
   *     ['a'] < 'text/html'
   *     ['a', 'text/plain;charset=utf-8'] = 'text/html'
   *     ['a', {"content": "text/plain;charset=utf-8"}] = 'text/html'
   *
   * @param  {String} a The first value to compare
   * @param  {String} b The second value to compare
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.contentType = function (a, b) {
    a = getMetadataContentType(a);
    b = getMetadataContentType(b);
    if (a === undefined) {
      if (b === undefined) {
        return 0;
      }
      return -1;
    }
    if (b === undefined) {
      return 1;
    }
    return 0;
  };
  actions['contains content type'] = actions.contentType;

  /**
   * Returns the DCMIType set in the metadata value.
   *
   * @param  {String,Number,Array,Object} meta The metadata value
   * @return {String} The DCMIType or undefined
   */
  function getMetadataDCMIType(meta) {
    var i, res;
    if (!Array.isArray(meta)) {
      meta = [meta];
    }
    for (i = 0; i < meta.length; i += 1) {
      if (typeof meta[i] === 'object') {
        res = meta[i].content;
      } else {
        res = meta[i];
      }
      if (dcmi_types[res]) {
        return res;
      }
    }
  }

  /**
   * Comparison function to find DCMIType.  This function can be used in the
   * Array.prototype.sort method.
   *
   *     'a' = 'bc'
   *     'aeiouy' < 'text/plain'
   *     'text/plain;charset=utf-8' = 'text/html'
   *     ['a'] < 'text/html'
   *     ['a', 'text/plain;charset=utf-8'] = 'text/html'
   *     ['a', {"content": "text/plain;charset=utf-8"}] = 'text/html'
   *
   * @param  {String} a The first value to compare
   * @param  {String} b The second value to compare
   * @return {Number} if a < b: -1, if a > b: 1, else 0
   */
  actions.DCMIType = function (a, b) {
    a = getMetadataDCMIType(a);
    b = getMetadataDCMIType(b);
    if (a === undefined) {
      if (b === undefined) {
        return 0;
      }
      return -1;
    }
    if (b === undefined) {
      return 1;
    }
    return 0;
  };
  actions['contains DCMIType vocabulary'] = actions.DCMIType;

  /**
   * Find the winner documents according to their metadata values.
   *
   * @param  {Array} documents A list of couples [document, score]
   * @param  {String,Number,Array,Object} metadata The metadata key to use in
   *         the document
   * @param  {String} action The comparison action to use, if unknown then
   *         do nothing
   * @param  {Number} coef The number of point to give if a document wins
   * @return {Array} The original documents list with a different score
   */
  function runDocumentMetadataRound(documents, metadata, action, coef) {
    var i, res, winners = [0];
    for (i = 1; i < documents.length; i += 1) {
      res = actions[action](documents[winners[0]][0], documents[i][0]);
      if (res === 0) {
        winners[winners.length] = i;
      } else if (res < 0) {
        winners = [i];
      }
    }
    for (i = 0; i < winners.length; i += 1) {
      documents[winners[i]][1] += coef;
    }
    return documents;
  }

  /**
   * Converts a document list into a list of couples [document, score (0)] and
   * runs some actions that will increase their score. The winner is the
   * document with the greatest score.
   *
   * @param  {Array} documents A list of document metadata
   * @param  {Object} conditions A dict that contains action on metadata key
   * @return {Array} The original documents list with scores
   */
  function runDocumentMetadataBattle(documents, conditions) {
    var i, coef, action;
    for (i = 0; i < documents.length; i += 1) {
      documents[i] = [documents[i], 0];
    }
    for (i in conditions) {
      if (conditions.hasOwnProperty(i)) {
        if (typeof conditions[i] === 'string') {
          action = conditions[i];
          coef = 1;
        } else if (typeof conditions[i] === 'object') {
          action = conditions[i].action;
          coef = conditions[i].coef;
          if (typeof coef !== 'number' && coef === 0) {
            action = '';
          }
        }
        if (actions[action]) {
          runDocumentMetadataRound(documents, i, action, coef);
        }
      }
    }
    return documents;
  }

  ////////////////////////////////////////////////////////////
  // Storage

  /**
   * A Storage for data duplication and storage synchronisation.
   *
   * @class ReplicateStorage
   */
  function replicateStorage(spec, my) {
    var error, priv = {}, that = my.basicStorage(spec, my);

    if (typeof spec.conditions !== 'object' ||
        Object.getPrototypeOf(spec.conditions) !== Object.prototype) {
      error = new TypeError("ReplicateStorage(): " +
                            "'conditions' is not of type 'object'");
    }

    if (Array.isArray(spec.storage_list)) {
      error = new TypeError("ReplicateStorage(): " +
                            "'storage_list' is not of type 'array'");
    }

    //////////////////////////////
    // Overrides

    that.validateState = function () {
      return error && error.message;
    };

    that.specToStore = function () {
      return {
        "storage_list": spec.storage_list,
        "conditions": spec.conditions,
      };
    };

    //////////////////////////////
    // JIO Commands

    that.post = function (command) {
      var metadata, options;
      metadata = command.cloneDoc();
      options = command.cloneOptions();
    };

    return that;
  }

  jIO.addStorageType('replicate', replicateStorage);

}));
