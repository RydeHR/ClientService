//Chai test package for Koa routes

/*--- Packages and configuration --- */
const chai = require('chai');
const chaiHttp = require('chai-http');
const assert = chai.assert;
const should = chai.should();
const cassandra = require('cassandra-driver');
const server = require('../../index.js');
const config = require('../../config')

chai.use(chaiHttp);
chai.use(require('chai-uuid'));

/*--- Database connection--- */
const client = new cassandra.Client({contactPoints: [config.database_url], keyspace: config.database_keyspace})
client.connect(function (err) {
  if(err) {
    console.log(err);
  };
});

/*--- Unit tests ---*/
describe('Routes', ()=> {
  describe('User opens the app and sends riderId, riderName, and pickup location to server', () => {
    it('Should return a unique UUID to the user after a POST to signon', (done) => {
      chai.request('http://127.0.0.1:5000')
      .post('/ui/signon')
      .set('Content-Type', 'application/json')
      .send({riderId: 333333333, riderName: 'Mark', geolocationPickup: [12.3456, 12.3456]})
      .end((err, res) => {
        res.should.have.status(201);
        res.text.should.be.a('string');
        res.text.length.should.be.eql(36);
        res.text.should.be.a.uuid('v4');
        done();
      });
    })
  })
  describe('User sends destination location to server', () => {
    it('Should update the database with the new destination', (done) => {
      chai.request('http://127.0.0.1:5000')
      .post('/ui/signon')
      .set('Content-Type', 'application/json')
      .send({riderId: 333333333, riderName: 'Mark', geoLocationPickup: [12.3456, 12.3456]})
      .end((err, res) => {
        if(err) {
          throw err;
        } else {
          var eventUUID = res.text;
          chai.request('http://127.0.0.1:5000')
          .patch('/ui/333333333/destination')
          .set('Content-Type', 'application/json')
          .send({eventId: eventUUID, geoLocationPickup: [12.3456, 12.3456], geoLocationDropoff: [87.6543, 87.6543]})
          .end((err, res) => {
            if(err) {
              throw err;
            } else {
              chai.request('http://127.0.0.1:5000')
              .get(`/ui/333333333/${eventUUID}`)
              .end((err, res) => {
                res.should.have.status(200);
                Array.isArray(res.body.geolocation_dropoff).should.equal(true);
                res.body.geolocation_dropoff.should.have.lengthOf(2);
                res.body.geolocation_dropoff[0].should.be.a('number');
                res.body.geolocation_dropoff[1].should.be.a('number');
                done();
              })
            }
          })
        }
      })
    })
  })
  describe('User accepts price and books ride', () => {
    it('Should close the event and set the success flag to true', (done) => {
      chai.request('http://127.0.0.1:5000')
      .post('/ui/signon')
      .set('Content-Type', 'application/json')
      .send({riderId: 333333333, riderName: 'Mark', geoLocationPickup: [12.3456, 12.3456]})
      .end((err, res) => {
        if(err) {
          throw err;
        } else {
          var eventUUID = res.text;
          chai.request('http://127.0.0.1:5000')
          .patch('/ui/333333333/destination')
          .set('Content-Type', 'application/json')
          .send({eventId: eventUUID, geoLocationPickup: [12.3456, 12.3456], geoLocationDropoff: [87.6543, 87.6543]})
          .end((err, res) => {
            if(err) {
              throw err;
            } else {
              chai.request('http://127.0.0.1:5000')
              .patch('/ui/333333333/accept')
              .send({eventId: eventUUID})
              .end((err, res) => {
                if (err) {
                  throw err;
                } else {
                  chai.request('http://127.0.0.1:5000')
                  .get(`/ui/333333333/${eventUUID}`)
                  .end((err, res) => {
                    if (err) {
                      throw err;
                    } else {
                      res.body.event_isclosed.should.equal(true);
                      res.body.success.should.equal(true);
                      done();
                    }
                  })
                }
              })
            }
          })
        }
      })
    })
  })
  describe('User cancels booking', () => {
    it('Should close the session and throw a 404 if user looks it up', (done) => {
      chai.request('http://127.0.0.1:5000')
      .post('/ui/signon')
      .set('Content-Type', 'application/json')
      .send({riderId: 333333333, riderName: 'Mark', geoLocationPickup: [12.3456, 12.3456]})
      .end((err, res) => {
        if(err) {
          throw err;
        } else {
          var eventUUID = res.text;
          chai.request('http://127.0.0.1:5000')
          .delete('/ui/333333333/cancel')
          .set('Content-Type', 'application/json')
          .send({eventId: eventUUID})
          .end((err, res) => {
            if(err) {
              throw err;
            } else {
              chai.request('http://127.0.0.1:5000')
              .get(`/ui/333333333/${eventUUID}`)
              .end((err, res) => {
                res.should.have.status(404);
                done();
              })
            }
          })
        }
      })
    })
  })
  describe('User looks up ride history', () => {
    it('Should return an array of ride objects', (done) => {
      chai.request('http://127.0.0.1:5000')
      .post('/ui/signon')
      .set('Content-Type', 'application/json')
      .send({riderId: 333333333, riderName: 'Mark', geoLocationPickup: [12.3456, 12.3456]})
      .end((err, res) => {
        if(err) {
          throw err;
        } else {
          var eventUUID = res.text;
          chai.request('http://127.0.0.1:5000')
          .get('/ui/333333333/ridehistory')
          .set('Content-Type', 'application/json')
          .send({eventId: eventUUID})
          .end((err, res) => {
            res.should.have.status(200);
            Array.isArray(res.body.rows).should.equal(true);
            for(var i = 0; i < res.body.rows.length; i++) {
              res.body.rows[i].rider_id.should.equal(333333333);
            }
            done();
          });
        }
      })
    })
  })
})
