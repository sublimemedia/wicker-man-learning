(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'module', 'bluebird', '@sublimemedia/api-connector', '@sublimemedia/wicker-man-utilities', '@sublimemedia/wicker-man-content', '@sublimemedia/wicker-man-bee'], factory);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    factory(exports, module, require('bluebird'), require('@sublimemedia/api-connector'), require('@sublimemedia/wicker-man-utilities'), require('@sublimemedia/wicker-man-content'), require('@sublimemedia/wicker-man-bee'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, mod, global.Promise, global.apiConnector, global.wickerManUtilities, global.WMContent, global.WMBee);
    global.WMLearning = mod.exports;
  }
})(this, function (exports, module, _bluebird, _sublimemediaApiConnector, _sublimemediaWickerManUtilities, _sublimemediaWickerManContent, _sublimemediaWickerManBee) {
  'use strict';

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

  var _Promise = _interopRequireDefault(_bluebird);

  var _WMContent2 = _interopRequireDefault(_sublimemediaWickerManContent);

  var _WMBee = _interopRequireDefault(_sublimemediaWickerManBee);

  var endEvents = ['beforeunload', 'unload'];

  function listenerAction() {
    this.exit.call(this);

    endEvents.forEach(listener.bind(this, 'removeEventListener'));
  }

  function listener(funcName, eName) {
    window[funcName](eName, listenerAction.bind(this), false);
  }

  var WMLearning = (function (_WMContent) {
    _inherits(WMLearning, _WMContent);

    function WMLearning() {
      _classCallCheck(this, WMLearning);

      _WMContent.call(this);

      this.storeUpResolve = new _WMBee['default']();
      this.storeUpReject = new _WMBee['default']();

      this.store = {};
      this.scoreMeta = {};
      this.observed = {};
      this.storeUpdated = new _Promise['default']((function (resolve, reject) {
        this.storeUpResolve.onValue(resolve);
        this.storeUpReject.onValue(reject);
      }).bind(this));

      endEvents.forEach(listener.bind(this, 'addEventListener'));
    }

    WMLearning.prototype.connect = function connect(vocab, apis) {
      var _this = this;

      this.vocab = vocab;
      this.sco = new _sublimemediaApiConnector.Connect(this.vocab, apis);

      this.sco.initialized.then(function (val) {
        return _this.get('ss');
      }).then(function (val) {
        if (val) {
          _this.store = val;
          _this.storeUpResolve.set(val);
        } else {
          _this.storeUpReject.set(val);
        }
      })['catch'](this.storeUpReject.set);

      return this;
    };

    WMLearning.prototype.get = function get() {
      var prop = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

      var storeVal = (0, _sublimemediaWickerManUtilities.getFromPath)(prop, this.store);

      if (typeof storeVal !== 'undefined') {
        return _Promise['default'].resolve(storeVal);
      }

      return this.sco.get(prop);
    };

    WMLearning.prototype.set = function set(prop, value) {
      if (typeof prop === 'string') {
        var storeVal = (0, _sublimemediaWickerManUtilities.getFromPath)(prop, this.store, true);
        var _status = undefined;

        if (typeof storeVal.value !== 'undefined') {
          var meta = (0, _sublimemediaWickerManUtilities.getFromPath)(prop, this.scoreMeta),
              test = meta.test && typeof meta.test === 'function' ? meta.test() : true;

          if (test) {
            storeVal.parent[storeVal.key] = value;
          }

          _status = _Promise['default'][test ? 'resolve' : 'reject']();
        } else {
          _status = this.sco.set(prop, value);
        }

        return _status.then((function () {
          this.fireObservers(prop, value);
        }).bind(this));
      } else if (typeof prop === 'object') {
        return _Promise['default'].all(this, Object.keys(prop).map(function (key) {
          return this.set(key, prop[key]);
        }, this));
      } else {
        return _Promise['default'].reject();
      }
    };

    WMLearning.prototype.defineScore = function defineScore(score) {
      var _this2 = this;

      var prop = score.property;

      if (score && typeof score === 'object' && prop) {
        var newScorePath = (0, _sublimemediaWickerManUtilities.createPath)(prop, this.scoreMeta);

        (0, _sublimemediaWickerManUtilities.extend)(true, newScorePath, score);

        this.storeUpdated['catch'](function () {
          var newStorePath = (0, _sublimemediaWickerManUtilities.createPath)(prop, _this2.store, true);

          newStorePath.parent[newStorePath.key] = 0;
        });
      }

      return this;
    };

    WMLearning.prototype.getDefinedScore = function getDefinedScore(prop) {
      var _this3 = this;

      var score = {
        total: 0,
        completed: 0
      };

      var container = (0, _sublimemediaWickerManUtilities.getFromPath)(prop, this.store);

      if (typeof container === 'object') {
        score = Object.keys(container).map(function (key) {
          return _this3.getDefinedScore(container[key]);
        }).reduce(function (prev, current) {
          prev.total += 1;

          if (current.total && current.total === current.completed) {
            prev.completed += 1;
          }

          return prev;
        });
      } else if (typeof prop === 'number' || typeof container === 'number') {
        score.total += 1;

        if (typeof prop === 'number' && prop || typeof container === 'number' && container) {
          score.completed += 1;
        }
      }

      return score;
    };

    WMLearning.prototype.updateCompletion = function updateCompletion() {
      var _this4 = this;

      var total = 0,
          completed = 0,
          toSet = [];

      Object.keys(this.store).forEach(function (key) {
        var scored = _this4.getDefinedScore(key);

        total += scored.total;
        completed += scored.completed;
      });

      toSet = [['ss', this.store], ['score', completed / total * 100], ['scoreRaw', completed], ['scoreMax', total], ['scoreMin', 0], ['scoreScaled', completed / total]];

      if (this.location) {
        toSet.push(['location', typeof this.location === 'function' ? this.location() : this.location]);
      }

      return this.sco.get('lessonStatus').then((function (val) {
        var _this5 = this;

        if (val !== this.vocab.completed) {
          var complete = completed / total * 100 >= (this.completionThreshold || 100);

          toSet.push(['lessonStatus', complete ? this.vocab.completed : this.vocab.incomplete]);
          toSet.push(['successStatus', complete ? this.vocab.passed : this.vocab.failed]);
        }

        return _Promise['default'].all(toSet.map(function (args) {
          return _this5.sco.set.apply(null, args);
        }));
      }).bind(this));
    };

    WMLearning.prototype.exit = function exit(e) {
      return this.updateCompletion().then(this.sco.exit).then(function () {
        return 'Course Exited';
      })['catch'](function () {
        return 'Error Exiting';
      });
    };

    return WMLearning;
  })(_WMContent2['default']);

  module.exports = WMLearning;
});