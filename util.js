define(['underscore'], function(_) {
    "use strict";

    // String.endsWith Polyfill for IE.
    // Source: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
    if (!String.prototype.endsWith) {
      String.prototype.endsWith = function(searchString, position) {
          var subjectString = this.toString();
          if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
          }
          position -= searchString.length;
          var lastIndex = subjectString.indexOf(searchString, position);
          return lastIndex !== -1 && lastIndex === position;
      };
    }

    // Differs from the underscore `find` in that this version will return
    // the first non-falsy result, instead of an item from `collection`.
    // Synonymous to: _.filter(_.map(collection, predicate))[0]
    function find(collection, predicate, context) {
        for (var i = 0; i < collection.length; i++) {
            var found = predicate.call(context, collection[i]);
            if (found) {
                return found;
            }
        }
        return undefined;
    }

    function urljoin() {
        return _.reduce(arguments, function(a, b) {
            a = a + '';
            b = b + '';
            if (a.endsWith('/')) {
                return a + b;
            }
            return a + '/' + b;
        });
    }

    return {
        find: find,
        urljoin: urljoin
    };
});
