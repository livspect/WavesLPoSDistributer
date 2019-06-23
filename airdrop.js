#!/usr/bin/node node

/**
 *  Put your settings here:
 *      - db_user: mysql user
 *      - db_pwd: mysql password
 *      - db_name: database name imported database.sql
 *      - mail_user: gmail address
 *      - mail_pwd: gmail password
 *      - address: waves address of the node you manage
 *      - api_key: waves api key before encryption
 *      - from: your gmail address entered in mail_user
 *      - to: email address to receive alerts
 */

var mysql = require("promise-mysql");
var request = require("request");
var nodemailer = require("nodemailer");

worker =
{
   db_server: "127.0.0.1",
   db_user: "user_name",
   db_pwd: "database_pass",
   db_name: "database_name",

   mail_server: "smtp.gmail.com",
   mail_port: 587,
   mail_secure: false,
   mail_user: "gmail_address",
   mail_pwd: "gmail_password",

   address: "your_waves_address",
   node: "http://127.0.0.1:7879",
   tx_timeout: 90,
   api_key: "waves_api_key",

   asset_waves: 0,
   asset_token: 1,

   argv_balance: "balance",
   argv_distribution: "dist",
   argv_payment: "pay",

   conf_airdrop_amount: 1,
   conf_airdrop_fee_asset: 2,
   conf_airdrop_fee_amount: 3,

   status_stopped: 0,
   status_running: 1,
   status_error: 2,

   journal_line_type_dist: 1,
   journal_line_type_pay: 2,
   journal_line_type_fee: 3,

   log_level_debug: 1,
   log_level_info: 2,

   logLevel: 1,
   db: null,
   airdropAmount: null,
   airdropFeeAsset: null,
   airdropFeeAmount: null,
   assets: [],
   missingTxs: [],
   isBalance: false,
   isDist: false,
   isPayment: false,

   init: function()
   {
      worker.log("----- BEGIN ------", worker.log_level_info);
      worker.log("start initializing...", worker.log_level_info);

      worker.getArguments().then(function()
      {
         return worker.dbConnect();
      }).then(function()
      {
         return worker.setStatus(worker.status_running);
      }).then(function()
      {
         return worker.getConfig();
      }).then(function()
      {
         return worker.getAssets();
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

               worker.sendMail("an error occurred", "please check.").then(function()
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

               worker.sendMail("an error occurred", "please check.").then(function()
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

      worker.storeBalances().then(function()
      {
         return worker.distribute();
      }).then(function()
      {
         return worker.pay();
      }).then(function()
      {
         return worker.checkTxs();
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

            worker.sendMail("an error occurred", "please check.").then(function()
            {
            }).catch(function()
            {
            });

            worker.log("ERROR: doit failed!", worker.log_level_info);
         }).catch(function(e)
         {
            worker.db.end();

            worker.sendMail("an error occurred", "please check.").then(function()
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
            if(process.argv[i] == worker.argv_balance)
            {
               worker.isBalance = true;
            }
            if(process.argv[i] == worker.argv_distribution)
            {
               worker.isDist = true;
            }
            else if(process.argv[i] == worker.argv_payment)
            {
               worker.isPayment = true;
            }
         }

         worker.log("balance is " + worker.isBalance, worker.log_level_info);
         worker.log("distribution is " + worker.isDist, worker.log_level_info);
         worker.log("payment is " + worker.isPayment, worker.log_level_info);
         worker.log("all arguments got -> next", worker.log_level_info);

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
            rows.forEach(function(row)
            {
               if(row.id_config == worker.conf_airdrop_amount)
               {
                  worker.airdropAmount = row.value * 100000000;
                  worker.log("airdrop amount: " + worker.airdropAmount, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_airdrop_fee_asset)
               {
                  worker.airdropFeeAsset = row.value;
                  worker.log("airdrop fee asset: " + worker.airdropFeeAsset, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_airdrop_fee_amount)
               {
                  worker.airdropFeeAmount = row.value;
                  worker.log("airdrop fee amount: " + worker.airdropFeeAmount, worker.log_level_info);
               }
            });

            worker.log("all config got -> next", worker.log_level_info);
            resolve();
         }).catch(function(error)
         {
            worker.log("ERROR: config couldn't be selected: " + error, worker.log_level_info);
            reject();
         });
      });
   },

   getAssets: function()
   {
      worker.log("start getting assets...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "select id_asset, id from asset";

         worker.db.query(query).then(function(rows)
         {
            for(var i = 0; i < rows.length; i++)
            {
               worker.assets[rows[i].id_asset] = rows[i].id;
            }

            worker.log("assets got -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: assets couldn't be got: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   storeBalances: function()
   {
      function getDistribution()
      {
         return new Promise(function(resolve, reject)
         {
            request.get({url: worker.node + "/assets/" + worker.assets[worker.asset_token] + "/distribution", json: true, timeout: 60000, headers:{"Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: distribution couldn't be got: " + error, worker.log_level_info);
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: distribution couldn't be got: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(body);
               }
            });
         });
      }

      function getAddressId(address)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "select id_address from address where address = '" + address + "'";

            worker.db.query(query).then(function(rows)
            {
               if(rows.length == 1)
               {
                  resolve(rows[0].id_address);
               }
               else
               {
                  var query = "insert into address(address) values('" + address + "')";

                  worker.db.query(query).then(function(result)
                  {
                     resolve(result.insertId);
                  }).catch(function(e)
                  {
                     worker.log("ERROR: address couldn't be stored: " + e, worker.log_level_info);
                     reject();
                  });
               }
            }).catch(function(e)
            {
               worker.log("ERROR: address id couldn't be selected: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      function workOnBalance(balance)
      {
         return new Promise(function(resolve, reject)
         {
            getAddressId(balance.address).then(function(addressId)
            {
               var query = "insert into balance(id_address, balance, timestamp) values(" + addressId + ", " + balance.balance + ", now())";

               worker.db.query(query).then(function(result)
               {
                  resolve();
               }).catch(function(e)
               {
                  worker.log("ERROR: balance couldn't be stored: " + e, worker.log_level_info);
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: balance couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         if(worker.isBalance == false)
         {
            resolve();
            return;
         }

         worker.log("start storing balances...", worker.log_level_info);

         getDistribution().then(function(distribution)
         {
            var balances = [];

            for(address in distribution)
            {
               var balance = {address: address, balance: distribution[address]};
               balances.push(balance);
            }

            worker.log(balances.length + " addresses found.", worker.log_level_info);
            return worker.sequentialize(balances, workOnBalance);
         }).then(function()
         {
            worker.log("balances stored -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("balances couldn't be stored: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   distribute: function()
   {
      function getAverages()
      {
         return new Promise(function(resolve, reject)
         {
            var query = "select a.id_address, avg(a.balance) as average from balance a, address b where a.id_address = b.id_address and b.excluded = 0 group by id_address";

            worker.db.query(query).then(function(rows)
            {
               resolve(rows);
            }).catch(function(e)
            {
               worker.log("ERROR: averages couldn't be got: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      function workOnAirdrop(airdrop)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "insert into journal_line(id_journal_line_type, id_distribution, id_address, amount, id_asset, timestamp) values(" + worker.journal_line_type_dist + ", " + airdrop.distribution + ", " + airdrop.address + ", " + airdrop.amount + ", " + worker.asset_token + ", now())";

            worker.db.query(query).then(function(result)
            {
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: airdrop couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         if(worker.isDist == false)
         {
            resolve();
            return;
         }

         worker.log("start distributing...", worker.log_level_info);

         worker.db.beginTransaction().then(function()
         {
            var distributionId = null;
            var query = "insert into distribution(timestamp) values(now())";

            worker.db.query(query).then(function(result)
            {
               distributionId = result.insertId;
               worker.log("distribution id is " + distributionId, worker.log_level_debug);
               return getAverages();
            }).then(function(averages)
            { 
               var sum = 0;
               var airdrops = [];

               for(var i = 0; i < averages.length; i++)
               {
                  sum += averages[i].average;
               }

               for(var i = 0; i < averages.length; i++)
               {
                  var amount = Math.floor(averages[i].average/sum * worker.airdropAmount);
                  var airdrop = {distribution: distributionId, address: averages[i].id_address, amount: amount};
                  airdrops.push(airdrop);
               }

               return worker.sequentialize(airdrops, workOnAirdrop);
            }).then(function()
            {
               worker.db.commit();
               worker.log("distribution finished -> next", worker.log_level_info);
               resolve();
            }).catch(function(e)
            {
               worker.db.rollback();
               worker.log("ERROR: distribution failed: " + e, worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.db.rollback();
            worker.log("ERROR: transaction could not be started: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   checkBalance: function()
   {
      function getBalance()
      {
         return new Promise(function(resolve, reject)
         {
            request.get({url: worker.node + "/assets/balance/" + worker.address + "/" + worker.assets[worker.asset_token], json: true, timeout: 5000, headers:{"Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: balance couldn't be got: " + error, worker.log_level_info);
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: balance couldn't be got: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(body.balance);
               }
            });
         });
      }

      worker.log("start checking balance...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var balance = null;

         getBalance().then(function(data)
         {
            balance = data; 

            var query = "select sum(amount) as amount from journal_line where id_journal_line_type = " + worker.journal_line_type_dist + " and id_journal_line_ref is null";

            return worker.db.query(query);
         }).then(function(result)
         {
            var pay = result[0].amount;
 
            if(pay > balance)
            {
               return Promise.reject({code: -1, message: "ERROR: balance unsufficent for payment: balance: " + balance + ", payment: " + pay});
            }
            else
            {
               worker.log("balance checked. balance: " + balance + ", payment: " + pay + " -> next", worker.log_level_info);
               resolve();
            }
         }).catch(function(e)
         {
            if(e.code && e.code == -1)
            {
               worker.log(e.message);
            } 
            else
            {
               worker.log("ERROR: balance couldn't be checked: " + e, worker.log_level_info);
            }

            reject();
         });
      });
   },

   pay: function()
   {
      function doPayment(payment)
      {
         return new Promise(function(resolve, reject)
         {
            var paymentDo = {};

            for(key in payment)
            {
               paymentDo[key] = payment[key];
            }

            delete paymentDo.id_address;

            request.post({url: worker.node + '/assets/masstransfer', json: paymentDo, timeout: 5000, headers:{"Connection": "keep-alive", "Accept": "application/json", "Content-Type": "application/json", "api_key": worker.api_key}}, function(error, response, body)
            {
               worker.log("RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body) + ", PAYMENT: " + JSON.stringify(paymentDo) + "\r\n", worker.log_level_debug);

               if(error)
               {
                  worker.log("ERROR: payment failed: " + error + ", PAYMENT: " + JSON.stringify(paymentDo) + "\r\n");
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: payment failed: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body) + ", PAYMENT: " + JSON.stringify(paymentDo) + "\r\n", worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(body.id);
               }
            });
         });
      }

      function workOnPayment(payment)
      {
         return new Promise(function(resolve, reject)
         {
            doPayment(payment).then(function(tx)
            {
               var query = "insert into journal_line(id_journal_line_type, id_address, amount, id_asset, id_tx, tx_status, timestamp) values(" + worker.journal_line_type_pay + ", " + payment.id_address + ", " + payment.amount + ", " + worker.asset_token + ", '" + tx + "', 0, now())";

               worker.db.query(query).then(function(result)
               {
                  var insertId = result.insertId;
                  var query = "update journal_line set id_journal_line_ref = " + insertId + " where id_address = " + payment.id_address + " and id_asset = " + worker.asset_token + " and id_journal_line_ref is null and id_journal_line <> " + insertId + " and id_journal_line_type <> " + worker.journal_line_type_pay;

                  worker.db.query(query).then(function(result)
                  {
                     setTimeout(function(){resolve();}, 2000);
                  }).catch(function(e)
                  {
                     worker.log("ERROR: ref couldn't be set: " + e, worker.log_level_info);
                     reject();
                  });
               }).catch(function(e)
               {
                  worker.log("ERROR: payment journal line couldn't be stored: " + e, worker.log_level_info);
                  reject();
               });
            }).catch(function(e)
            {
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         if(worker.isPayment == false)
         {
            resolve();
            return;
         }

         worker.log("start paying...", worker.log_info);

         worker.checkBalance().then(function()
         {
            var query = "select a.id_address, b.address, a.id_asset, sum(a.amount) as amount from journal_line a, address b where a.id_journal_line_type = " + worker.journal_line_type_dist + " and a.id_journal_line_ref is null and a.id_address = b.id_address group by a.id_address, b.address, a.id_asset order by a.id_address";

            return worker.db.query(query);
         }).then(function(rows)
         {
            var payments = [];

            rows.forEach(function(row)
            {
               if(worker.airdropFeeAsset == worker.asset_waves)
               {
                  var payment = {"amount": row.amount, "fee": worker.airdropFeeAmount, "sender": worker.address, "assetId": worker.assets[worker.asset_token], "attachment": "", "recipient": row.address, "id_address": row.id_address};
               }
               else
               {
                  var payment = {"amount": row.amount, "fee": worker.airdropFeeAmount, "feeAssetId": worker.assets[worker.airdropFeeAsset], "sender": worker.address, "assetId": worker.assets[worker.asset_token], "attachment": "", "recipient": row.address, "id_address": row.id_address};
               }

               payments.push(payment);
            });

            return worker.sequentialize(payments, workOnPayment);
         }).then(function()
         {
            worker.log("all payments done -> next", worker.log_level_info);
            resolve();
         }).catch(function()
         {
            worker.log("ERROR: pay failed!", worker.log_level_info);
            reject();
         });
      });
   },

   checkTxs: function()
   {
      function getTx(tx)
      {
         return new Promise(function(resolve, reject)
         {
            request.get({url: worker.node + '/transactions/info/' + tx, json: true, timeout: 5000, headers:{"Connection": "keep-alive", "Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: tx couldn't be seleted: " + error + ", TX: " + tx + "\r\n");
                  reject();
               }
               else if(response.statusCode == 404)
               {
                  resolve(false);
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: tx couldn't be selected: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body) + ", TX: " + tx + "\r\n", worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(true);
               }
            });
         });
      }

      function workOnTx(tx)
      {
         return new Promise(function(resolve, reject)
         {
            getTx(tx.id_tx).then(function(result)
            {
               if(result == false)
               {
                  worker.missingTxs.push(tx.id_tx);
                  resolve();
               }
               else
               {
                  var query = "update journal_line set tx_status = 1 where id_tx = '" + tx.id_tx + "'";

                  worker.db.query(query).then(function(result)
                  {
                     resolve();
                  }).catch(function(e)
                  {
                     worker.log("ERROR: tx status couldn't be updated: " + e, worker.log_level_info);
                     reject();
                  });
               }
            }).catch(function(e)
            {
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         worker.log("start checking transactions...", worker.log_level_info);

         var query = "select id_tx from journal_line where id_journal_line_type = 2 and tx_status = 0 and timestampadd(minute, " + worker.tx_timeout + ", timestamp) < now()";

         worker.db.query(query).then(function(txs)
         {
            worker.sequentialize(txs, workOnTx).then(function()
            {
               if(worker.missingTxs.length > 0)
               {
                  worker.sendMail("txs not found", "these txs were not found on the blockchain:\n" + worker.missingTxs);
               }

               worker.log(txs.length + " transactions checked, " + worker.missingTxs.length + " not found -> next", worker.log_level_info);
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: checking transactions failed!", worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: txs couldn't be selected: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   sequentialize: function(items, action)
   {
      var p = Promise.resolve();

      items.forEach(function(item)
      {
         p = p.then(function(list)
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
         var query = "select status from status";

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
         subject: "Airdrop: " + subject,
         text: text
      };

      return new Promise(function(resolve, reject)
      {
         transporter.sendMail(mailOptions, function(error, info)
         {
            if(error)
            {
               worker.log("ERROR: email couldn't be sent: " + error, worker.log_level_info);
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
