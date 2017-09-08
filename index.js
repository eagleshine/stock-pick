#!/usr/bin/env node
'use strict';

const figlet = require('figlet');
const YahooFinanceAPI = require('yahoo-finance-data');
const apiDetails = require('./api_key');

const api = new YahooFinanceAPI(apiDetails);


figlet('Stock Pick!', function(err, data) {
    if (err) {
            console.log('Something went wrong...');
            console.dir(err);
            return;
        }
    console.log(data)
});

api
  .getHistoricalData('NVDA', '1d', '5d')
  .then(data => console.log(JSON.stringify(data, null, 4)))
  .catch(err => console.log(JSON.stringify(err, null, 4)));

api
  .getIntradayChartData('NVDA', '2m', true)
  .then(data => console.log(JSON.stringify(data, null, 4)))
  .catch(err => console.log(JSON.stringify(err, null, 4)));
