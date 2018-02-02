//Data Generator
//node --max-old-space-size=4096 dataGenerator.js
var faker = require('faker');
var fs = require('fs');

//Generates a single fake event object using faker
var createEvent = (eventId) => {
  var eventObject = {};
  eventObject.event_ID = eventId;           
  eventObject.event_Start = Date.parse(faker.date.past());
  eventObject.event_End = Date.parse(faker.date.past());
  eventObject.event_IsClosed = 'false';
  eventObject.rider_ID = faker.random.number();
  eventObject.rider_Firstname = faker.name.firstName();
  eventObject.driver_ID = faker.random.number();
  eventObject.driver_Firstname = faker.name.firstName();
  eventObject.driver_Availability = 'true';
  eventObject.timestamp_Pickup = Date.parse(faker.date.recent());
  eventObject.timestamp_Dropoff = Date.parse(faker.date.recent());
  eventObject.geolocation_Pickup = `[${faker.address.latitude()}, ${faker.address.longitude()}]`;
  eventObject.geolocation_Dropoff = `[${faker.address.latitude()}, ${faker.address.longitude()}]`;
  eventObject.geolocation_SurgeZone = faker.random.number({min:0, max:200});
  eventObject.surge_Multiplier = faker.finance.amount(0, 8, 2);
  eventObject.price = faker.finance.amount(0, 200, 2);
  eventObject.success = 'true';       

  return eventObject;
};

//Creates a generated data object collection with event ids between min (inclusive) and max
var generateData = (min, max) => {
  var generatedData = '';
  for (var i = min; i < max; i++) {
    var ev = createEvent(i);
    generatedData += `${ev.event_ID},`+
      `${ev.event_Start},`+
      `${ev.event_End},`+
      `${ev.event_IsClosed},`+
      `${ev.rider_ID},`+
      `${ev.rider_Firstname},`+
      `${ev.driver_ID},`+
      `${ev.driver_Firstname},`+
      `${ev.driver_Availability},`+
      `${ev.timestamp_Pickup},`+
      `${ev.timestamp_Dropoff},`+
      `"${ev.geolocation_Pickup}",`+
      `"${ev.geolocation_Dropoff}",`+
      `${ev.geolocation_SurgeZone},`+
      `${ev.surge_Multiplier},`+
      `${ev.price},`+
      `${ev.success},\n`;
    // Logs every 100000 generations to console to quickly detect failures
    if(i % 100000 === 0) {
      console.log(`${i} completed...`)
    }
  }

  return generatedData;
};

// Takes the generated object and writes it to a data file template with an incremented number at the end
var writeData = function (data, fileNum) {
  console.log(`Attempting write of 1M objects to /dataOutput${fileNum}.csv`);
  fs.writeFileSync(`./dataOutput${fileNum}.csv`, data,);
  console.log(`dataOutput${fileNum}.csv written successfully`);
};

// Writes generated data in 1M record chunks to avoid running out of memory
var writeDataChunks = function(chunks) {
  var min = 1;
  var max = 1000000;
  for (let i = 0; i < chunks; i++) {
    console.log(`Generating File ${i}...`);
    var data = generateData(min, max)
    writeData(data, `${i}`);
    min += 1000000;
    max += 1000000;
  }
};

writeDataChunks(10);
