#!/usr/bin/node node

/**
 *  Put your settings here:
 *      - db_user: mysql user
 *      - db_pwd: mysql password
 *      - db_name: database name imported database.sql
 *      - mail_user: gmail address
 *      - mail_pwd: gmail password
 *      - from: your gmail address entered in mail_user
 *      - to: email address to receive alerts
 */

var mysql = require("promise-mysql");
var request = require("request");
var nodemailer = require("nodemailer");

require('dotenv').config();
const env = process.env;

worker =
{
   db_server: env.db_server,
   db_user: env.db_user,
   db_pwd:  env.db_pwd,
   db_name: env.db_name,

   mail_server: env.mail_server,
   mail_port:   env.mail_port,
   mail_secure: env.mail_secure,
   mail_user:   env.mail_user,
   mail_pwd:    env.mail_pwd,

   status_stopped: 0,
   status_running: 1,
   status_error: 2,

   log_level_debug: 1,
   log_level_info: 2,

   rate_source_dex: 1,
   rate_source_bcm: 2,

   asset_btc: 3,
   asset_usd: 4,

   logLevel: 1,
   db: null,
   assets: [],
   tickers: null,
   lastUsdUpdate: null,

   init: function()
   {
      worker.log("----- BEGIN ------", worker.log_level_info);
      worker.log("start initializing...", worker.log_level_info);

      worker.getArguments().then(function()
      {
         return worker.dbConnect();
      }).then(function()
      {
         return worker.getConfig();
      }).then(function()
      {
         return worker.setStatus(worker.status_running);
      }).then(function()
      {
         worker.log("init finished -> start working really...", worker.log_level_info);
         worker.doit();
      }).catch(function(e)
      {
         // don't set error status if tried to start but current status is running or error
         if(typeof e !== 'undefined' && e == false)
         {
            if(worker.db)
            {
               worker.db.end();
            }
         }
         else
         {
            return worker.setStatus(worker.status_error).then(function()
            {
               if(worker.db)
               {
                  worker.db.end();
               }

               worker.sendMail("dex: an error occurred", "please check.").then(function()
               {
               }).catch(function()
               {
               });

               worker.log("ERROR: init failed!", worker.log_level_info);
            }).catch(function(e)
            {
               if(worker.db)
               {
                  worker.db.end();
               }

               worker.sendMail("dex: an error occurred", "please check.").then(function()
               {
               }).catch(function()
               {
               });

               worker.log("ERROR: init failed!", worker.log_level_info);
            });
         }
      });
   },

   doit: function()
   {
      worker.log("start working...", worker.log_level_info);

      worker.updateAssets().then(function()
      {
         return worker.cleanupRates();
      }).then(function()
      {
         return worker.updateRates();
      }).then(function()
      {
         return worker.updateBcmRates();
      }).then(function()
      {
         return worker.updateUsdVolume();
      }).then(function()
      {
         return worker.setStatus(worker.status_stopped);
      }).then(function()
      {
         worker.log("great, all done!", worker.log_level_info);
         worker.db.end();
      }).catch(function()
      {
         return worker.setStatus(worker.status_error).then(function()
         {
            worker.db.end();

            worker.sendMail("dex: an error occurred", "please check.").then(function()
            {
            }).catch(function()
            {
            });

            worker.log("ERROR: doit failed!", worker.log_level_info);
         }).catch(function(e)
         {
            worker.db.end();

            worker.sendMail("dex: an error occurred", "please check.").then(function()
            {
            }).catch(function()
            {
            });

            worker.log("ERROR: doit failed!", worker.log_level_info);
         });
      });
   },

   getArguments: function()
   {
      worker.log("start getting arguments...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         for(var i = 0; i < process.argv.length; i++)
         {
         }

         resolve();
      });
   },

   dbConnect: function()
   {
      worker.log("start connecting to db...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         mysql.createConnection(
         {
            host: worker.db_server,
            user: worker.db_user,
            password: worker.db_pwd,
            database: worker.db_name
         }).then(function(conn)
         {
            worker.db = conn;
            worker.log("db connection established -> next", worker.log_level_info);
            resolve();
         }).catch(function(error)
         {
            worker.log("ERROR: db connection couldn't be established: " + error, worker.log_level_info);
            reject();
         });
      });
   },

   getConfig: function()
   {
      worker.log("start getting config...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "select * from config";

         worker.db.query(query).then(function(rows)
         {
            worker.log("all config got -> next", worker.log_level_info);
            resolve();
         }).catch(function(error)
         {
            worker.log("ERROR: config couldn't be selected: " + error, worker.log_level_info);
            reject();
         });
      });
   },

   cleanupRates: function()
   {
      worker.log("begin cleaning up rates...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "delete from rate where datediff(now(), timestamp) > 31";

         worker.db.query(query).then(function()
         {
            worker.log("cleaning up rates finished -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: deleting rates failed: " + e, worker.log_level_info);
            reject();
         }); 
      });  
   }, 

   updateAssets: function()
   {
      worker.log("begin updating assets...", worker.log_level_info);

      function updateMarketId(asset, tickers)
      {
         return new Promise(function(resolve, reject)
         {
            if(asset.id_bcm == null)
            {
               for(var i = 0; i < tickers.length; i++)
               {
                  if(asset.symbol == tickers[i].symbol)
                  {
                     var id_market = tickers[i].id;
                     break;
                  }
               }

               if(id_market)
               {
                  var query = "update asset set id_bcm = '" + id_market + "' where id_asset = " + asset.id_asset;

                  worker.db.query(query).then(function()
                  {
                     resolve();
                  }).catch(function(e)
                  {
                     worker.log("ERROR: asset couldn't be updated: " + e, worker.log_level_info);
                     reject();
                  });
               }
               else
               {
                  resolve();
               }
            }
            else
            {
               resolve();
            }
         });
      }

      function workOnSymbol(symbol)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "update asset set symbol = '" + symbol.symbol + "' where id_waves = '" + symbol.assetID + "'";

            worker.db.query(query).then(function()
            {
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: asset couldn't be updated: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      function workOnAssets(asset)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "insert into asset(id_waves, name, decimals) values('" + asset.id + "', '" + worker.mysql_real_escape_string(asset.name) + "', " + asset.decimals + ") on duplicate key update decimals = " + asset.decimals;

            worker.db.query(query).then(function(result)
            {
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: asset couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      function getAllAssets()
      {
         return new Promise(function(resolve, reject)
         {
            var query = "select id_asset, id_waves as id, id_bcm, symbol, decimals from asset";

            worker.db.query(query).then(function(assets)
            {
               resolve(assets);
            }).catch(function(e)
            {
               worker.log("ERROR: assets couldn't be selected: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         worker.requestData("http://marketdata.wavesplatform.com/api/tickers").then(function(tickers)
         {
            worker.tickers = tickers;
            var assets = [];
            var assetsOut = [];

            for(var i = 0; i < tickers.length; i++)
            {
               var ticker = tickers[i];

               if(ticker['24h_volume'] > 0)
               {
                  var asset = {id: ticker.amountAssetID, name: ticker.amountAssetName, decimals: ticker.amountAssetDecimals};
                  assets[asset.id] = asset;

                  var asset = {id: ticker.priceAssetID, name: ticker.priceAssetName, decimals: ticker.priceAssetDecimals};
                  assets[asset.id] = asset;
               }
            }

            for(id in assets)
            {
               assetsOut.push(assets[id]);
            }

            worker.sequentialize(assetsOut, workOnAssets).then(function()
            {
               worker.requestData("http://marketdata.wavesplatform.com/api/symbols").then(function(symbols)
               {
                  Promise.all(symbols.map(workOnSymbol)).then(function()
                  {
                     getAllAssets().then(function(assets)
                     {
                        for(var i = 0; i < assets.length; i++)
                        {
                           worker.assets[assets[i].id] = assets[i];
                        }

                        worker.requestData("https://api.coinmarketcap.com/v1/ticker/").then(function(tickers)
                        {
                           Promise.all(assets.map(function(asset){return updateMarketId(asset, tickers);})).then(function()
                           {
                              worker.log("update assets finished -> next", worker.log_level_info);
                              resolve();
                           }).catch(function(e)
                           {
                              worker.log("ERROR: updateAssets failed!", worker.log_level_info);
                              reject();
                           });
                        }).catch(function(e)
                        {
                           worker.log("ERROR: bcm tickers couldn't be requested", worker.log_level_info);
                           worker.sendMail("dex: an error occurred", "bcm tickers couldn't be requested. please check.");
                           resolve();
                        });
                     }).catch(function(e)
                     {
                        worker.log("ERROR: updateAssets failed!", worker.log_level_info);
                        reject();
                     });
                  }).catch(function(e)
                  {
                     worker.log("ERROR: updateAssets failed!", worker.log_level_info);
                     reject();
                  });
               }).catch(function(e)
               {
                  worker.log("ERROR: dex symbols couldn't be requested", worker.log_level_info);
                  worker.sendMail("dex: an error occurred", "dex symbols couldn't be requested. please check.");
                  resolve();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: updateAssets failed!", worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: dex tickers couldn't be requested", worker.log_level_info);
            worker.sendMail("dex: an error occurred", "dex tickers couldn't be requested. please check.");
            resolve();
         });
      });
   },

   updateRates: function()
   {
      worker.log("begin updating rates...", worker.log_level_info);

      function workOnRate(rate)
      {
         return new Promise(function(resolve, reject)
         {
            var assetSource = worker.assets[rate.assetSourceId];
            var assetTarget = worker.assets[rate.assetTargetId];

            var date = new Date(rate.timestamp);
            var factorSource = Math.pow(10, assetSource.decimals);
            var factorTarget = Math.pow(10, assetTarget.decimals);

            var query = "insert into rate(id_asset_source, id_asset_target, id_source, rate, volume_source, volume_target, timestamp) values(" + assetSource.id_asset + ", " + assetTarget.id_asset + ", " + worker.rate_source_dex + ", " + rate.rate * factorTarget + ", " + rate.volumeSource * factorSource + ", " + rate.volumeTarget * factorTarget + ", '" + date.toISOString() + "')";

            worker.db.query(query).then(function()
            {
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: rate couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         var rates = [];

         for(var i = 0; i < worker.tickers.length; i++)
         {
            var ticker = worker.tickers[i];

            if(ticker['24h_volume'] > 0)
            {
               var rate = {assetSourceId: ticker.amountAssetID, assetSourceName: ticker.amountAssetName, assetSourceDecimals: ticker.amountAssetDecimals, assetTargetId: ticker.priceAssetID, assetTargetName: ticker.priceAssetName, assetTargetDecimals: ticker.priceAssetDecimals, rate: ticker['24h_close'], volumeSource: ticker['24h_volume'], volumeTarget: ticker['24h_priceVolume'], timestamp: ticker.timestamp};

               rates.push(rate);
            }
         }

         worker.db.beginTransaction().then(function()
         {
            Promise.all(rates.map(workOnRate)).then(function(data)
            {
               worker.db.commit().then(function()
               {
                  worker.log("all rates updated -> next", worker.log_level_info);
                  resolve();
               }).catch(function(e)
               {
                  worker.log("ERROR: transaction couldn't be commited: " + e, worker.log_level_info);
                  worker.db.rollback();
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: updateRates failed!" + e, worker.log_level_info);
               worker.db.rollback();
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: transaction couldn't be started: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   updateBcmRates: function()
   {
      worker.log("begin updating bcm rates...", worker.log_level_info);

      function workOnRate(rate)
      {
         return new Promise(function(resolve, reject)
         {
            var bcmData = null;

            worker.requestData("https://api.coinmarketcap.com/v1/ticker/" + rate.id_bcm + "/").then(function(data)
            {
               bcmData = data;
               var date = new Date();
               var query = "insert into rate(id_asset_source, id_asset_target, id_source, rate, timestamp) values(" + rate.id_asset_source + ", " + worker.asset_usd + ", " + worker.rate_source_bcm + ", " + bcmData[0].price_usd * 100 + ", '" + date.toISOString() + "')";

               worker.db.query(query).then(function()
               {
                  var date = new Date();
                  var query = "insert into rate(id_asset_source, id_asset_target, id_source, rate, timestamp) values(" + rate.id_asset_source + ", " + worker.asset_btc + ", " + worker.rate_source_bcm + ", " + bcmData[0].price_btc * 100000000 + ", '" + date.toISOString() + "')";

                  return worker.db.query(query);
               }).then(function()
               {
                  setTimeout(resolve, 500);
               }).catch(function(e)
               {
                  worker.log("ERROR: bcm rates couldn't be stored: " + e, worker.log_level_info);
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: bcm rates couldn't be requested: " + e, worker.log_level_info);
               //worker.sendMail("dex: an error occurred", "bcm data couldn't be requested. please check.");
               resolve();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         var query = "select distinct a.id_asset_source, b.id_bcm from rate a, asset b where a.id_asset_source = b.id_asset and b.id_bcm is not null and a.id_source = " + worker.rate_source_dex;
         worker.db.query(query).then(function(rates)
         {
            worker.sequentialize(rates, workOnRate).then(function()
            {
               worker.log("updating bcm rates finished -> next", worker.log_level_info);
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: update bcm rates failed!" + e, worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: rates couldn't be selected: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   updateUsdVolume: function()
   {
      worker.log("begin updating usd volume...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query =
         `insert into rate(id_asset_source, id_asset_target, id_source, rate, timestamp)
         select 0, 4, 3, round(sum(volume.volume_source/power(10, asset.decimals) * usd.rate)) * 100, utc_timestamp()
         from
         (
            select a.id_asset_source, a.id_asset_target, a.volume_source
            from
            rate a,
            (
               select id_asset_source, id_asset_target, max(timestamp) as timestamp
               from rate
               where
               id_source = 1
               group by id_asset_source, id_asset_target
            ) as b
            where
            a.id_asset_source = b.id_asset_source and
            a.id_asset_target = b.id_asset_target and
            a.timestamp = b.timestamp and
            a.id_source = 1
         ) volume,
         (
            select a.id_asset_source, a.rate/100 as rate
            from
            rate a,
            (
               select id_asset_source, id_asset_target, max(timestamp) as timestamp
               from rate
               where
               id_asset_target = 4 and
               id_source = 2
               group by id_asset_source
            ) as b
            where
            a.id_asset_source = b.id_asset_source and
            a.id_asset_target = b.id_asset_target and
            a.timestamp = b.timestamp and
            a.id_source = 2
         ) usd,
         asset
         where
         volume.id_asset_source = asset.id_asset and
         volume.id_asset_source = usd.id_asset_source`;

         worker.db.query(query).then(function()
         {
            worker.log("updating usd volume finished -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: update usd volume failed!" + e, worker.log_level_info);
            reject();
         });
      });
   },

   requestData: function(url)
   {
      return new Promise(function(resolve, reject)
      {
         request.get({url: url, json: true, timeout: 30000, headers:{"Connection": "keep-alive", "Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
         {
            if(error)
            {
               worker.log("ERROR: data couldn't be requested: " + url + ": " + error, worker.log_level_info);
               reject();
            }
            else if(response.statusCode != 200)
            {
               worker.log("ERROR: data couldn't be requested: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
               reject();
            }
            else
            {
               resolve(body);
            }
         });
      });
   },

   sequentialize: function(items, action)
   {
      var p = Promise.resolve();

      items.forEach(function(item)
      {
         p = p.then(function()
         {
            return action(item);
         });
      });

      return p;
   },

   setStatus: function(status)
   {
      if(status == worker.status_stopped)
      {
         var statusDesc = "stopped";
      }
      else if(status == worker.status_running)
      {
         var statusDesc = "running";
      }
      else if(status == worker.status_error)
      {
         var statusDesc = "error";
      }

      worker.log("start setting status " + statusDesc + "...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "select status as status from status";

         worker.db.query(query).then(function(rows)
         {
            var currentStatus = rows[0].status;

            if(status == worker.status_running && currentStatus != worker.status_stopped)
            {
               worker.log("ERROR: already running or in error state. not started.", worker.log_level_info);
               reject(false);
            }
            else
            {
               var query = "update status set status = " + status;

               worker.db.query(query).then(function(result)
               {
                  if(status == worker.status_stopped)
                  {
                     var statusDesc = "stopped";
                  }
                  else if(status == worker.status_running)
                  {
                     var statusDesc = "running";
                  }
                  else if(status == worker.status_error)
                  {
                     var statusDesc = "error";
                  }

                  worker.log("status " + statusDesc + " set -> next", worker.log_level_info);
                  resolve();
               }).catch(function(e)
               {
                  worker.log("ERROR: status couldn't be set: " + e, worker.log_level_info);
                  reject();
               });
            }
         }).catch(function(e)
         {
            worker.log("ERROR: status couldn't be selected: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   mysql_real_escape_string: function(str)
   {
      return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
      });
   },

   sendMail: function(subject, text)
   {
      var transporter = nodemailer.createTransport(
      {
         host: worker.mail_server,
         port: worker.mail_port,
         secure: worker.mail_secure,
         auth:
         {
            user: worker.mail_user,
            pass: worker.mail_pwd
         }
      });

      var mailOptions =
      {
         from: "gmail_address",
         to: "gmail_address or whatever",
         subject: subject,
         text: text
      };

      return new Promise(function(resolve, reject)
      {
         transporter.sendMail(mailOptions, function(error, info)
         {
            if(error)
            {
               worker.log("ERROR: email couldn't be sent: " + e, worker.log_level_info);
               reject();
            }
            else
            {
               resolve();
            }
         });
      });
   },

   log: function(text, level)
   {
      if((worker.logLevel == worker.log_level_info && level == worker.log_level_info) || worker.logLevel == worker.log_level_debug)
      {
         function pad(n){return n<10 ? '0'+n : n}

         var date = new Date();
         console.log(date.getFullYear() + "-" + pad((date.getMonth() + 1)) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + " " + text);
      }
   }
}

worker.init();
