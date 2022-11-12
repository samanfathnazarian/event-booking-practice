const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');

//Schema is a constructor which takes a parameter of an object, that's why we do 'new'
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxLength: [40, 'A tour name must have less or equal then 40 characters'],
      minLength: [10, 'A tour name must have more or equal then 10 characters'],
      validate: {
        validator: function (value) {
          return validator.isAlpha(value, 'en-US', { ignore: ' ' });
        },
        message: 'Tour name must only contain characters.',
      },
    },
    slug: String,
    maxCapacity: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    //user doesn't need to enter this data, so not required
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.66666 46.6666, 47, 4.7 rounds to closer integer(NOT decimal)
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    // when on front page of website, it's required
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDate: {
      type: Date,
      required: [true, 'An event must have a startDate'],
    },
    // GeoJSON - must have type and coordinates
    location: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number], //must have coordinates
      address: String,
      description: String,
    },

    /*
    - subDocument inside array (child referencing, Event(parent) references User(child) )
    - Embedded document, each documnet gets a unique id. Whenever you define an object in an array, Mongoose creates a schema for it behind the scenes so it treats it as a subdocument. A consequence of this is that Mongoose will add an _id field to each object.
    - guides: Array //contains userId's
    */
    organiser: {
      type: mongoose.Schema.ObjectId, //mongoDB id
      ref: 'User', //can set ref to a model name, (referencing child which is user)
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    // id: false //stops getting 2 different ids, with names: 'id' & '_id'
  }
);

//indexes makes getting results faster
tourSchema.index({ price: 1, ratingsAverage: -1 }); //'1':acsending, '2':descending
tourSchema.index({ slug: 1 });
tourSchema.index({ location: '2dsphere' }); //allows geospatial queries for startLocation

//DOCUMENT MIDDLEWARE: runs before .save() and .create()(emits 'save' event)
tourSchema.pre('save', function (next) {
  //'this' points to created document
  this.slug = slugify(this.name, { lower: true });
  next();
});

//Virtual Populate, creates reviews[] on TourSchema
tourSchema.virtual('reviews', {
  //_id in localField is called tour in review model
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

//QUERY MIDDLEWARE:
//all strings that start with find (i.e works for findOne aswell)
tourSchema.pre(/^find/, function (next) {
  // tourSchema.pre('find', function(next) { // works for find not find one
  this.find({ secretTour: { $ne: true } });
  next();
});

/*
tourSchema.pre(/^find/, function (next) {
  //'this' points to current query
  this.populate({
    path: 'guides',
    select: '-__v', //-passwordChangedAt
  });

  next();
});
*/

//AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function (next) {
  // Hide secret tours in aggregation pipeline if geoNear is NOT used as 1st pipeline
  // essential as geoNear needs to be 1st item listed in an aggregation pipeline otherwise it won't work
  if (!(this.pipeline().length > 0 && '$geoNear' in this.pipeline()[0])) {
    //add to beginning of aggregation pipeline
    this.pipeline().unshift({
      $match: { secretTour: { $ne: true } },
    });
  }
  next();
});

const Tour = mongoose.model('Tour', tourSchema); //creates the collection

module.exports = Tour;
