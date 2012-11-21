(function() {
  var root = this;

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = root._;
  if (!_) _ = require('underscore');

  // Require Backbone, if we're on the server, and it's not already present
  var Backbone = root.Parse || root.Backbone;
  if (!Backbone) {
    try {
      Backbone = require('backbone');
      if (!Backbone) throw "Could not require backbone";
    } catch (e) {
      Backbone = require('parse');
      if (!Backbone) throw "Could not require backbone or parse";
    }
  }

  var DEBUG = function() {}
  if (true && typeof(console) != null) {
    DEBUG = function() {console.log.apply(console, ["FilteredCollection"].concat(arguments))}
  }

  var nullFilter = function() {return true;}

  var _proto = Backbone.Collection.prototype;

  Backbone.FilteredCollection = Backbone.Collection.extend({

    initialize: function(_unusedModels, options) {
      if (!options) throw "FilteredCollection needs options";
      if (!options.fullCollection) throw "FilteredCollection needs initial fullCollection";
      this.fullCollection = options.fullCollection;
      this.fullCollection.on("add", this._onFullAdd, this);
      this.fullCollection.on("remove", this._onFullRemove, this);
      this.fullCollection.on("reset", this._onFullReset, this);

      this.filterModel = options.filterModel || new (Backbone.Model || Backbone.Object)();
      this.filterModel.on("change:filter", this._onChangeFilter, this);

      // Setup convenience functions
      var _this = this;
      this.setFilter = this.applyFilter = function(filter) {
        _this.filterModel.set("filter", filter);
        return this;
      }
      this.getFilter = function() {
        return _this.filterModel.get("filter");
      }
    },

    _getFilterFunc: function() {
      var filter = this.getFilter();
      if (!filter) return function() {
        return true;
      };
      else if (_.isFunction(filter)) return filter;
      else if (_.isObject(filter)) return function(value) {
        for (var key in attrs) {
          if (attrs[key] !== value[key]) return false;
        }
        return true;
      };
      else throw "Invalid filter";
    },

    _onFullAdd: function(model, fullCollection, options) {
      var filter = this.getFilter() || nullFilter;
      if (!this.getByCid(model) && filter(model)) {
        _proto.add.call(this, model, {at: 0});
      }
    },

    _onFullRemove: function(model, fullCollection, options) {
      var filter = this.getFilter() || nullFilter;
      if (this.getByCid(model)) {
        _proto.remove.call(this, model);
      }
    },

    _onFullReset: function() {
      var filter = this.getFilter() || nullFilter;
      var items = this.fullCollection.filter(filter);
      this.reset(items);
    },

    _onChangeFilter: function() {
      return this._onFullReset();

      // DEBUG("_onChangeFilter");
      // var filter = this.getFilter() || nullFilter;
      // var _this = this;

      // // Remove failing models we have.
      // this.each(function(model) {
      //   if (!filter(model)) {
      //     DEBUG("remove", model);
      //     _proto.remove.call(_this, model);
      //   }
      // });

      // // Prepend passing models we don't already have.
      // this.fullCollection.each(function(model) {
      //   if (filter(model) && !_this.getByCid(model)) {
      //     DEBUG("add", model);
      //     _proto.add.call(_this, model, {at: 0});
      //   }
      // });
    }
  });

}).call(this);
