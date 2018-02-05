//Data Generator
//node --max-old-space-size=4096 dataGenerator.js
var faker = require('faker');
var fs = require('fs');
var uuidv4 = require('uuid/v4');

/* Create the users we'll use for the fake data in multiple tables */
var createUsers = (number) => {
  var userList = [
  /* hardcode 4 users for testing purposes */
    ['111111111','Dillon'],
    ['222222222','Jackie'],
    ['333333333','Mark'],
    ['444444444','Nick']
  ];
  for (let i = 4; i < number; i++) {
    var dateSeed = Date.now();
    dateSeed = dateSeed.toString().slice(-5);
    var id = dateSeed + faker.random.number({min: 1000, max: 9999});
    var name = faker.name.firstName();
    userList.push([id, name]);
  }
  return userList;
};

/* Using 100K riders and 10K riders for the 10M record db */
var riders = createUsers(100000);
var drivers = createUsers(10000);

/* Output rider list to file to later add as separate table in db */
var createRiderTable = (riderList) => {
  var output = '';
  for (var i = 0; i < riderList.length; i++) {
    output += `${riderList[i][0]},${riderList[i][1]}\n`;
  }

  return output;
};

var formattedRiders = createRiderTable(riders);

/* Generates a single fake event object using faker */
var createEvent = () => {
  var eventObject = {};
  /* project requirement is dates from the past 3 months, so this will
   * use that timeframe on creation of data 
   */
  var threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  var now = new Date();

  var rideLength = faker.random.number({min: 10*60*1000, max: 30*60*1000});
  var pickupWait = faker.random.number({min: 4*60*1000, max: 10*60*1000});
  var eventLength = faker.random.number({min: pickupWait + rideLength, max: pickupWait + rideLength + 5*60*1000});

  var rider = riders[faker.random.number({min: 0, max: riders.length - 1})];
  var driver = drivers[faker.random.number({min: 0, max: drivers.length - 1})];

  eventObject.eventId = uuidv4();
  eventObject.eventStart = Date.parse(faker.date.between(threeMonthsAgo, now));
  eventObject.eventEnd = eventObject.eventStart + eventLength;
  eventObject.eventIsClosed = 'true';
  eventObject.riderId = rider[0];
  eventObject.riderName = rider[1];
  eventObject.driverId = driver[0];
  eventObject.driverName = driver[1];
  eventObject.driverIsAvailable = 'true';
  eventObject.timestampPickup = eventObject.eventStart + pickupWait;
  eventObject.timestampDropoff = eventObject.timestampPickup + rideLength;
  eventObject.geolocationPickup = `[${faker.address.latitude()}, ${faker.address.longitude()}]`;
  eventObject.geolocationDropoff = `[${faker.address.latitude()}, ${faker.address.longitude()}]`;
  eventObject.surgeZone = faker.random.number({min: 0, max: 200});
  eventObject.surgeMulti = faker.finance.amount(0, 8, 2);
  eventObject.price = faker.finance.amount(0, 200, 2);
  eventObject.success = 'true';

  return eventObject;
};

//Creates a generated data object collection with event ids between min (inclusive) and max
var generateEvents = (min, max) => {
  var generatedData = '';
  for (let i = min; i <= max; i++) {
    var ev = createEvent();
    generatedData += `${ev.eventId},`+
      `${ev.eventStart},`+
      `${ev.eventEnd},`+
      `${ev.eventIsClosed},`+
      `${ev.riderId},`+
      `${ev.riderName},`+
      `${ev.driverId},`+
      `${ev.driverName},`+
      `${ev.driverIsAvailable},`+
      `${ev.timestampPickup},`+
      `${ev.timestampDropoff},`+
      `"${ev.geolocationPickup}",`+
      `"${ev.geolocationDropoff}",`+
      `${ev.surgeZone},`+
      `${ev.surgeMulti},`+
      `${ev.price},`+
      `${ev.success}\n`;
    // Logs every 100000 generations to console to quickly detect failures
    if(i % 100000 === 0) {
      console.log(`${i} completed...`)
    }
  }

  return generatedData;
};

// Takes the generated object and writes it to a data file template with an incremented number at the end
var writeData = function (data, fileName, fileNum) {
  console.log(`Attempting write of objects to /data/${fileName}${fileNum}.csv`);
  fs.writeFileSync(`./data/${fileName}${fileNum}.csv`, data,);
  console.log(`${fileName}${fileNum}.csv written successfully`);
};

// Writes generated data in 1M record chunks to avoid running out of memory
var writeDataChunks = function(chunks) {
  var start = new Date();
  var min = 1;
  var max = 1000000;
  for (let i = 0; i < chunks; i++) {
    console.log(`Generating File ${i}...`);
    var data = generateEvents(min, max)
    writeData(data, 'dataOutput', `${i}`);
    min += 1000000;
    max += 1000000;
  }
  var end = new Date();
  var duration = end - start;
  var minutes = Math.floor(duration / 60000);
  var seconds = ((duration % 60000) / 1000).toFixed(0);
  console.log(`Completed in ${(seconds == 60 ? (minutes + 1) + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds)}`)
};

writeData(formattedRiders, 'riderTable', '');

writeDataChunks(10);


/*
create table rides_by_user(event_ID uuid, event_Start timestamp, event_End timestamp, event_isClosed boolean, rider_ID int, rider_Name text, driver_ID int, driver_Name text, driver_Is_Available boolean, timestamp_Pickup timestamp, timestamp_Dropoff timestamp, geolocation_Pickup list <float>, geolocation_Dropoff list <float>, surgeZone int, surge_Multi float, price decimal, success boolean, primary key(rider_ID, event_ID));
COPY rides_by_user(event_ID, event_Start, event_End, event_isClosed, rider_ID, rider_Name, driver_ID, driver_Name, driver_Is_Available, timestamp_Pickup, timestamp_Dropoff, geolocation_Pickup, geolocation_Dropoff, surgeZone, surge_Multi, price, success) FROM '/usr/local/Cellar/cassandra/3.11.1/bin/dataOutput0.csv' with delimiter =',';

create table riders(rider_ID int, rider_Name text, primary key(rider_ID));
COPY riders (rider_ID, riderName) FROM '/usr/local/Cellar/cassandra/3.11.1/bin/riderTable.csv' with delimiter =',';

create table rides_by_rideID(event_ID uuid, event_Start timestamp, event_End timestamp, event_isClosed boolean, rider_ID int, rider_Name text, driver_ID int, driver_Name text, driver_Is_Available boolean, timestamp_Pickup timestamp, timestamp_Dropoff timestamp, geolocation_Pickup list <float>, geolocation_Dropoff list <float>, surgeZone int, surge_Multi float, price decimal, success boolean, primary key(event_ID));
COPY rides_by_rideID(event_ID, event_Start, event_End, event_isClosed, rider_ID, rider_Name, driver_ID, driver_Name, driver_Is_Available, timestamp_Pickup, timestamp_Dropoff, geolocation_Pickup, geolocation_Dropoff, surgeZone, surge_Multi, price, success) FROM '/usr/local/Cellar/cassandra/3.11.1/bin/dataOutput0.csv' with delimiter =',';


*/