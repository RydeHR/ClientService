//Cassandra script generator
const fs = require('fs');

var output = '';

output += `create table rides_by_user(event_ID uuid, event_Start timestamp, event_End timestamp, event_isClosed boolean, rider_ID int, rider_Name text, driver_ID int, driver_Name text, driver_Is_Available boolean, timestamp_Pickup timestamp, timestamp_Dropoff timestamp, geolocation_Pickup list <float>, geolocation_Dropoff list <float>, surgeZone int, surge_Multi float, price decimal, success boolean, primary key(rider_ID, event_ID));\n`;
for(let i = 0; i < 100; i++){
  output +=`COPY rides_by_user(event_ID, event_Start, event_End, event_isClosed, rider_ID, rider_Name, driver_ID, driver_Name, driver_Is_Available, timestamp_Pickup, timestamp_Dropoff, geolocation_Pickup, geolocation_Dropoff, surgeZone, surge_Multi, price, success) FROM 'dataOutput${i}.csv' with delimiter =',';\n`
}

output+= `create table rides_by_rideID(event_ID uuid, event_Start timestamp, event_End timestamp, event_isClosed boolean, rider_ID int, rider_Name text, driver_ID int, driver_Name text, driver_Is_Available boolean, timestamp_Pickup timestamp, timestamp_Dropoff timestamp, geolocation_Pickup list <float>, geolocation_Dropoff list <float>, surgeZone int, surge_Multi float, price decimal, success boolean, primary key(event_ID));\n`;
for (let i = 0; i < 100; i++) {
  output += `COPY rides_by_rideID(event_ID, event_Start, event_End, event_isClosed, rider_ID, rider_Name, driver_ID, driver_Name, driver_Is_Available, timestamp_Pickup, timestamp_Dropoff, geolocation_Pickup, geolocation_Dropoff, surgeZone, surge_Multi, price, success) FROM 'dataOutput${i}.csv' with delimiter =',';\n`
}

fs.writeFileSync(`./data/cassandra.cql`, output);
console.log('CQL script generated successfully');

//navigate to /usr/local/Cellar/cassandra/3.11.1/bin/data