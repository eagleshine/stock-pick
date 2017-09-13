const YahooFinanceAPI = require('yahoo-finance-data');
const express = require('express');
const open = require('open');
const apiDetails = require('./api_key');
const cache = require('memory-cache');
const csv = require('csvtojson');

const app = express();
const api = new YahooFinanceAPI(apiDetails);
const router = new express.Router();

const tickerCSVFiles = [
  __dirname + '/tickers/companylist-nasdaq.csv',
  __dirname + '/tickers/companylist-nyse.csv',
  __dirname + '/tickers/companylist-amex.csv'
];


function retrieveTickers(csvFile) {
  return new Promise((resolve, reject) => {
    var tickerArray = [];
    const pattern = /^.*(?:\/companylist-)(.*?)\.csv$/g;
    const match = pattern.exec(csvFile);
    const source = match[1];
    csv()
      .fromFile(csvFile)
      .on('json', (jsonObj) => {
        jsonObj.source = source;
        tickerArray.push(jsonObj);
      })
      .on('done', (error) => {
        console.log('Parsing done for csv: ' + csvFile);
        if (error) {
          reject([]);
        } else {
          resolve(tickerArray);
        }
      });
  });
}

function cacheTickers() {
  return new Promise((resolve, reject) => {
    var tickerArray = [];
    const promises = tickerCSVFiles.map((csvFile) => {
      return retrieveTickers(csvFile);
    });
    Promise.all(promises).then((values) => {
      values.forEach((value) => {
        tickerArray = tickerArray.concat(value);
      });
      tickerArray.forEach((ticker) => {
        ticker.id = ticker.Symbol;
      });
      cache.put('tickers', tickerArray);
      resolve(tickerArray);
    });
  });
}

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    version: 'v1',
    apis: router.stack
  });
});

/**
 * @desc Realtime Quote data
 * @example http://localhost:3000/api/quote/realtime/yhoo,aapl,msft
 */
router.get('/quote/realtime/:tickers', (req, res) => {
  api
    .getRealtimeQuotes(req.params.tickers)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * @desc Forex data
 * @example http://localhost:3000/api/forex/eurusd,gbpusd,cadusd
 */
router.get('/forex/:exchanges', (req, res) => {
  api
    .getForexData(req.params.exchanges)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * @desc News Headlines by ticker
 * @example http://localhost:3000/api/news/headlines/aapl
 */
router.get('/news/headlines/:ticker', (req, res) => {
  api
    .getHeadlinesByTicker(req.params.ticker)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * @desc Ticker search
 * @example http://localhost:3000/api/ticker/search/Apple%20Inc.?region=US&lang=en-US
 */
router.get('/ticker/search/:searchterm', (req, res) => {
  api
    .tickerSearch(req.params.searchterm, req.query.region, req.query.lang)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * NEW OR UPDATED IN v3
 */

/**
 * @desc intraday chart data (UPDATED)
 * @example http://localhost:3000/api/chart/intraday/AAPL?interval=2m&prePost=true
 */
router.get('/chart/intraday/:ticker', (req, res) => {
  api
    .getIntradayChartData(req.params.ticker, req.query.interval, req.query.prePost)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * @desc historical chart data (UPDATED)
 * @example http://localhost:3000/api/chart/historical/AAPL?interval=1d&range=1y
 */
router.get('/chart/historical/:ticker', (req, res) => {
  api
    .getHistoricalData(req.params.ticker, req.query.interval, req.query.range)
    .then(data => {
      let result = {}
      result.historicals = data.chart;
      result.historicals.id = req.params.ticker;
      res.json(result);
    })
    .catch(err => res.json(err));
});

/**
 * @desc company info
 * @example http://localhost:3000/api/ticker/info/AAPL
 */
router.get('/ticker/info/:ticker', (req, res) => {
 api
   .quoteSummary(req.params.ticker)
   .then(data => {
     let result = {};
     result.infos = data.quoteSummary;
     result.infos.id = req.params.ticker;
     res.json(result);
   })
   .catch(err => res.json(err));
});

/**
 * @desc option chain
 * @example http://localhost:3000/api/ticker/options/AAPL
 */
router.get('/ticker/options/:ticker', (req, res) => {
 api
   .optionChain(req.params.ticker)
   .then(data => res.json(data))
   .catch(err => res.json(err));
});

/**
 * @desc recommendations
 * @example http://localhost:3000/api/ticker/recommendations/AAPL
 */
router.get('/ticker/recommendations/:ticker', (req, res) => {
 api
   .recommendations(req.params.ticker)
   .then(data => res.json(data))
   .catch(err => res.json(err));
});

/**
 * @desc futures
 * @example http://localhost:3000/api/markets/futures?market=NQ=F
 *
 * S&P 500: ES=F
 * NASDAQ: NQ=F
 * DOW JONES: YM=F
 */
router.get('/markets/futures', (req, res) => {
  api
    .futures(req.query.market)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

/**
 * @desc futures
 * @example http://localhost:3000/api/markets/commodities?commodities=GC=F,SI=F,PL=F,HG=F
 */
router.get('/markets/commodities', (req, res) => {
  api
    .commodities(req.query.commodities)
    .then(data => res.json(data))
    .catch(err => res.json(err));
});

function extractSectors(tickers) {
  var sectors = new Set();
  tickers.forEach((ticker) => {
    sectors.add(ticker.Sector);
  });
  sectors.delete('n/a');
  var result = [];
  Array.from(sectors).forEach((sector, idx) => {
    result.push({
      id: idx,
      name: sector
    })
  })
  return result;
}

router.get('/sectors', (req, res) => {
  var sectors = cache.get('sectors');
  if (!sectors) {
    var tickers = cache.get('tickers');
    if (!tickers) {
      cacheTickers().then((values) => {
        sectors = extractSectors(values); 
        cache.put('sectors', sectors);
        res.json({
          sectors: sectors
        });
      });
      return;
    } else {
      sectors = extractSectors(tickers);
      cache.put('sectors', sectors);
    }
  }
  res.json({
    sectors: sectors
  });
});

router.get('/tickers', (req, res) => {
  const startIdx = +req.query['start'] || 0;
  const size = +req.query['size'] || 25;
  const sector = req.query['sector'] || null;
  console.log('start: ' + startIdx + '; size: ' + size + '; sector: ' + sector);

  var tickers = cache.get('tickers');
  var tickerArray = [];
  if (!tickers) {
    cacheTickers().then((values) => {
      res.json({
        tickers: values.slice(startIdx, startIdx + size)
      });
    });
  } else {
    res.json({
      tickers: tickers.slice(startIdx, startIdx + size)
    });
  }
});

// CORS control
app.use(function(req, res, next) {
  //res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "http://localhost:4200");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use('/api/v1', router);

// HTML page at : http://localhost:3000/
app.get('/', (req, res) => res.sendFile(__dirname + '/demo.html'));

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000/');
  console.log('API available at http://localhost:3000/api/v1');

  open('http://localhost:3000/');
});
