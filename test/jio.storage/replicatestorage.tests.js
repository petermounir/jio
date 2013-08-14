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
    expect(1);
    var clock = sinon.useFakeTimers(), jio = jIO.newJio({
      "type": "replicate",
      "storage_list": [{
        "type": "dummy"
      }, {
        "type": "dummy",
        "mode": "always fail",
      }]
    });

    // post without id
    jio.post({}, function (err, response) {
      deepEqual(err || response, {
        "id": "document id a",
        "ok": true
      }, "2 Storages DONE + FAIL = DONE");
    });
    clock.tick(10000);

    util.closeAndcleanUpJio(jio);
  });

}));
