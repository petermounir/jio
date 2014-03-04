/*
 * Copyright 2013, Nexedi SA
 * Released under the LGPL license.
 * http://www.gnu.org/licenses/lgpl.html
 */

/*

BaseStorage
===========

This storage must be inherited by other ones.

It is designed  to use a generic document management  mechanism for dumb storage
servers like WebDAV, SQL, DropBox, Google Drive and so on.


Document id and attachment id mechanism
---------------------------------------

If I want to retrieve the file which id is ``\:/_?100%.json``. The URL
``http://domain/collection/\:/_?100%.json`` cannot be applied.

- '/' is col separator,
- '\' can be interpreted as a separator
- '?' is url/parameter separator
- '%' is special char

::

    id = "\\:/_?100%.json"
    id = encodeURI(id); // "%5C:/_?100%25.json"
    id = id.replace(/\//g, "%2F"); // "%5C:%2F_?100%25.json"
    id = id.replace(/\?/g, "%3F"); // "%5C:%2F_%3F100%25.json"

- '%2F' is interpreted by '/' from the server
- '%5C' -> '\'
- '%25' -> '%' ...

::

    id = encodeURI(id); // "%255C:%252F_%253F100%2525.json"

- '.' document and attachment separator, '_' can be used as an escape character

::

    id = id.replace(/_/g, "__"); // "%255C:%252F__%253F100%2525.json"
    id = id.replace(/\./g, "_."); // "%255C:%252F__%253F100%2525_.json"

As string, the URL would be
``http://domain/collection/%255C:%252F__%253F100%2525_.json``.

The file would be created as ``%5C:%2F__%3F100%25_.json``.

For attachments, their id are appended to the related document id but '.' and
'_' are not escaped.

For attachment ``_hello_.txt``, as string, the URL would be
``http://domain/collection/%255C:%252F__%253F100%2525_.json._hello_.txt``.

 */

/*jslint indent: 2, maxlen: 80, nomen: true, regexp: true, unparam: true */
/*global ProgressEvent, Blob, jIO, RSVP */

var Promise = RSVP.Promise;

/**
 * Removes the last character if it is a "/". "/a/b/c/" become "/a/b/c"
 *
 * @param  {String} string The string to modify
 * @return {String} The modified string
 */
function removeLastSlashes(string) {
  return string.replace(/\/*$/, '');
}

/**
 * sequence(thens): Promise
 *
 * Executes a sequence of *then* callbacks. It acts like
 * `smth().then(callback).then(callback)...`. The first callback is called
 * with no parameter.
 *
 * Elements of `thens` array can be a function or an array contaning at most
 * three *then* callbacks: *onFulfilled*, *onRejected*, *onNotified*.
 *
 * When `cancel()` is executed, each then promises are cancelled at the same
 * time.
 *
 * @param  {Array} thens An array of *then* callbacks
 * @return {Promise} A new promise
 */
function sequence(thens) {
  var promises = [];
  return new Promise(function (resolve, reject, notify) {
    var i;
    promises[0] = new Promise(function (resolve) {
      resolve();
    });
    for (i = 0; i < thens.length; i += 1) {
      if (Array.isArray(thens[i])) {
        promises[i + 1] = promises[i].
          then(thens[i][0], thens[i][1], thens[i][2]);
      } else {
        promises[i + 1] = promises[i].then(thens[i]);
      }
    }
    promises[i].then(resolve, reject, notify);
  }, function () {
    var i;
    for (i = 0; i < promises.length; i += 1) {
      promises[i].cancel();
    }
  });
}

function resourceNameToIds(resourcename) {
  var split, el, id = "", attmt = "", last;
  split = resourcename.split('.');

  function replaceAndNotLast() {
    last = false;
    return '.';
  }

  /*jslint ass: true */
  while ((el = split.shift()) !== undefined) {
    /*jslint ass: false */
    last = true;
    el = el.replace(/__/g, '%2595');
    el = el.replace(/_$/, replaceAndNotLast);
    id += el.replace(/%2595/g, '_');
    if (last) {
      break;
    }
  }

  attmt = split.join('.');

  return [id, attmt];
}

function idsToResourceName(document_id, attachment_id) {
  document_id = encodeURI(document_id).
    replace(/\//g, "%2F").
    replace(/\?/g, "%3F");
  document_id = encodeURI(document_id).
    replace(/_/g, "__").
    replace(/\./g, "_.");
  if (attachment_id) {
    attachment_id = encodeURI(attachment_id).
      replace(/\//g, "%2F").
      replace(/\?/g, "%3F");
    return document_id + "." + attachment_id;
  }
  return document_id;
}

function formatUpdateAnswer(value) {
  if (value instanceof ProgressEvent) {
    return {
      "status": value.target.status
    };
  }
  if (typeof value.status === "number" ||
      typeof value.statusText === "string") {
    return value;
  }
}

function formatErrorAnswer() {
}

function BaseStorage(spec) {
  return;
}

BaseStorage.prototype.generateDocumentId = jIO.util.generateUuid;

BaseStorage.prototype.post = function (command, metadata, options) {

  var filename;

  function handleRetrieveProgress(event) {
    command.notify({
      "method": "post",
      "message": "Getting metadata",
      "loaded": event.loaded,
      "total": event.total,
      "percentage": (event.loaded / event.total) * 30 // 0% to 30%
    });
    throw null;
  }

  function handleUpdateProgress(event) {
    command.notify({
      "method": "post",
      "message": "Updating metadata",
      "loaded": event.loaded,
      "total": event.total,
      "percentage": (event.loaded / event.total) * 70 + 30 // 30% to 100%
    });
    throw null;
  }

  function throwConflict(value) {
    throw {
      "status": 409,
      "reason": "already exists",
      "message": "Unable to post document because it already exists"
    };
  }

  function generateDocumentIdIfNecessary() {
    if (metadata._id) {
      return metadata._id;
    }
    return this.generateDocumentId(metadata);
  }

  function fillDocumentIdAndMakeFileName(id) {
    metadata._id = id;
    filename = idsToResourceName(id);
  }

  function retrieveFile() {
    return this.retrieveFile(filename);
  }

  function continueIfStatusCodeIs404(event) {
    if (event instanceof ProgressEvent) {
      if (event.target.status === 404) {
        return event;
      }
    }
    throw event;
  }

  return sequence([
    generateDocumentIdIfNecessary,
    fillDocumentIdAndMakeFileName,
    retrieveFile.bind(this),
    [throwConflict, continueIfStatusCodeIs404, handleRetrieveProgress],
    this.updateFile.bind(this, metadata),
    [formatUpdateAnswer, formatErrorAnswer, handleUpdateProgress],
    [command.success, command.error]
  ]);
};

BaseStorage.prototype.put = function (command, metadata, options) {

  var filename = idsToResourceName(metadata._id);

  function handleRetrieveProgress(event) {
    command.notify({
      "method": "put",
      "message": "Getting metadata",
      "loaded": event.loaded,
      "total": event.total,
      "percentage": (event.loaded / event.total) * 30 // 0% to 30%
    });
    throw null;
  }

  function handleUpdateProgress(event) {
    command.notify({
      "method": "put",
      "message": "Updating metadata",
      "loaded": event.loaded,
      "total": event.total,
      "percentage": (event.loaded / event.total) * 70 + 30 // 30% to 100%
    });
    throw null;
  }

  return sequence([
    this.retrieveFile.bind(this, filename),
    [updateMetadata, null, handleRetrieveProgress],
    this.updateFile.bind(this, filename, new Blob([
      JSON.stringify(metadata)
    ], "application/json")),
    [formatSuccessAnswer, formatErrorAnswer, handleUpdateProgress],
    [command.success, command.error]
  ]);
};

BaseStorage.prototype.get = function (command, metadata, options) {

  function handleRetrieveProgress(event) {
    command.notify({
      "method": "get",
      "message": "Getting metadata",
      "loaded": event.loaded,
      "total": event.total,
      "percentage": (event.loaded / event.total) * 100 // 0% to 100%
    });
    throw null;
  }

  return sequence([
    this.retrieveFile.bind(this, metadata._id),
    [formatSuccessAnswer, formatErrorAnswer, handleRetrieveProgress],
    [command.success, command.error]
  ]);
};

BaseStorage.prototype.remove = function (command, metadata, options) {
  return sequence([
    this.retrieveFile.bind(this, metadata._id),
    selectAttachmentsToRemove,
    this.removeFile.bind(this, metadata._id),
    [storeAnswer, null, handleRemoveProgress],
    removeAllAttachments,
    retrieveStoredAnswer,
    [formatSuccessAnswer, formatErrorAnswer, handleAllRemoveProgress],
    [command.success, command.error]
  ]);
};
