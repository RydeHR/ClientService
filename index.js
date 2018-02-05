//Koa server for client-facing API
const newRelic = require('newrelic');
require('dotenv').config();
const config = require('./config')
const route = require('koa-route');
const faker = require('faker');
const fs = require('fs');
const Koa = require('koa');
const app = new Koa();
const cassandra = require('cassandra-driver');
const uuidv4 = require('uuid/v4');

/*-- Connecting to cassandra database on localhost --*/
const client = new cassandra.Client({contactPoints: [config.database_url], keyspace: config.database_keyspace})
client.connect(function (err) {
  if(err) {
    console.log(err);
  };
});

/*-- Setting port for Koa server --*/
const port = config.serverPort;

//rider obj: {id: int:9, name: "string", location: [lat, long]}

class Event {
  constructor(rider) {
    this.eventId = uuidv4();
    this.eventStart = undefined;
    this.eventEnd = undefined;
    this.eventIsClosed = 'false';
    this.riderId = rider.id;
    this.riderName = rider.name;
    this.driverId = undefined;
    this.driverName = undefined;
    this.driverIsAvailable = undefined;
    this.timestampPickup = undefined;
    this.timestampDropoff = undefined;
    this.geolocationPickup = `${rider.location}`;
    this.geolocationDropoff = [undefined,undefined];
    this.surgeZone = undefined;
    this.surgeMulti = undefined;
    this.price = undefined;
    this.success = undefined;
  }
}

const rider = {
  signon: (ctx, rider) => {
    var now = new Date();
    riderObj = JSON.parse(rider);
    var event = new Event(riderObj);
    event.eventStart = Date.parse(now);
    ctx.response.code = 201;
    ctx.response.body = event.eventId;
    console.log('event stored in DBs, sent to services: ', event);

    //rider signs on and posts info to server
    //generate new event object and send event ID in response
    //fill event object with data
    //send event object to /location/signon
    //store event obj in redis as ID: obj
  },
  destination: (ctx, event, destination) => {
    const eventId = event.id
    const riderId = event.riderId;
    //read eventId from redis database and extract event Obj
    //copy location info into destination field of obj
    //send eventId and location to location/destination

  },
  accept: (ctx, event) => {
    //rider clicks booking button
    const riderId = event.riderId;
    const isBooking = event.success;

  },
  cancel: (ctx, event) => {
    //rider cancels instead of books at any point in transaction
    const riderId = event.riderId;
    const isBooking = event.success

  },
  ridehistory: (ctx, event) => {
    // console.log('logged');
    const eventId = event;
    const riderId = '111111111';

    let query = 'SELECT * FROM rides WHERE rider_id = 111111111';
    return new Promise ((resolve, reject) => {
      client.execute(query, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      ctx.body = results;
    })
  }
}

app.use(route.post('/ui/:rider/signon', rider.signon));
app.use(route.post('/ui/:event/:destination', rider.destination))
app.use(route.post('/ui/:event/accept', rider.accept));
app.use(route.post('/ui/:event/cancel', rider.cancel));
app.use(route.get('/ui/:event/ridehistory', rider.ridehistory));



app.listen(port, () => {
  console.log(`Server listening on https://localhost/${port}`)
});