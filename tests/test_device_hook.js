/*    Copyright 2016 Firewalla LLC
 *
 *    This program is free software: you can redistribute it and/or  modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict'

let chai = require('chai');
let should = chai.should;
let expect = chai.expect;
let assert = chai.assert;

let redis = require('redis');
let rclient = redis.createClient();

let async = require('asyncawait/async');
let await = require('asyncawait/await');

let sem = require('../sensor/SensorEventManager.js').getInstance();

let sample = require('./sample_data');

let Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

let muk = require('muk');

Promise.promisify(muk);

let Samba = require('../extension/samba/samba.js');
let samba = new Samba();

let DeviceHook = require('../hook/DeviceHook');
let deviceHook = new DeviceHook();
deviceHook.run();

let HostTool = require('../net2/HostTool.js')
let hostTool = new HostTool();

let Bootstrap = require('../net2/Bootstrap');

function delay(t) {
  return new Promise(function(resolve) {
    setTimeout(resolve, t)
  });
}

describe('DeviceHook', () => {

  describe('.NewDeviceHook', function() {
    this.timeout(15000);

    beforeEach((done) => {
      (async() =>{
        muk(samba, 'getSambaName', (ip) => {
          let entries = ip.split(".");
          let last = entries[entries.length - 1];
          return "samba" + last;
        })
        await Bootstrap.bootstrap()
        done();
      })();
    })

    afterEach((done) => {
      (async() =>{
        await sample.removeSampleHost()
        muk.restore();
        done();
      })();
    })

    it('should get the right samba name and store to redis', (done) => {
      (async() =>{
        sem.emitEvent({
          type: 'NewDeviceFound',
          host: sample.newDeviceHost,
          suppressAlarm: true
        })

        await delay(8000)

        let macEntry = await hostTool.getMACEntry(sample.hostMac)
        expect(macEntry.bname.slice(0,5)).to.equal('samba');
        done();
      })();
    })

  });

});
