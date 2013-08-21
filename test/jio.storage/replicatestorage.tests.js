/*jslint indent: 2, maxlen: 80, nomen: true */
/*global define, jIO, jio_tests, test, ok, deepEqual, sinon, expect */

// define([module_name], [dependencies], module);
(function (dependencies, module) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    return define(dependencies, module);
  }
  module(jIO, jio_tests);
}([
  'jio',
  'jio_tests',
  'localstorage',
  'replicatestorage'
], function (jIO, util) {
  "use strict";

  module("ReplicateStorage");

  test("Substorage management", function () {
    expect(3);
    var clock = sinon.useFakeTimers(), jio = jIO.newJio({
      "type": "replicate",
      "storage_list": [{
        "type": "dummy"
      }, {
        "type": "dummy"
      }]
    });

    // post without id
    jio.post({}, util.spyJioCallback("value", {
      "id": "document id a",
      "ok": true
    }, "2 Storages DONE + DONE = DONE"));
    clock.tick(1000);

    util.closeAndcleanUpJio(jio);

    jio = jIO.newJio({
      "type": "replicate",
      "storage_list": [{
        "type": "dummy"
      }, {
        "type": "dummy",
        "mode": "always fail"
      }]
    });

    jio.post({}, util.spyJioCallback("value", {
      "id": "document id a",
      "ok": true
    }, "2 Storages DONE + FAIL = DONE"));
    clock.tick(1000);

    util.closeAndcleanUpJio(jio);

    jio = jIO.newJio({
      "type": "replicate",
      "storage_list": [{
        "type": "dummy",
        "mode": "always fail",
        "key": "1"
      }, {
        "type": "dummy",
        "mode": "always fail",
        "key": "2"
      }]
    });

    jio.post({
    }, util.spyJioCallback("status", 409, "2 Storages FAIL + FAIL = FAIL"));
    clock.tick(1000);

    util.closeAndcleanUpJio(jio);
  });

  test("Scenario", function () {
    expect(3);
    var clock = sinon.useFakeTimers(), jio = jIO.newJio({
      "type": "replicate",
      "storage_list": [{
        "type": "local",
        "username": "replicatestorage",
        "application_name": "scenar 1"
      }, {
        "type": "local",
        "username": "replicatestorage",
        "application_name": "scenar 2"
      }]
    });

    // post with id
    jio.post({"_id": "a"}, util.spyJioCallback("value", {
      "id": "a",
      "ok": true
    }, "Post with document id -> OK"));
    clock.tick(1000);

    // put
    jio.put({"_id": "a"}, util.spyJioCallback("value", {
      "id": "a",
      "ok": true
    }, "Put same document -> OK"));
    clock.tick(1000);

    // post same id
    jio.post({
      "_id": "a"
    }, util.spyJioCallback("status", 409, "Post with document id -> Conflict"));
    clock.tick(1000);

    util.closeAndcleanUpJio(jio);
  });

  test("Syncronization", function () {
    var clock = sinon.useFakeTimers(), jio = jIO.newJio({
      "type": "replicate",
      "conditions": {
        "modified": "latest date"
      },
      "storage_list": [{
        "type": "local",
        "username": "replicatestorage",
        "application_name": "sync 1"
      }, {
        "type": "local",
        "username": "replicatestorage",
        "application_name": "sync 2"
      }]
    }), sync_jio1 = jIO.newJio({
      "type": "local",
      "username": "replicatestorage",
      "application_name": "sync 1"
    }), sync_jio2 = jIO.newJio({
      "type": "local",
      "username": "replicatestorage",
      "application_name": "sync 2"
    });

    sync_jio1.put({"_id": "a", "modified": 123});
    sync_jio2.put({"_id": "a", "modified": 234});
    clock.tick(1000);

    sync_jio1.putAttachment({
      "_id": "a",
      "_attachment": "body",
      "_data": "one",
      "_mimetype": "text/plain"
    });
    sync_jio2.putAttachment({
      "_id": "a",
      "_attachment": "content",
      "_data": "<p>two</p>",
      "_mimetype": "text/html"
    });
    clock.tick(1000);

    jio.repair({"_id": "a"}, util.spyJioCallback("value", {
    }, "Synchronization"));
    clock.tick(1000);

    util.closeAndcleanUpJio(jio);
  });

}));
