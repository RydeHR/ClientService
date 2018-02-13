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
    this.riderId = rider.riderId;
    this.riderName = rider.riderName;
    this.driverId = undefined;
    this.driverName = undefined;
    this.driverIsAvailable = undefined;
    this.timestampPickup = undefined;
    this.timestampDropoff = undefined;
    this.geoLocationPickup = rider.geoLocationPickup;
    this.geoLocationDropoff = [undefined,undefined];
    this.surgeZone = undefined;
    this.surgeMulti = undefined;
    this.price = undefined;
    this.success = undefined;
  }
}
/*--- 'rider' container for all user-facing routes ---*/
const rider = {
  /*--- Client signs on with app, generating a new session ---
    Request body requirement: {
      "riderId": int,
      "riderName": string,
      "geolocationPickup": tuple 
  }*/
  signOn: (ctx) => {
    let now = new Date();
    let e = new Event(ctx.request.body);
    e.eventStart = Date.parse(now);
    /*--- Send new event object to /location to find a driver in the area ---*/
    //console.log('Send event object {e} to /location/init');
    /*--- One insert statement per table that stores event data ---*/
    let query1 = `INSERT INTO rides_by_user (`+
    `event_id, event_start, rider_id, rider_name, geolocation_pickup) `+
    `VALUES (?, ?, ?, ?, ?)`;
    let query2 = `INSERT INTO rides_by_rideid (`+
    `event_id, event_start, rider_id, rider_name, geolocation_pickup) `+
    `VALUES (?, ?, ?, ?, ?)`;

    let eventProps = [e.eventId, e.eventStart, e.riderId, e.riderName, e.geoLocationPickup]
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
      //console.log('Event stored in DB');
      ctx.response.status = 201;
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
    let userObj = ctx.request.body;
    /*--- Send obj to /pricing to get destination-based price ---*/
    //console.log('Send {userObj} to pricing');
    /*--- Query db for session info ---*/
    return rider._eventDetails(riderId, userObj.eventId).then((results) => {
      let e = results;
      /*--- If the event exists and is open, then continue, else return a 404 to user ---*/
      if (e && !e.event_isclosed) {
        /*--- Update DB with dropoff location ---*/
        let query1 = `UPDATE rides_by_user SET geolocation_dropoff = ? WHERE rider_id = ? AND event_id = ?`;
        let query2 = `UPDATE rides_by_rideid SET geolocation_dropoff = ? WHERE event_id = ?`;
        let queries = [
          { query: query1, params: [userObj.geoLocationDropoff, riderId, userObj.eventId]},
          { query: query2, params: [userObj.geoLocationDropoff, userObj.eventId]}
        ];
        return new Promise ((resolve, reject) => {
          client.batch(queries, {prepare: true}, (err, results) => {
            if (err) { reject(err); }
            else { resolve(results); }
          })
        }).then((results) => {
          ctx.response.status = 200;
          ctx.body = 'Getting a price...';
        })
      } else {
        ctx.response.status = 404;
        ctx.body = 'No open session with that ID';
      }
    })
  },

  /*--- This function works around JS rounding errors on our location arrays ---
  Request body requirement: N/A; can only used internally
  */
  _floatHelper: (arrayOfFloats) => {
    var results = [];
    if (arrayOfFloats && Array.isArray(arrayOfFloats)) {
      for (var i = 0; i < arrayOfFloats.length; i++) {
        results.push(Math.round(parseFloat((arrayOfFloats[i] * Math.pow(10, 4)).toFixed(4))) / Math.pow(10, 4));
      }
      return results;
    } else {
      return arrayOfFloats;
    }
  },

  /*--- Query a session given riderId and eventId ---
    Request body requirement: N/A; can only used internally
    */
  _eventDetails: (riderId, eventId) => {
    /*--- Query db for session info ---*/
    let query = `SELECT * FROM rides_by_rideid WHERE event_id = ${eventId}`;
    return new Promise ((resolve, reject) => {
      client.execute(query, {prepare: true}, (err, results) => {
        if (err) { reject(err); }
        else { resolve(results); }
      })
    }).then((results) => {
    /*--- If exactly one result is found, return it, else return undefined ---*/
      if (results["rows"].length === 1 && results["rows"][0].rider_id.toString() === riderId) {
        var dropoffArr = rider._floatHelper(results["rows"][0]["geolocation_dropoff"]);
        var pickupArr = rider._floatHelper(results["rows"][0]["geolocation_pickup"]);
        results["rows"][0]["geolocation_dropoff"] = dropoffArr;
        results["rows"][0]["geolocation_pickup"] = pickupArr;
        return results["rows"][0];
      } else {
        console.log('Invalid userID / eventID combination or event not found');
        return undefined;
      }
    })
  },
  /*--- Close a booked session as success ---
    Request body requirement: {
      "eventId": uuid, 
  }*/
  accept: (ctx, riderId) => {
    let end = new Date();
    let eventObj = ctx.request.body;
    /*--- Call _eventDetails to query db for session info ---*/
    return rider._eventDetails(riderId, eventObj.eventId).then((results) => {
      e = results;
      if (e) {
        ctx.body = 'Driver dispatched';
        e.event_isclosed = true;
        e.success = true;
        e.event_end = Date.parse(end);
        //console.log('Send event object {e} to /events');
        let query1 = `UPDATE rides_by_user SET event_isclosed = ?, success = ?, event_end = ? WHERE rider_id = ? AND event_id = ?`;
        let query2 = `UPDATE rides_by_rideid SET event_isclosed = ?, success = ?, event_end = ? WHERE event_id = ?`;
        queries = [
          { query: query1, params: [e.event_isclosed, e.success, e.event_end, riderId, e.event_id]},
          { query: query2, params: [e.event_isclosed, e.success, e.event_end, e.event_id]}
        ];
        return new Promise ((resolve, reject) => {
          client.batch(queries, {prepare: true}, (err, results) => {
            if (err) { reject(err); }
            else { resolve(results); }
          })
        })
      /*--- Return 404 if session not found ---*/
      } else {
        ctx.response.status = 404;
        ctx.body = 'No open session with that ID';
      }
    })
  },
  /*--- Cancel an in-progress session at any time ---
    Request body requirement: {
      "eventId": uuid, 
  }*/
  cancel: (ctx, riderId) => {
    let end = new Date();
    let eventObj = ctx.request.body;
    /*--- Call _eventDetails to query db for session info ---*/
    return rider._eventDetails(riderId, eventObj.eventId).then((results) => {
      e = results;
      if (e) {
        ctx.body = 'Session canceled';
        e.event_isclosed = true;
        e.success = false;
        e.eventEnd = Date.parse(end);
        //console.log('Send event object {e} to /events');
        let query1 = `DELETE FROM rides_by_user WHERE rider_id = ? AND event_id = ?`;
        let query2 = `DELETE FROM rides_by_rideid WHERE event_id = ?`;
        queries = [
          { query: query1, params: [riderId, e.event_id]},
          { query: query2, params: [e.event_id]}
        ];
        return new Promise ((resolve, reject) => {
          client.batch(queries, {prepare: true}, (err, results) => {
            if (err) { reject(err); }
            else { resolve(results); }
          })
        })
      } else {
        /*--- Return 404 if session not found ---*/
        ctx.response.status = 404;
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
      if (results) {
        ctx.response.status = 200;
        ctx.body = results;
      } else {
        ctx.response.status = 404;
        ctx.body = 'Invalid session / No rides found for that user ID';
      }
    })
  },
  /*--- Lookup an indivdual ride from its eventId UUID attribute ---
    Request body requirement: {
      "eventId": uuid
  }*/
  rideLookup: (ctx, riderId, eventId) => {
    return rider._eventDetails(riderId, eventId).then((results) => {
      if (results) {
        ctx.response.status = 200;
        ctx.body = results;
      } else {
        ctx.response.status = 404;
        ctx.body = 'No event found with that rider ID / event ID combination'
      }
    })
  }
}

/* Configure app routes on server */
app.use(route.post('/ui/signon', rider.signOn));
app.use(route.patch('/ui/:rider/destination', rider.destination));
app.use(route.patch('/ui/:rider/accept', rider.accept));
app.use(route.delete('/ui/:rider/cancel', rider.cancel));
app.use(route.get('/ui/:rider/ridehistory', rider.rideHistory));
app.use(route.get('/ui/:rider/:eventId', rider.rideLookup));

/* Start server */
app.listen(port, () => {
  console.log(`Server listening on https://localhost/${port}`)
});

module.exports.rider = rider;
