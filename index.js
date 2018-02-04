//Koa server for client-facing API
const route = require('koa-route');
const faker = require('faker');
const fs = require('fs');
const Koa = require('koa');
const app = new Koa();
const cassandra = require('cassandra-driver');
const uuidv4 = require('uuid/v4');

/*-- Connecting to cassandra database on localhost --*/
const client = new cassandra.Client({contactPoints: ['127.0.0.1'], keyspace: 'rydeclient'})
client.connect(function (err) {
  if(err) {
    console.log(err);
  };
});

/*-- Setting port for Koa server --*/
const port = 5000;

/*-- Testing Koa with details below, will remove for final implementation --*/

// const db = {
//   Dillon: {name: 'Dillon', laptop: 'Apple Macbook Pro'},
//   Jackie: {name: 'Jackie', laptop: 'Lenovo ThinkPad'},
//   Mark: {name: 'Nick', laptop: 'Apple Macbook Pro'},
//   Nick: {name: 'Nick', laptop: 'Dell Laptop'}
// }

// const group = {
//   list: (ctx) => {
//     const names = Object.keys(db);
//     ctx.body = 'group: ' + names.join(', ');
//   },

//   computer: (ctx, name) => {
//     const member = db[name];
//     if (!member) {
//       return ctx.throw('Cannot find that group member', 404);
//     }
//     ctx.body = `${member.name} has a ${member.laptop}.`
//   }

// }

/*-- End Koa testing details --*/

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
    ctx.response.body = event.eventId;
    console.log('event stored in DBs, sent to services: ', event);

    //rider signs on and posts info to server
    //generate new session object and send session ID in response
    //fill session object with data
    //send session object to /location/signOn
    //store session obj in redis as ID: obj
  },
  destination: (ctx, event, destination) => {
    const eventId = event.id
    const riderId = session.riderId;
    //read sessionId from redis database and extract session Obj
    //copy location info into destination field of obj
    //send sessionId and location to location/destination

  },
  accept: (ctx, session) => {
    //rider clicks booking button
    const riderId = session.riderId;
    const isBooking = session.success;

  },
  cancel: (ctx, session) => {
    //rider cancels instead of books at any point in transaction
    const riderId = session.riderId;
    const isBooking = session.success

  },
  ridehistory: (ctx, session) => {
    // console.log('logged');
    const sessionId = session;
    const riderId = '111111111';

    let query = 'SELECT * FROM sessions WHERE rider_id = 111111111';
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

/*-- Koa testing routes below --*/
// app.use(route.get('/group', group.list));
// app.use(route.get('/group/:name', group.computer));
/*-- Koa testing routes end --*/
app.use(route.post('/ui/:rider/signon', rider.signon));
app.use(route.post('/ui/:session/:destination', rider.destination))
app.use(route.post('/ui/:session/accept', rider.accept));
app.use(route.post('/ui/:session/cancel', rider.cancel));
app.use(route.get('/ui/:session/ridehistory', rider.ridehistory));

app.listen(port, () => {
  console.log(`Server listening on https://localhost/${port}`)
});