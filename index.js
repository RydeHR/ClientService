//Koa server for client-facing API

/*--- Packages and configuration --- */
const newRelic = require('newrelic');
require('dotenv').config();
const config = require('./config')
const route = require('koa-route');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const app = new Koa();
const cassandra = require('cassandra-driver');
const uuidv4 = require('uuid/v4');

app.use(bodyParser());

/*-- Connect to Cassandra database --*/
const client = new cassandra.Client({contactPoints: [config.database_url], keyspace: config.database_keyspace})
client.connect(function (err) {
  if(err) {
    console.log(err);
  };
});

/*-- Set port for Koa server --*/
const port = config.serverPort;

/*--- Event constructor for building sessions ---*/
class Event {
  constructor(rider) {
    this.eventId = uuidv4();
    this.eventStart = undefined;
    this.eventEnd = undefined;
    this.eventIsClosed = false;
    this.riderId = rider.id;
    this.riderName = rider.name;
    this.driverId = undefined;
    this.driverName = undefined;
    this.driverIsAvailable = undefined;
    this.timestampPickup = undefined;
    this.timestampDropoff = undefined;
    this.geolocationPickup = rider.location;
    this.geolocationDropoff = [undefined,undefined];
    this.surgeZone = undefined;
    this.surgeMulti = undefined;
    this.price = undefined;
    this.success = undefined;
  }
}

const rider = {
  /*--- Client signs on with app, generating a new session ---
    Request body requirement: {
      "riderId": int,
      "riderName": string,
      "geoLocationPickup": tuple 
  }*/
  signon: (ctx) => {
    let now = new Date();
    let e = new Event(ctx.request.body);
    e.eventStart = Date.parse(now);
    /*--- Send new event object to /location to find a driver in the area ---*/
    console.log('Sending event to /location/init\n', e);
    /*--- One insert statement per table that stores event data ---*/
    let query1 = `INSERT INTO rides_by_user (`+
    `event_id, event_start, rider_id, rider_name, geolocation_pickup) `+
    `VALUES (?, ?, ?, ?, ?)`;
    let query2 = `INSERT INTO rides_by_rideid (`+
    `event_id, event_start, rider_id, rider_name, geolocation_pickup) `+
    `VALUES (?, ?, ?, ?, ?)`;

    let eventProps = [e.eventId, e.eventStart, e.riderId, e.riderName, e.geolocationPickup]
    let queries = [
      {query: query1, params: eventProps},
      {query: query2, params: eventProps}
    ];
    /*--- Call to database using promise, response sends back event ID ---*/
    return new Promise ((resolve, reject) => {
      client.batch(queries, {prepare: true}, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      console.log('event stored in DBs: \n', e);
      ctx.response.code = 200;
      ctx.body = `${e.eventId}`;
    })
  },

  /*--- Add dropoff location to open session ---
    Request body requirement: {
      "eventId": uuid, 
      "geoLocationPickup": tuple, 
      "geoLocationDropoff": tuple
  }*/
  destination: (ctx, riderId) => {
    let obj = ctx.request.body;
    /*--- Send obj to /pricing to get destination-based price ---*/
    console.log('send to pricing: ', obj);
    /*--- Update DB with dropoff location ---*/
    let query1 = `UPDATE rides_by_user SET geolocation_dropoff = ? WHERE rider_id = ? AND event_id = ?`;
    let query2 = `UPDATE rides_by_rideid SET geolocation_dropoff = ? WHERE event_id = ?`;
    let queries = [
      { query: query1, params: [obj.geoLocationDropoff, obj.riderId, obj.eventId]},
      { query: query2, params: [obj.geoLocationDropoff, obj.eventId]}
    ];
    return new Promise ((resolve, reject) => {
      client.batch(queries, {prepare: true}, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      console.log('This should call /locations now\n');
      ctx.response.code = 200;
      ctx.body = 'Getting a price...';
    })

  },

  /*--- Close a session as success (if booked) OR ---
    --- as incomplete / canceled (if not booked)  ---
    Request body requirement: {
      "eventId": uuid, 
      "success": boolean
  }*/
  closeSession: (ctx, riderId) => {
    let end = new Date();
    let userObj = ctx.request.body;
    console.log('userObj: ', userObj)
    // Query db for session info
    let query = `SELECT * FROM rides_by_rideid WHERE event_id = ${userObj.eventId}`;
    return new Promise ((resolve, reject) => {
      client.execute(query, {prepare: true}, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      let e = results["rows"][0];
      /*--- If the event is open, close it, else return a 404 to user ---*/
      if (!e.event_isclosed) {
        e.event_isclosed = true;
        e.success = userObj.success;
        e.eventEnd = Date.parse(end);
        console.log('sending event object to /events\n', e);
        ctx.response.code = 200;
        let queries = [];
        /*--- Check if client booked, dispatch driver and update event for later lookup ---*/
        if (e.success) {
          ctx.body = 'Driver dispatched';
          let query1 = `UPDATE rides_by_user SET event_isclosed = ?, success = ? WHERE rider_id = ? AND event_id = ?`
          let query2 = `UPDATE rides_by_rideid SET event_isclosed = ?, success = ? WHERE event_id = ?`
          queries = [
            { query: query1, params: [e.event_isclosed, e.success, riderId, e.event_id]},
            { query: query2, params: [e.event_isclosed, e.success, e.event_id]}
          ];
        } else {
          /*--- If client didn't book a ride, the session is closed and deleted without booking ---*/
          ctx.body = 'Session canceled';
          let query1 = `DELETE FROM rides_by_user WHERE rider_id = ? AND event_id = ?`
          let query2 = `DELETE FROM rides_by_rideid WHERE event_id = ?`
          queries = [
            { query: query1, params: [riderId, e.event_id]},
            { query: query2, params: [e.event_id]}
          ];
        }
          return new Promise ((resolve, reject) => {
            client.batch(queries, {prepare: true}, (err, results) => {
              if (err) { reject(err); }
              else { resolve(results); }
            })
          }).then((results) => {
            console.log('DB transaction results: ', results)
          })
      } else {
        ctx.response.code = 404;
        ctx.body = 'No open session with that ID';
      }
    })
  },

  /*--- Lookup a rider's ride history ---  
    Request body requirement: {
      "eventId": uuid
  }*/
  rideHistory: (ctx, riderId) => {
    let query = `SELECT * FROM rides_by_user WHERE rider_id = ${riderId}`;
    return new Promise ((resolve, reject) => {
      client.execute(query, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      ctx.response.code = 200;
      ctx.body = results;
    })
  },
  /*--- Lookup an indivdual ride from its eventId UUID attribute ---
    Request body requirement: {
      "riderId": int
  }*/
  rideLookup: (ctx, eventId) => {
    let query = `SELECT * FROM rides_by_rideid WHERE event_id = ${eventId}`;
    return new Promise ((resolve, reject) => {
      client.execute(query, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
      ctx.response.code = 200;
      ctx.body = results;
    })
  }
}

/* Configure app routes on server */
app.use(route.post('/ui/signon', rider.signon));
app.use(route.patch('/ui/:rider/destination', rider.destination));
app.use(route.patch('/ui/:rider/closeSession', rider.closeSession));
// app.use(route.patch('location/update-driver', internal.updateDriver));
app.use(route.get('/ui/:rider/ridehistory', rider.rideHistory));
app.use(route.get('/ui/:event', rider.rideLookup));

/* Start server */
app.listen(port, () => {
  console.log(`Server listening on https://localhost/${port}`)
});