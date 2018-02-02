//Koa server for client-facing API
const route = require('koa-route');
var faker = require('faker');
var fs = require('fs');
const Koa = require('koa');
const app = new Koa();

const port = 5000;

const db = {
  Dillon: {name: 'Dillon', laptop: 'Apple Macbook Air'},
  Nick: {name: 'Nick', laptop: 'Dell Laptop'},
  Jackie: {name: 'Jackie', laptop: 'Lenovo ThinkPad'}
}

const group = {
  list: (ctx) => {
    const names = Object.keys(db);
    ctx.body = 'group: ' + names.join(', ');
  },

  computer: (ctx, name) => {
    const member = db[name];
    if (!member) {
      return ctx.throw('Cannot find that group member', 404);
    }
    ctx.body = `${member.name} has a ${member.laptop}.`
  }

}

const rider = {
  signOn: (ctx, rider) => {
    const location = rider.location;
    const userId = rider.id;
    //rider signs on and posts info to server
    //generate new session object and send session ID in response
    //fill session object with data
    //send session object to /location/signOn
    //store session obj in redis as ID: obj
  },
  destination: (ctx, rider, destination) => {
    const location = rider.location
    const userId = rider.id;
    //read sessionId from redis database and extract session Obj
    //copy location info into destination field of obj
    //send sessionId and location to location/destination

  },
  accept: (ctx, rider) => {
    const userId = rider.id;
    const isBooking = rider.booking;
  },
  cancel: (ctx, rider) => {
    const userId = rider.id;
    const isBooking = rider.booking

  }
}

app.use(route.get('/group', group.list));
app.use(route.get('/group/:name', group.computer));
/* real routes go here */
app.use(route.post('ui/:rider/signon', rider.signOn));
app.use(route.post('ui/:rider/:destination', rider.destination))
app.use(route.post('ui/:rider/accept', rider.accept));
app.use(route.post('ui/:rider/cancel'), rider.cancel);


app.listen(port, () => {
  console.log(`Server listening on https://localhost/${port}`)
});