
// Parse setup
Parse.initialize("lgqSPxLEVRbJOPjo4reRqwZjwo6uywqMDivqHAfn", "vksdxe8mh23zaH2qzlyy6xr9ytEZVMZaiEAj5m8e");

// Generalized Backbone & Marionette extensions

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
      name: undefined,
      locationName: undefined
    }
  });

  var ItemCollection = Parse.Collection.extend({
    model: Item
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
      this.bindTo(this.model, "change", this.render);
    },
    events: {
      "click .edit-button": "startEdit",
      "taphold .collection-table-row-name": "startEdit",
      "change .name-input": "changeName",
      "blur .name-input": "endEdit"
    },
    startEdit: function() {
      this.model.set({editable: true});
    },
    changeName: function() {
      var val = this.$(".name-input").val();
      this.model.save({name: val}, {silent: true}); // will save but not re-render
    },
    endEdit: function() {
      this.model.save({editable: false});
      // this should cause a rerender, which should remove the text input box
    },
    focusEdit: function() {
      this.startEdit();
      this.$(".name-input").focus();
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
      // Find the first view whose model is editable
      var firstEditableView = _(this.children).find(function(view) {
        return view.model.get("editable");
      });

      if (firstEditableView) {
        firstEditableView.focusEdit();
      }
    }
  });

  // VIEW WIRING

  var itemCollectionView = new ItemCollectionView({
    el: $("#collection-table-body"),
    collection: filteredItems
  });

  // Note that this must be a click event or focus will not work.
  // Adding an item fires onItemAdded on the item collection view,
  // which focuses the editing field.
  $('#collection-new').click(function(evt) {
    items.add({editable: true});
    filteredItems.filter(null); // reset the filter
  });

  // INITIALIZE DATA

  locations.fetch();
  items.fetch();

});
