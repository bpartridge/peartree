
// Parse setup
Parse.initialize("lgqSPxLEVRbJOPjo4reRqwZjwo6uywqMDivqHAfn", "vksdxe8mh23zaH2qzlyy6xr9ytEZVMZaiEAj5m8e");

var debugWrap = function(obj, attr, pause) {
  var oldFunc = obj[attr];
  obj[attr] = function() {
    if (pause) debugger;
    var rval = oldFunc.apply(this, arguments);
    console.log(attr, arguments, "->", rval);
  }
}

// Generalized jQuery, Backbone, Marionette extensions

// Quicker taphold sensitivity
$.event.special.tap.tapholdThreshold = 250;

$.mobile.getZoomRatio = function() {
  return parseFloat($('body').css('zoom'));
}

$.mobile.getScreenHeight = function() {
  var old = window.innerHeight || $( window ).height();
  return old / $.mobile.getZoomRatio();
}
debugWrap($.mobile, "getScreenHeight");

// Work around an obscure Chrome bug.
// http://bugs.jquery.com/ticket/11663
// https://code.google.com/p/chromium/issues/detail?id=104397
// (function($) {
//   var empty = $.fn.empty;
//   $.fn.empty = function() {
//     try { empty.apply(this, arguments); }
//     catch (error) {}
//     return this;
//   }
// })(jQuery);

// Fix item insertion order
Backbone.Marionette.CollectionView.prototype.appendHtml =
function(collectionView, itemView, index) {
  var children = collectionView.$el.children();
  if (index < children.size()) {
    itemView.$el.insertBefore(children[index]);
  }
  else {
    itemView.$el.appendTo(collectionView.el);
  }
}

// Setup shed finder
$(function() {

  // DATA CLASS DECLARATIONS

  var Location = Parse.Object.extend({
    className: "ShedLocation",
    disabled_validate: function(attrs) {
      if (!attrs.name) return "must have a name";
      // Note that these fail if the values are NaN (null or undefined)
      if (!(attrs.left >= 0) || !(attrs.top >= 0) ||
          !(attrs.width >= 0) || !(attrs.height >= 0)) {
        return "must have nonnegative left, top, width, height";
      }
    },
    containsPoint: function(x, y) {
      var dict = this.toJSON();
      var test = x >= dict.left && x < dict.left + dict.width &&
        y >= dict.top && y < dict.top + dict.height;
      return test;
    }
  });

  var LocationCollection = Parse.Collection.extend({
    model: Location
  });

  var Item = Parse.Object.extend({
    className: "ShedItem",
    disabled_initialize: function() {
      if (!this.has("name")) this.set({name: null}, {silent: true});
      if (!this.has("locationName")) this.set({locationName: null}, {silent: true});
    },
    disabled_validate: function(attrs) {
      if (!attrs.locationName) {
        return "must have a location name";
      }
      if (!attrs.name) {
        return "must have a name";
      }
      // if (!locations.any(function(location) {
      //       return attrs.locationName == location.name;
      //     })) 
      // {
      //   return "has an unknown location name";
      // }
    },
    defaults: {
      name: null,
      locationName: null
    }
  });

  var ItemCollection = Parse.Collection.extend({
    model: Item
  });

  // VIEW CLASS DECLARATIONS

  var ItemRowView = Backbone.Marionette.ItemView.extend({
    tagName: "tr",
    template: "#item-template",
    initialize: function() {
      this.bindTo(this.model, "startEdit", this.startEdit, this);
      this.bindTo(this.model, "endEdit", this.endEdit, this);
      this.bindTo(this.model, "change", this.render, this);

      // debugWrap(this, "handleRemoveRequest");
      // debugWrap(this, "remove");
    },
    mixinTemplateHelpers: function(data) {
      return _.extend({}, {
        editing: this.editing,
        name: null,
        locationName: null
      }, data);
    },
    events: {
      "click .edit-button": "startEdit",
      "taphold .item-name": "startEdit",
      "change .name-input": "changeName",
      "blur .name-input": "endEdit",
      "keypress .name-input": "handleKeypress",
      "click .item-remove": "handleRemoveRequest"
    },
    startEdit: function() {
      this.debug("startEdit");
      this.editing = true;
      this.render();
    },
    changeName: function() {
      this.debug("changeName");
      var val = this.$(".name-input").val();
      this.model.save({name: val}, {silent: true});
      // because it is silent, it will save but not re-render
    },
    endEdit: function() {
      this.debug("endEdit");
      if (!this.editing) return;

      this.model.save();
      this.editing = false;

      // Work around this Webkit issue.
      // It may introduce a memory leak but at this point I don't care.
      /*
      https://code.google.com/p/chromium/issues/detail?id=104397

      Suppose you remove an element X with removeChild, 
      and that triggers an event (eg, blur), 
      and the event removes that very element X. 
      Should removeChild return success (by returning X), 
      or should it throw an "element not found" exception?
      Currently it does the latter.
      */
      this.el.innerHTML = "";

      this.render();
      // this should cause a rerender, which should remove the text input box
    },
    handleKeypress: function(evt) {
      if (evt.charCode == 13) { // RETURN
        var ni = this.$(".name-input");
        ni.val(ni.val().trim());
        ni.blur(); // fires endEdit
        evt.preventDefault();
      }
    },
    handleRemoveRequest: function(evt) {
      // debugger;
      this.model.destroy();
    },
    // onRender is called after the template has been rendered.
    onRender: function() {
      this.debug("render");
      if (this.editing) {
        this.debug("focusing");
        this.$(".name-input").focus();
      }

      var thisView = this;
      thisView.$(".item-drag-handle").draggable({
        helper: function(evt) {
          // A conundrum wrapped in an enigma, wrapped in pastry, wrapped in a lie.
          // Clone this table row and wrap it in a table and a div.
          // From the clone, remove edit and removal buttons.
          // Also, add a reference to the Backbone model in the data.
          return thisView.$el.clone()
            .find('.edit-button, td:gt(2)').remove().end()
            .wrap('<tbody>').parent()
            .wrap('<table>').parent()
            .wrap('<div>').parent().addClass('drag-helper')
            .data('model', thisView.model)
            .data('originalLocationName', thisView.model.get("locationName") || "");
        },
        appendTo: "body",
        cursorAt: {left: -5, top: -5},
        start: function(evt, ui) {
          thisView.model.trigger("drag", thisView.model, evt, ui);
        },
        drag: function(evt, ui) {
          thisView.model.trigger("drag", thisView.model, evt, ui);
        },
        stop: function(evt, ui) {
          thisView.model.trigger("drag", thisView.model, evt, ui);
        }
      });
    },
    debug: function(text) {
      forge.logging.debug("ItemRowView for " + this.model.id + ": " + text)
    }
  });

  var ItemCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: "tbody",
    itemView: ItemRowView,
    // This is called once for each member on a reset
    onItemAdded: function(itemView) {},
    // This is called after every reset, but not after each add
    onRender: function() {}
  });

  var LocationView = Backbone.Marionette.ItemView.extend({
    tagName: "div",
    className: "landscape-location",
    initialize: function() {
      if (!this.model) throw "LocationView must have a model.";

      this.bindTo(this.model, "change", this.render, this);

      var LOCATION_CLASS = ".item-location";
      var thisView = this;

      // this.$el.hover(function() {
      //   $(this).stop().animate({opacity: 0.8})
      // }, function() {
      //   $(this).stop().animate({opacity: 0})
      // }).mouseleave(); // immediately trigger exit
    },
    events: {
      "click": "useAsFilter"
    },
    render: function() {
      var thisView = this;

      var origHeight = 480, origWidth = 672, /* TODO: don't hard-code this */
        elHeight = $('.landscape-container').height(),
        elWidth = $('.landscape-container').width(),
        ratio = elHeight / origHeight,
        leftOff = (elWidth - origWidth * ratio) / 2;

      // console.log(ratio);

      var attrs = this.model.attributes;
      var setCSS = function(attr, val) {
        if (!isNaN(val)) thisView.$el.css(attr, (val || 0) + "px");
      }

      setCSS('left', attrs.left * ratio + leftOff);
      setCSS('top', attrs.top * ratio);
      setCSS('width', attrs.width * ratio);
      setCSS('height', attrs.height * ratio);

      if (this.model.has('zIndex')) this.$el.css('z-index', this.model.get('zIndex'));

      // this.el.innerHTML = this.model.get("name");
    },
    useAsFilter: function(evt) {
      this.model.trigger("useAsFilter", this.model, evt);
    },
    debug: function(text) {
      forge.logging.debug("LocationView: " + text);
    }
  });

  var LocationCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: "div",
    itemView: LocationView
  });

  // DATA INSTANCES

  var locations = new LocationCollection();
  var items = new ItemCollection();
  var filteredItems = new Parse.FilteredCollection(null, {
    fullCollection: items
  });
  // debugWrap(filteredItems, "setFilter");
  // debugWrap(filteredItems, "_forceAddModel");
  // debugWrap(filteredItems, "_forceRemoveModel");
  // debugWrap(filteredItems, "_onModelEvent");

  // VIEW WIRING

  var itemCollectionView = new ItemCollectionView({
    el: $("#item-table tbody").get(0),
    collection: filteredItems
  });

  // Note that this must be a click event or focus will not work.
  var newButton = $('#item-new');
  newButton.on("click", function(evt) {
    forge.logging.debug("newButton tap");

    items.each(function(item) {
      item.trigger("endEdit");
    });

    items.add({}, {at: 0});
    items.at(0).trigger("startEdit").save();
  });

  var locationCollectionView = new LocationCollectionView({
    el: $(".landscape-container").get(0),
    collection: locations
  });

  items.on("drag", function(item, startEvt, startUi) {
    // Filter only for drag starts
    if (startEvt.type !== 'dragstart') return;

    var originalLocationName = item.get("locationName");
    var offset = locationCollectionView.$el.offset();

    var _debug = function(text) {
      // forge.logging.debug("Dragging " + item.id + ": " + text)
    }
    _debug("starting");

    var dragHandler = function(_unusedItem, evt, ui) {
      var $helperLocName = ui.helper.find(".item-location");
      var relX = evt.pageX - offset.left;
      var relY = evt.pageY - offset.top;
      _debug("relX " + relX + " relY " + relY);

      var dragLoc = _(locationCollectionView.children).chain()
        .filter(function(view) {
          var viewPos = view.$el.position(),
            viewWidth = view.$el.width(),
            viewHeight = view.$el.height();

          return relX >= viewPos.left &&
            relX < viewPos.left + viewWidth &&
            relY >= viewPos.top &&
            relY < viewPos.top + viewHeight;
        })
        .pluck('model')
        .max(function(model) {
          return model.get('zIndex');
        })
        .value();

      // Broken version not using DOM:
      // var dragLoc = locations.find(function(loc) {
      //   return loc.containsPoint(relX, relY);
      // });

      if (dragLoc) {
        _debug("dragLoc " + dragLoc.id);
        $helperLocName.text(dragLoc.get('name') || "");

        if (evt.type == 'dragstop') {

          if (dragLoc.has('restriction')) {
            alert(dragLoc.get('restriction'));
          }
          else {
            _debug("saving");
            item.save({locationName: dragLoc.get('name')});
          }
        }
      }
      else {
        _debug("resetting");
        $helperLocName.text(originalLocationName || "");
      }

      if (evt.type == 'dragstop') {
        _debug("removing dragHandler");
        item.off("drag", dragHandler);
      }
    }
    item.on("drag", dragHandler);
  });

  var searchField = $('#collection-search');
  searchField.on('change keyup', function(evt) {
    var val = searchField.val();
    forge.logging.debug("searchField: " + val + " <- " + evt.type);
    if (!val || val == "") {
      filteredItems.setFilter(false);
    }
    else if (val.indexOf("@") == 0) {
      var locationName = val.substring(1);
      filteredItems.setFilter(function(item) {
        return item.get('locationName') === locationName;
      });
    }
    else {
      var lval = val.toLowerCase();
      filteredItems.setFilter(function(item) {
        return (item.get('name') || "").toLowerCase().indexOf(lval) >= 0 ||
          (item.get('locationName') || "").toLowerCase().indexOf(lval) >= 0;
      });
    }
    forge.logging.debug("  searchField done")
  });

  locations.on("useAsFilter", function(location) {
    var locationName = location.get("name");
    forge.logging.debug("useAsFilter: " + locationName);
    // searchField.val("");
    // searchField.keyup();
    searchField.val("@" + locationName);
    searchField.keyup(); // ensure the clear button is shown
  });

  // INITIALIZE DATA

  locations.fetch({
    success: function() {
      forge.logging.debug("locations fetched");
    }
  });
  items.fetch({
    success: function() {
      forge.logging.debug("items fetched");
    }
  });

});
