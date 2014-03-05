/*jslint indent: 2, maxlen: 80, nomen: true */
/*global window, define, module, test_util, RSVP, jIO, local_storage, test, ok,
  deepEqual, sinon, expect, stop, start, Blob */
// define([module_name], [dependencies], module);
(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  module(test_util, RSVP, jIO);
}([
  'test_util',
  'rsvp',
  'jio',
  'dropboxstorage',
  'qunit'
], function (util, RSVP, jIO) {
  "use strict";

  module("DropboxStorage");


  /**
   * all(promises): Promise
   *
   * Produces a promise that is resolved when all the given promises are
   * fulfilled. The resolved value is an array of each of the answers of the
   * given promises.
   *
   * @param  {Array} promises The promises to use
   * @return {Promise} A new promise
   */
  function all(promises) {
    var results = [],
    i,
    count = 0;

    function cancel() {
      var j;
      for (j = 0; j < promises.length; j += 1) {
        if (typeof promises[j].cancel === 'function') {
          promises[j].cancel();
        }
      }
    }
    return new RSVP.Promise(function (resolve, reject, notify) {
      /*jslint unparam: true */
      function succeed(j) {
        return function (answer) {
          results[j] = answer;
          count += 1;
          if (count !== promises.length) {
            return;
          }
          resolve(results);
        };
      }

      function notified(j) {
        return function (answer) {
          notify({
            "promise": promises[j],
            "index": j,
            "notified": answer
          });
        };
      }
      for (i = 0; i < promises.length; i += 1) {
        promises[i].then(succeed(i), succeed(i), notified(i));
      }
    }, cancel);
  }

  test("Post & Get", function () {
    expect(5);
    var jio = jIO.createJIO({
      "type": "dropbox",
      "access_token": "v43SQLCEoi8AAAAAAAAAAVixCoMfDelgGj3NRPfEnqscAuNGp2LhoS8-GiAaDD4C"
    }, {
      "workspace": {}
    });

    stop();

    all([

      // get inexistent document
      jio.get({
        "_id": "inexistent"
      }).always(function (answer) {

        deepEqual(answer, {
          "error": "not_found",
          "id": "inexistent",
          "message": "Cannot find document",
          "method": "get",
          "reason": "Not Found",
          "result": "error",
          "status": 404,
          "statusText": "Not Found"
        }, "Get inexistent document");

      }),

      // post without id
      jio.post({}).always(function (answer) {

        var uuid = answer.id;
        delete answer.id;
        deepEqual(answer, {
          "method": "post",
          "result": "success",
          "status": 201,
          "statusText": "Created"
        }, "Post without id");

        ok(util.isUuid(uuid), "Uuid should look like " +
           "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx : " + uuid);

      }).then(function () {

        // post non empty document
        return jio.post({
          "_id": "post1",
          "title": "myPost1"
        });

      }).always(function (answer) {

        deepEqual(answer, {
          "id": "post1",
          "method": "post",
          "result": "success",
          "status": 201,
          "statusText": "Created"
        }, "Post");

      }).then(function () {

        return jio.get({
          "_id": "post1"
        });

      }).always(function (answer) {

        deepEqual(answer, {
          "data": {
            "_id": "post1",
            "title": "myPost1"
          },
          "id": "post1",
          "method": "get",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "Get, Check document");
      })

    ]).always(start);

  });

  test("Put & Get", function () {
    expect(4);
    var jio = jIO.createJIO({
      "type": "dropbox",
      "access_token": "v43SQLCEoi8AAAAAAAAAAVixCoMfDelgGj3NRPfEnqscAuNGp2LhoS8-GiAaDD4C"
    }, {
      "workspace": {}
    });

    stop();

    // put non empty document
    jio.put({
      "_id": "put1",
      "title": "myPut1"
    }).always(function (answer) {

      deepEqual(answer, {
        "id": "put1",
        "method": "put",
        "result": "success",
        "status": 201,
        "statusText": "Created"
      }, "Creates a document");

    }).then(function () {

      return jio.get({
        "_id": "put1"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "data": {
          "_id": "put1",
          "title": "myPut1"
        },
        "id": "put1",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get, Check document");

    }).then(function () {

      // put but document already exists
      return jio.put({
        "_id": "put1",
        "title": "myPut2"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "id": "put1",
        "method": "put",
        "result": "success",
        "status": 201,
        "statusText": "Created"
      }, "Update the document");

    }).then(function () {

      return jio.get({
        "_id": "put1"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "data": {
          "_id": "put1",
          "title": "myPut2"
        },
        "id": "put1",
        "method": "get",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Get, Check document");

    }).always(start);

  });

  test("PutAttachment & Get & GetAttachment", function () {
    expect(10);
    var jio = jIO.createJIO({
      "type": "dropbox",
      "access_token": "v43SQLCEoi8AAAAAAAAAAVixCoMfDelgGj3NRPfEnqscAuNGp2LhoS8-GiAaDD4C"
    }, {
      "workspace": {}
    });

    stop();

    all([

      // get an attachment from an inexistent document
      jio.getAttachment({
        "_id": "inexistent",
        "_attachment": "a"
      }).always(function (answer) {

        deepEqual(answer, {
          "attachment": "a",
          "error": "not_found",
          "id": "inexistent",
          "message": "Unable to get attachment",
          "method": "getAttachment",
          "reason": "Missing document",
          "result": "error",
          "status": 404,
          "statusText": "Not Found"
        }, "GetAttachment from inexistent document");

      }),

      // put a document then get an attachment from the empty document
      jio.put({
        "_id": "b"
      }).then(function () {
        return jio.getAttachment({
          "_id": "b",
          "_attachment": "inexistent"
        });

      }).always(function (answer) {

        deepEqual(answer, {
          "attachment": "inexistent",
          "error": "not_found",
          "id": "b",
          "message": "Cannot find attachment",
          "method": "getAttachment",
          "reason": "Not Found",
          "result": "error",
          "status": 404,
          "statusText": "Not Found"
        }, "Get inexistent attachment");

      }),

      // put an attachment to an inexistent document
      jio.putAttachment({
        "_id": "inexistent",
        "_attachment": "putattmt2",
        "_data": ""
      }).always(function (answer) {

        deepEqual(answer, {
          "attachment": "putattmt2",
          "error": "not_found",
          "id": "inexistent",
          "message": "Impossible to add attachment",
          "method": "putAttachment",
          "reason": "Missing document",
          "result": "error",
          "status": 404,
          "statusText": "Not Found"
        }, "PutAttachment to inexistent document");

      }),

      // add a document to the storage
      // don't need to be tested
      jio.put({
        "_id": "putattmt1",
        "title": "myPutAttmt1"
      }).then(function () {

        return jio.putAttachment({
          "_id": "putattmt1",
          "_attachment": "putattmt2",
          "_data": ""
        });

      }).always(function (answer) {

        deepEqual(answer, {
          "attachment": "putattmt2",
          "digest": "sha256-4ea5c508a6566e76240543f8feb06fd457777be39549c4016436afda65d2330e",
          "id": "putattmt1",
          "method": "putAttachment",
          "result": "success",
          "status": 201,
          "statusText": "Created"
        }, "PutAttachment to a document, without data");

      }).then(function () {

        // check document and attachment
        return all([
          jio.get({
            "_id": "putattmt1"
          }),
          jio.getAttachment({
            "_id": "putattmt1",
            "_attachment": "putattmt2"
          })
        ]);

        // XXX check attachment with a getAttachment

      }).always(function (answers) {

        deepEqual(answers[0], {
          "data": {
            "_attachments": {
              "putattmt2": {
                "content_type": "",
                "digest": "sha256-4ea5c508a6566e76240543f8feb06fd457777be39549c4016436afda65d2330e",
                "length": 0
              }
            },
            "_id": "putattmt1",
            "title": "myPutAttmt1"
          },
          "id": "putattmt1",
          "method": "get",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "Get, Check document");
        ok(answers[1].data instanceof Blob, "Data is Blob");
        deepEqual(answers[1].data.type, "", "Check mimetype");
        deepEqual(answers[1].data.size, 0, "Check size");

        delete answers[1].data;
        deepEqual(answers[1], {
          "attachment": "putattmt2",
          "id": "putattmt1",
          "digest": "sha256-4ea5c508a6566e76240543f8feb06fd457777be39549c4016436afda65d2330e",
          "method": "getAttachment",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "Get Attachment, Check Response");

      })

    ]).then( function () {
      return jio.put({
        "_id": "putattmt1",
        "foo": "bar",
        "title": "myPutAttmt1"
      });
    }).then (function () {
      return jio.get({
        "_id": "putattmt1"
      });
    }).always(function (answer) {

        deepEqual(answer, {
          "data": {
            "_attachments": {
              "putattmt2": {
                "content_type": "",
                "digest": "sha256-4ea5c508a6566e76240543f8feb06fd457777be39549c4016436afda65d2330e",
                "length": 0
              }
            },
            "_id": "putattmt1",
            "foo": "bar",
            "title": "myPutAttmt1"
          },
          "id": "putattmt1",
          "method": "get",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "Get, Check put kept document attachment");
    })
      .always(start);

  });

  test("Remove & RemoveAttachment", function () {
    expect(4);
    var jio = jIO.createJIO({
      "type": "dropbox",
      "access_token": "v43SQLCEoi8AAAAAAAAAAVixCoMfDelgGj3NRPfEnqscAuNGp2LhoS8-GiAaDD4C"
    }, {
      "workspace": {}
    });

    stop();

    jio.put({
      "_id": "a"
    }).then(function () {

      return jio.putAttachment({
        "_id": "a",
        "_attachment": "b",
        "_data": "c"
      });

    }).then(function () {

      return jio.removeAttachment({
        "_id": "a",
        "_attachment": "b"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "attachment": "b",
        "id": "a",
        "method": "removeAttachment",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Remove existent attachment");

    }).then(function () {

      // Promise.all always return success
      return all([jio.removeAttachment({
        "_id": "a",
        "_attachment": "b"
      })]);

    }).always(function (answers) {

      deepEqual(answers[0], {
        "attachment": "b",
        "error": "not_found",
        "id": "a",
        "message": "Attachment not found",
        "method": "removeAttachment",
        "reason": "missing attachment",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Remove removed attachment");

    }).then(function () {

      return jio.remove({
        "_id": "a"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "id": "a",
        "method": "remove",
        "result": "success",
        "status": 200,
        "statusText": "Ok"
      }, "Remove existent document");

    }).then(function () {

      return jio.remove({
        "_id": "a"
      });

    }).always(function (answer) {

      deepEqual(answer, {
        "error": "not_found",
        "id": "a",
        "message": "Document not found",
        "method": "remove",
        "reason": "OK",
        "result": "error",
        "status": 404,
        "statusText": "Not Found"
      }, "Remove removed document");

    }).always(start);

  });

  test("AllDocs", function () {
    expect(2);
    var o = {},
    jio = jIO.createJIO({
      "type": "dropbox",
      "access_token": "v43SQLCEoi8AAAAAAAAAAVixCoMfDelgGj3NRPfEnqscAuNGp2LhoS8-GiAaDD4C",
      "root_folder": "AllDocs-test"
    }, {
      "workspace": {}
    });

    stop();

    o.date_a = new Date(0);
    o.date_b = new Date();

    // Clean storage and put some document before listing them
    all([
      jio.allDocs()
        .then(function (document_list) {
          var promise_list = [],
          i;
          for (i = 0; i < document_list.data.total_rows; i += 1) {
            promise_list.push(
              jio.remove({
                '_id': document_list.data.rows[i].id
              })
            );
          }
          return RSPV.all(promise_list);
        })
    ])
      .then(function () {
        return RSVP.all([
          jio.put({
            "_id": "a",
            "title": "one",
            "date": o.date_a
          }).then(function () {
            return jio.putAttachment({
              "_id": "a",
              "_attachment": "aa",
              "_data": "aaa"
            });
          }),
          jio.put({
            "_id": "b",
            "title": "two",
            "date": o.date_a
          }),
          jio.put({
            "_id": "c",
            "title": "one",
            "date": o.date_b
          }),
          jio.put({
            "_id": "d",
            "title": "two",
            "date": o.date_b
          })
        ]);
      }).then(function () {

        // get a list of documents
        return jio.allDocs();

      }).always(function (answer) {

        // sort answer rows for comparison
        if (answer.data && answer.data.rows) {
          answer.data.rows.sort(function (a, b) {
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
        }

        deepEqual(answer, {
          "data": {
            "rows": [{
              "id": "a",
              "key": "a",
              "value": {}
            }, {
              "id": "b",
              "key": "b",
              "value": {}
            }, {
              "id": "c",
              "key": "c",
              "value": {}
            }, {
              "id": "d",
              "key": "d",
              "value": {}
            }],
            "total_rows": 4
          },
          "method": "allDocs",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "AllDocs");

      }).then(function () {

        // get a list of documents
        return jio.allDocs({
          "include_docs": true
        });

      }).always(function (answer) {

        deepEqual(answer, {
          "data": {
            "rows": [{
              "doc": {
                "_attachments": {
                  "aa": {
                    "content_type": "",
                    "digest": "sha256-4ea5c508a6566e76240543f8feb06fd457777be39549c4016436afda65d2330e",
                    "length": 3
                  }
                },
                "_id": "a",
                "date": o.date_a.toJSON(),
                "title": "one"
              },
              "id": "a",
              "key": "a",
              "value": {}
            }, {
              "doc": {
                "_id": "b",
                "date": o.date_a.toJSON(),
                "title": "two"
              },
              "id": "b",
              "key": "b",
              "value": {}
            }, {
              "doc": {
                "_id": "c",
                "date": o.date_b.toJSON(),
                "title": "one"
              },
              "id": "c",
              "key": "c",
              "value": {}
            }, {
              "doc": {
                "_id": "d",
                "date": o.date_b.toJSON(),
                "title": "two"
              },
              "id": "d",
              "key": "d",
              "value": {}
            }],
            "total_rows": 4
          },
          "method": "allDocs",
          "result": "success",
          "status": 200,
          "statusText": "Ok"
        }, "AllDocs include docs");

      }).always(start);

  });

}));