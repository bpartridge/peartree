
// Parse setup
Parse.initialize("lgqSPxLEVRbJOPjo4reRqwZjwo6uywqMDivqHAfn", "vksdxe8mh23zaH2qzlyy6xr9ytEZVMZaiEAj5m8e");

// Generalized Backbone & Marionette extensions

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

function makeFilteredCollection(collection){
  var filtered = new collection.constructor();

  filtered.filter = function(criteria){
    var items;
    if (criteria){
      items = collection.where(criteria);
    } else {
      items = collection.models;
    }
    filtered.reset(items);
  };
  collection.on("change", function(model){
    filtered.reset(collection.models);
  });
  collection.on("reset", function(){
    filtered.reset(collection.models);
  });            

  return filtered;
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
    }
  });

  var ItemCollection = Parse.Collection.extend({
    model: Item
    // makeOneEditable: function() {
    //   var toEdit = undefined;
    //   // Make the first unnamed item editable, and all other items uneditable
    //   this.each(function(item) {
    //     if (!toEdit && (!item.has("name") || item.get("name") == "")) {
    //       toEdit = item;
    //     }
    //     else {
    //       item.set({editable: false});
    //     }
    //   });
    //   // If there was not such an item, make a new one at the beginning.
    //   if (!toEdit) {
    //     this.unshift({editable: true});
    //   }
    // }
  });

  // DATA INSTANCES

  var locations = new LocationCollection();
  var items = new ItemCollection();
  var filteredItems = makeFilteredCollection(items);

  // VIEW CLASS DECLARATIONS

  var ItemRowView = Backbone.Marionette.ItemView.extend({
    tagName: "tr",
    template: "#collection-table-row-template",
    initialize: function() {
      // If a model was given with attributes, we don't edit.
      var hasAttributes = this.model && _(this.model.attributes).size() > 0;
      this.debug("initialize attributes:" + JSON.stringify(this.model.attributes));
      this.editing = !hasAttributes;

      this.bindTo(this.model, "change", this.render);
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
      "taphold .collection-table-row-name": "startEdit",
      "change .name-input": "changeName",
      "blur .name-input": "endEdit",
      "keypress .name-input": "handleKeypress"
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
    // onRender is called after the template has been rendered.
    onRender: function() {
      this.debug("render");
      if (this.editing) {
        this.debug("focusing");
        this.$(".name-input").focus();
      }

      var thisView = this;
      thisView.$el.draggable({
        handle: ".collection-table-row-draggable",
        helper: function(evt) {
          // A conundrum wrapped in an enigma, wrapped in pastry, wrapped in a lie.
          // Clone this table row and wrap it in a table and a div.
          // Also, add a reference to the Backbone model in the data.
          return thisView.$el.clone()
            .wrap('<tbody>').parent()
            .wrap('<table>').parent()
            .wrap('<div>').parent().addClass('drag-helper')
            .data('model', thisView.model)
            .appendTo('body');
        }
      })
    },
    debug: function(text) {
      forge.logging.debug("ItemRowView for " + this.model.id + ": " + text)
    }
  });

  var ItemCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: "tbody",
    itemView: ItemRowView,
    // This is called once for each member on a reset
    onItemAdded: function(itemView) {
    },
    // This is called after every reset, but not after each add
    onRender: function() {
      // // Find the first view whose model is editable
      // var firstEditableView = _(this.children).find(function(view) {
      //   return view.model.get("editable");
      // });

      // if (firstEditableView) {
      //   firstEditableView.focusEdit();
      // }
    }
  });

  // VIEW WIRING

  var itemCollectionView = new ItemCollectionView({
    el: $("#collection-table tbody"),
    collection: items
  });

  // Note that this must be a click event or focus will not work.
  var newButton = $('#collection-new');
  newButton.on("click", function(evt) {
    forge.logging.debug("newButton tap");

    items.add({}, {at: 0});
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
