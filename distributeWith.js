#!/usr/bin/node node

/**
 *  Put your settings here:
 *      - db_user: mysql user
 *      - db_pwd: mysql password
 *      - db_name: database name imported database.sql
 *      - mail_user: gmail address
 *      - mail_pwd: gmail password
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

   node: "http://127.0.0.1:7879",
   generating_offset: 1000,
   tx_timeout: 1000,
   tx_fee: 100000,
   tx_fee_lessor: 0,
   api_key: "waves_api_key",

   argv_distribution: "dist",
   argv_payment: "pay",
   argv_balance: "balance",

   id_node: 1,

   asset_waves: 1,
   asset_mrt: 2,
   asset_mrt_id: "4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC",
   asset_dist: 3,

   conf_last_block: 1,
   conf_mrt_per_block: 2,
   conf_waves_payout_share: 3,
   conf_mrt_payout_share: 4,
   conf_last_block_dist: 5,
   conf_end_block_dist: 6,
   conf_dist_asset_id: 9,
   conf_dist_per_block: 10,

   status_stopped: 0,
   status_running: 1,
   status_error: 2,

   journal_line_type_dist: 1,
   journal_line_type_pay: 2,
   journal_line_type_fee: 3,

   tx_type_lease: 8,
   tx_type_lease_cancel: 9,

   log_level_debug: 1,
   log_level_info: 2,

   logLevel: 1,
   db: null,
   startBlock: null,
   endBlock: null,
   startBlockDist: null,
   endBlockDist: null,
   distAssetId: null,
   distPerBlock: null,
   distCache: null,
   address: null,
   mrtPerBlock: null,
   wavesShare: null,
   mrtShare: null,
   blocks: [],
   missingTxs: [],
   isDist: false,
   isPayment: false,
   isBalance: false,

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
         return worker.getEndBlock();
      }).then(function()
      {
         return worker.getNodeAddress();
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

      worker.getBlocks().then(function()
      {
         return worker.storeMyBlocks();
      }).then(function()
      {
         return worker.storeMyLeases();
      }).then(function()
      {
         return worker.storeMyLeaseCancels();
      }).then(function()
      {
         return worker.storeLastBlock();
      }).then(function()
      {
         return worker.distribute(worker.startBlockDist, worker.endBlockDist);
      }).then(function()
      {
         return worker.checkBalance();
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
            if(process.argv[i] == worker.argv_distribution)
            {
               worker.isDist = true;
            }
            else if(process.argv[i] == worker.argv_payment)
            {
               worker.isPayment = true;
            }
            else if(process.argv[i] == worker.argv_balance)
            {
               worker.isBalance = true;
            }
         }

         worker.log("distribution is " + worker.isDist, worker.log_level_info);
         worker.log("payment is " + worker.isPayment, worker.log_level_info);
         worker.log("balance is " + worker.isBalance, worker.log_level_info);
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
               if(row.id_config == worker.conf_last_block)
               {
                  worker.startBlock = parseInt(row.value) + 1;
                  worker.log("start block: " + worker.startBlock, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_mrt_per_block)
               {
                  worker.mrtPerBlock = parseInt(row.value);
                  worker.log("mrt per block: " + worker.mrtPerBlock, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_waves_payout_share)
               {
                  worker.wavesShare = parseInt(row.value);
                  worker.log("waves payout share: " + worker.wavesShare, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_mrt_payout_share)
               {
                  worker.mrtShare = parseInt(row.value);
                  worker.log("mrt payout share: " + worker.mrtShare, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_last_block_dist)
               {
                  worker.startBlockDist = parseInt(row.value) + 1;
                  worker.log("start dist block: " + worker.startBlockDist, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_end_block_dist)
               {
                  worker.endBlockDist = parseInt(row.value);
                  worker.log("end dist block: " + worker.endBlockDist, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_dist_asset_id)
               {
                  worker.distAssetId = row.value;
                  worker.log("dist asset id: " + worker.distAssetId, worker.log_level_info);
               }
               else if(row.id_config == worker.conf_dist_per_block)
               {
                 worker.distPerBlock = parseInt(row.value);
                 worker.log("dist per block: " + worker.distPerBlock, worker.log_level_info);
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

   getEndBlock: function()
   {
      worker.log("start getting end block...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         request.get({url: worker.node + "/blocks/height", json: true, timeout: 50000, headers:{"Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
         {
            if(error)
            {
               worker.log("ERROR: end block couldn't be got: " + error, worker.log_level_info);
               reject();
            }
            else if(response.statusCode != 200)
            {
               worker.log("ERROR: end block couldn't be got: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
               reject();
            }
            else
            {
               worker.endBlock = body.height;
               worker.log("end block got: " + worker.endBlock + " -> next", worker.log_level_info);
               resolve();
            }
         });
      });
   },

   getNodeAddress: function()
   {
      worker.log("start getting node address...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "select address from node where id_node = " + worker.id_node;

         worker.db.query(query).then(function(rows)
         {
            worker.address = rows[0].address;
            worker.log("node address got: " + worker.address + " -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: node adress couldn't be selected: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   getBlocks: function()
   {
      worker.log("start getting blocks from " + worker.startBlock + " to " + worker.endBlock + "...", worker.log_level_info);

      function getBlocks(range)
      {
         return new Promise(function(resolve, reject)
         {
            worker.log("get blocks from " + range.start + " to " + range.end, worker.log_level_debug);
            request.get({url: worker.node + "/blocks/seq/" + range.start + "/" + range.end, json: true, timeout: 200000, headers:{"Connection": "keep-alive", "Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: blocks couldn't be got: " + error, worker.log_level_info);
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: blocks couldn't be got: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
                  reject();
               }
               else
               {
                  worker.blocks = worker.blocks.concat(body);
                  setTimeout(function(){resolve();}, 1000);
               }
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         var ranges = [];
         var startBlock = worker.startBlock;

         while(startBlock <= worker.endBlock)
         {
            if(startBlock + 99 < worker.endBlock)
            {
               var endBlock = startBlock + 99;
            }
            else
            {
               var endBlock = worker.endBlock;
            }

            var range = {start: startBlock, end: endBlock};
            ranges.push(range);

            startBlock = endBlock + 1;
         }

         worker.sequentialize(ranges, getBlocks).then(function()
         {
            if(endBlock)
            {
               worker.endBlock = endBlock;
            }

            worker.log("all blocks got: " + worker.blocks.length + " => next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: getBlocks failed!", worker.log_level_info);
            reject();
         });
      });
   },

   storeMyBlocks: function()
   {
      worker.log("start storing my blocks...", worker.log_level_info);

      function workOnBlock(block)
      {
         return new Promise(function(resolve, reject)
         {
            if(block.generator == worker.address)
            {
               var query = "select * from block where height = " + block.height;

               worker.db.query(query).then(function(rows)
               {
                  if(rows.length == 0)
                  {
                     worker.log("block " + block.height + " not in db -> adding it.", worker.log_level_info);
                     var fees = 0;

                     for(var i = 0; i < block.transactions.length; i++)
                     {
                        var tx = block.transactions[i];

                        if(!tx.feeAsset || tx.feeAsset === '' || tx.feeAsset === null)
                        {
                           fees += tx.fee;
                        }
                     }

                     var date = new Date(block.timestamp);
                     var query = "insert into block(id_node, height, fee, mrt, dist, tx_count, timestamp) values(" + worker.id_node + ", " + block.height + ", " + fees + ", " + worker.mrtPerBlock + ", " + worker.distPerBlock + ", " + block.transactions.length + ", '" + date.toISOString() + "')";

                     worker.db.query(query).then(function(result)
                     {
                        resolve(true);
                     }).catch(function(e)
                     {
                        worker.log("ERROR: new block couldn't be stored: " + e, worker.log_level_info);
                        reject();
                     });
                  }
                  else
                  {
                     resolve(false);
                  }
               }).catch(function(e)
               {
                  worker.log("ERROR: block couldn't be selected: " + e, worker.log_level_info);
                  reject();
               });
            }
            else
            {
               resolve();
            }
         });
      }

      return new Promise(function(resolve, reject)
      {
         Promise.all(worker.blocks.map(workOnBlock)).then(function(data)
         {
            var counter = 0;

            for(var i = 0; i < data.length; i++)
            {
               if(data[i] == true)
               {
                  counter++;
               }
            }

            worker.log(counter + " new block(s) stored -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: storeMyBlocks failed!", worker.log_level_info);
            reject();
         });
      });
   },

   storeMyLeases: function()
   {
      worker.log("start storing my leases...", worker.log_level_info);

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

      function workOnTx(tx, height)
      {
         return new Promise(function(resolve, reject)
         {
            if(tx.recipient == worker.address && tx.type == worker.tx_type_lease)
            {
               var query = "select * from lease where id_tx_start = '" + tx.id + "'";

               worker.db.query(query).then(function(rows)
               {
                  if(rows.length == 0)
                  {
                     worker.log("lease " + tx.id + " not in db -> adding it.", worker.log_level_info);

                     getAddressId(tx.sender).then(function(addressId)
                     {
                        var date = new Date(tx.timestamp);
                        var query = "insert into lease(id_address, id_tx_start, height_start, amount, timestamp_start) values(" + addressId + ", '" + tx.id + "', " + height + ", " + tx.amount + ", '" + date.toISOString() + "')";

                        worker.db.query(query).then(function(result)
                        {
                           resolve({address: tx.sender, amount: tx.amount/100000000});
                        }).catch(function(e)
                        {
                           worker.log("ERROR: tx couldn't be stored: " + e, worker.log_level_info);
                           reject();
                        });
                     }).catch(function(e)
                     {
                        reject();
                     });
                  }
                  else
                  {
                     resolve(null);
                  }
               }).catch(function(e)
               {
                  worker.log("ERROR: lease couldn't be selected: " + JSON.stringify(tx), worker.log_level_info);
                  reject();
               });
            }
            else
            {
               resolve(0);
            }
         });
      }

      function workOnBlock(block)
      {
         return new Promise(function(resolve, reject)
         {
            Promise.all(block.transactions.map(function(tx){return workOnTx(tx, block.height);})).then(function(data)
            {
               resolve(data);
            }).catch(function(e)
            {
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         Promise.all(worker.blocks.map(workOnBlock)).then(function(data)
         {
            var leases = [];

            for(var i = 0; i < data.length; i++)
            {
               for(var j = 0; j < data[i].length; j++)
               {
                  if(data[i][j])
                  {
                     leases.push(data[i][j]);
                  }
               }
            }

            if(leases.length > 0)
            {
               worker.sendMail("new leases", leases.length + " new lease(s) stored:\n" + JSON.stringify(leases));
            }

            worker.log(leases.length + " new lease(s) stored -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: storeMyLeases failed!", worker.log_level_info);
            reject();
         });
      });
   },

   storeMyLeaseCancels: function()
   {
      worker.log("start storing my lease cancels...", worker.log_level_info);

      function workOnTx(tx, height)
      {
         return new Promise(function(resolve, reject)
         {
            if(tx.type == worker.tx_type_lease_cancel)
            {
               var date = new Date(tx.timestamp);
               var query = "update lease set id_tx_end = '" + tx.id + "', height_end = " + height + ", timestamp_end = '" + date.toISOString() + "' where id_tx_start = '" + tx.leaseId + "'";

               worker.db.query(query).then(function(result)
               {
                  if(result.changedRows == 1)
                  {
                     var query = "select b.address, a.amount/100000000 as amount from lease a, address b where a.id_tx_start = '" + tx.leaseId + "' and a.id_address = b.id_address";

                     worker.db.query(query).then(function(rows)
                     {
                        resolve(rows[0]);
                     }).catch(function(e)
                     {
                        resolve({address: "unknown", amount: "unknown"});
                     });
                  }
                  else
                  {
                     resolve(null);
                  }
               }).catch(function(e)
               {
                  worker.log("lease cancels couldn't be stored: " + e, worker.log_level_info);
                  reject();
               });
            }
            else
            {
               resolve(null);
            }
         });
      }

      function workOnBlock(block)
      {
         return new Promise(function(resolve, reject)
         {
            Promise.all(block.transactions.map(function(tx){return workOnTx(tx, block.height);})).then(function(data)
            {
               resolve(data);
            }).catch(function(e)
            {
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         Promise.all(worker.blocks.map(workOnBlock)).then(function(data)
         {
            var cancels = [];

            for(var i = 0; i < data.length; i++)
            {
               for(var j = 0; j < data[i].length; j++)
               {
                  if(data[i][j])
                  {
                     cancels.push(data[i][j]);
                  }
               }
            }

            if(cancels.length > 0)
            {
               worker.sendMail("new lease cancels", cancels.length + " lease(s) cancelled:\n" + JSON.stringify(cancels));
            }

            worker.log(cancels.length + " lease(s) cancelled -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("storeMyLeaseCancels failed!", worker.log_level_info);
            reject();
         });
      });
   },

   storeTransactions: function()
   {
      worker.log("start storing transactions...", worker.log_level_info);

      function workOnTxs(txs)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "insert into transaction(id_transaction_type, count, date) values(" + txs.type + ", " + txs.count + ", '" + txs.date + "') on duplicate key update count = count + " + txs.count;

            worker.db.query(query).then(function(result)
            {
               resolve(txs.count);
            }).catch(function(e)
            {
               worker.log("ERROR: txs couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         var txBuffer = [];
         var txBufferOut = [];
         var lastBlock = worker.startBlockStat - 1;

         for(var i = 0; i < worker.blocks.length; i++)
         {
            if(worker.blocks[i].height >= worker.startBlockStat)
            {
               for(var j = 0; j < worker.blocks[i].transactions.length; j++)
               {
                  var tx = worker.blocks[i].transactions[j];
                  var date = new Date(tx.timestamp);
                  date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

                  if(!txBuffer[date])
                  {
                     txBuffer[date] = [];
                     txBuffer[date][tx.type] = 0;
                  }
                  else if(!txBuffer[date][tx.type])
                  {
                     txBuffer[date][tx.type] = 0;
                  }

                  txBuffer[date][tx.type] += 1;
               }

               lastBlock = worker.blocks[i].height;
            }
         }

         for(var date in txBuffer)
         {
            for(var type in txBuffer[date])
            {
               var tx = {date: date, type: type, count: txBuffer[date][type]};
               txBufferOut.push(tx);
            }
         }

         worker.db.beginTransaction().then(function()
         {
            Promise.all(txBufferOut.map(workOnTxs)).then(function(data)
            {
               var query = "update config set value = " + lastBlock + " where id_config = " + worker.conf_last_block_stat;

               worker.db.query(query).then(function(result)
               {
                  worker.db.commit().then(function()
                  {
                     var counter = 0;

                     for(var i = 0; i < data.length; i++)
                     {
                        counter += data[i];
                     }

                     worker.log(counter + " transactions stored -> next", worker.log_level_info);
                     resolve();
                  }).catch(function(e)
                  {
                     worker.log("ERROR: transaction couldnt' be commited: " + e, worker.log_level_info);
                     reject();
                  });
               }).catch(function(e)
               {
                  worker.log("ERROR: last stat block couldn't be updated: " + e, worker.log_level_info);
                  worker.db.rollback();
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: storeTransactions failed!", worker.log_level_info);
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

   distribute: function(start, end)
   {
      function workOnEarning(earning, distributionId)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "insert into journal_line(id_journal_line_type, id_distribution, id_address, amount, id_asset, timestamp) values(" + worker.journal_line_type_dist + ", " + distributionId + ", " + earning.sender + ", " + earning.amount + ", " + earning.asset + ", now())";

            worker.db.query(query).then(function(result)
            {
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: earning couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         });
      }

      function workOnBlock(block)
      {
         return new Promise(function(resolve, reject)
         {
            var query = "select id_address, sum(amount) as amount from lease where height_start + " + worker.generating_offset + " <= " + block.height + " and (height_end is null or height_end >= " + block.height + ") group by id_address";

            worker.db.query(query).then(function(rows)
            {
               var sum = 0;

               for(var i = 0; i < rows.length; i++)
               {
                  sum = sum + rows[i].amount;
               }

               var earnings = [];
               var sumWaves = 0;
               var sumMrt = 0;
               var sumDist = 0;

               for(var i = 0; i < rows.length; i++)
               {
                  /* waves */
                  var amount = rows[i].amount/sum * block.fee * worker.wavesShare/100;

                  if(amount > 0)
                  {
                     var earning = {sender: rows[i].id_address, asset: worker.asset_waves, amount: amount};
                     earnings.push(earning);
                     sumWaves += amount;
                  }

                  /* mrt */
                  var amount = rows[i].amount/sum * block.mrt * worker.mrtShare/100;

                  if(amount > 0)
                  {
                     var earning = {sender: rows[i].id_address, asset: worker.asset_mrt, amount: amount};
                     earnings.push(earning);
                     sumMrt += amount;
                  }

                  /* dist */
                  var amount = rows[i].amount/sum * block.dist;

                  if(amount > 0)
                  {
                     var earning = {sender: rows[i].id_address, asset: worker.asset_dist, amount: amount};
                     earnings.push(earning);
                     sumDist += amount;
                  }
               }

               worker.log("block: " + block.height + ", leases: " + rows.length + ", waves: " + block.fee + ", dist: " + sumWaves + ", mrt: " + block.mrt + ", dist: " + sumMrt + ", dist: " + block.dist + ", distdist: " + sumDist, worker.log_level_info);
               resolve(earnings);
            }).catch(function(e)
            {
               worker.log("ERROR: couldn't select leases: " + e, worker.log_level_info);
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
         else if(start > end)
         {
            worker.log("start > end -> nothing to distribute -> next", worker.log_level_info);
            resolve();
            return;
         }

         worker.log("start distributing from " + start + " to " + end + "...", worker.log_level_info);

         worker.db.beginTransaction().then(function()
         {
            var query = "insert into distribution(height_start, height_end, timestamp) values(" + start + ", " + end + ", now())";

            worker.db.query(query).then(function(result)
            {
               var distributionId = result.insertId;
               worker.log("distribution id is " + distributionId, worker.log_level_debug);

               var query = "select * from block where height >= " + start + " and height <= " + end;

               worker.db.query(query).then(function(blocks)
               {
                  Promise.all(blocks.map(workOnBlock)).then(function(earnings)
                  {
                     var earningsCache = [];
                     var earningsFinal = [];

                     for(var i = 0; i < earnings.length; i++)
                     {
                        for(var j = 0; j < earnings[i].length; j++)
                        {
                           if(!earningsCache[earnings[i][j].sender])
                           {
                              earningsCache[earnings[i][j].sender] = [];
                           }

                           if(!earningsCache[earnings[i][j].sender][earnings[i][j].asset])
                           {
                              earningsCache[earnings[i][j].sender][earnings[i][j].asset] = 0;
                           }

                           earningsCache[earnings[i][j].sender][earnings[i][j].asset] += earnings[i][j].amount;
                        }
                     }

                     for(var address in earningsCache)
                     {
                        var earnings = earningsCache[address];

                        for(var asset in earnings)
                        {
                           if(asset == worker.asset_mrt)
                           {
                              var amount = Math.round(earnings[asset]);
                           }
                           else
                           {
                              var amount = Math.floor(earnings[asset]);
                           }

                           if(amount > 0)
                           {
                              var earningFinal = {sender: address, asset: asset, amount: amount};
                              earningsFinal.push(earningFinal);
                           }
                        }
                     }

                     Promise.all(earningsFinal.map(function(earning){return workOnEarning(earning, distributionId);})).then(function()
                     {
                        worker.log("storing last dist block " + worker.endBlockDist + "...", worker.log_level_info);
                        var query = "update config set value = " + worker.endBlockDist + " where id_config = " + worker.conf_last_block_dist;

                        worker.db.query(query).then(function(result)
                        {
                           worker.db.commit();

                           var blockFees = 0;
                           var blockMrt = 0;
                           var blockDist = 0;

                           blocks.forEach(function(block)
                           {
                              blockFees += block.fee;
                              blockMrt += block.mrt;
                              blockDist += block.dist;
                           });

                           var query = "select sum(amount) as amount, id_asset from journal_line where id_distribution = " + distributionId + " and id_journal_line_type = " + worker.journal_line_type_dist + " group by id_asset";

                           worker.db.query(query).then(function(rows)
                           {
                              var distWaves = 0;
                              var distMrt = 0;
                              var distDist = 0;                    

                              rows.forEach(function(row)
                              {
                                 if(row.id_asset == worker.asset_waves)
                                 {
                                    distWaves = row.amount;
                                 }
                                 else if(row.id_asset == worker.asset_mrt)
                                 {
                                    distMrt = row.amount;
                                 }
                                 else if(row.id_asset == worker.asset_dist)
                                 {
                                    distDist = row.amount;
                                 }
                              });

                              worker.log("block fees: " + (blockFees * worker.wavesShare/100) + ", dist waves: " + distWaves + ", block mrt: " + (blockMrt * worker.mrtShare/100) + ", dist mrt: " + distMrt + ", block dist: " + blockDist + ", dist dist: " + distDist, worker.log_level_info);
                              worker.log("all distributed -> next", worker.log_level_info);
                              resolve();
                           }).catch(function(e)
                           {
                              worker.log("ERROR: payed amounts couldn't be selected: " + e, worker.log_level_info);
                              worker.log("all distributed -> next", worker.log_level_info);
                              resolve();
                           });
                        }).catch(function(e)
                        {
                           worker.log("ERROR: last dist block couldn't be stored: " + e, worker.log_level_info);
                           worker.db.rollback();
                           reject();
                        });
                     }).catch(function(e)
                     {
                        worker.log("ERROR: distribution failed!", worker.log_level_info);
                        worker.db.rollback();
                        reject();
                     });
                  }).catch(function(e)
                  {
                     worker.log("ERROR: distribution failed!", worker.log_level_info);
                     worker.db.rollback();
                     reject();
                  });
               }).catch(function(e)
               {
                  worker.log("ERROR: blocks couldn't be selected: " + e, worker.log_level_info);
                  worker.db.rollback();
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: distribution couldn't be stored: " + e, worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: transaction could not be started: " + e, worker.log_level_info);
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

            request.post({url: worker.node + '/assets/transfer', json: paymentDo, timeout: 5000, headers:{"Connection": "keep-alive", "Accept": "application/json", "Content-Type": "application/json", "api_key": worker.api_key}}, function(error, response, body)
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
               if(payment.assetId)
               {
                  if(payment.assetId == worker.asset_mrt_id)
                  {
                     var assetId = worker.asset_mrt;
                  }
                  else if(payment.assetId == worker.distAssetId)
                  {
                     var assetId = worker.asset_dist;
                  }
               }
               else
               {
                  var assetId = worker.asset_waves;
               }

               var query = "insert into journal_line(id_journal_line_type, id_address, amount, id_asset, id_tx, tx_status, timestamp) values(" + worker.journal_line_type_pay + ", " + payment.id_address + ", " + payment.amount + ", " + assetId + ", '" + tx + "', 0, now())";

               worker.db.query(query).then(function(result)
               {
                  var insertId = result.insertId;
                  var query = "update journal_line set id_journal_line_ref = " + insertId + " where id_address = " + payment.id_address + " and id_asset = " + assetId + " and id_journal_line_ref is null and id_journal_line <> " + insertId + " and id_journal_line_type <> " + worker.journal_line_type_pay;

                  worker.db.query(query).then(function(result)
                  {
                     var query = "insert into journal_line(id_journal_line_type, id_address, amount, id_asset, id_journal_line_ref, timestamp) values(" + worker.journal_line_type_fee + ", " + payment.id_address + ", " + worker.tx_fee_lessor + ", " + worker.asset_waves + ", " + insertId + ", now())";

                     worker.db.query(query).then(function(result)
                     {
                        setTimeout(function(){resolve();}, 2000);
                     }).catch(function(e)
                     {
                        worker.log("ERROR: fee line couldn't be stored: " + e, worker.log_level_info);
                        reject();
                     });
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

         var query = "select a.id_address, b.address, a.id_asset, sum(a.amount) as amount from journal_line a, address b where a.id_journal_line_type = " + worker.journal_line_type_dist + " and a.id_journal_line_ref is null and a.id_address = b.id_address group by a.id_address, b.address, a.id_asset order by a.id_address limit 1000";

         var payments = [];

         worker.db.query(query).then(function(rows)
         {
            rows.forEach(function(row)
            {
               if(row.id_asset == worker.asset_waves)
               {
                  var payment = {"amount": row.amount, "fee": worker.tx_fee, "sender": worker.address, "attachment": "", "recipient": row.address, "id_address": row.id_address};
               }
               else if(row.id_asset == worker.asset_mrt)
               {
                  var payment = {"amount": row.amount, "fee": worker.tx_fee, "sender": worker.address, "assetId": worker.asset_mrt_id, "attachment": "", "recipient": row.address, "id_address": row.id_address};
               }
               else if(row.id_asset == worker.asset_dist)
               {
                  var payment = {"amount": row.amount, "fee": worker.tx_fee, "sender": worker.address, "assetId": worker.distAssetId, "attachment": "", "recipient": row.address, "id_address": row.id_address};
               }

               payments.push(payment);
            });

            worker.sequentialize(payments, workOnPayment).then(function()
            {
               worker.log("all payments done -> next", worker.log_level_info);
               resolve();
            }).catch(function()
            {
               worker.log("ERROR: pay failed!", worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: payments couldn't be selected: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   checkBalance: function()
   {
      function callApi(func)
      {
         return new Promise(function(resolve, reject)
         {
            request.get({url: worker.node + func, json: true, timeout: 5000, headers:{"Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: api couldn't be called: " + error, worker.log_level_info);
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: api couldn't be called: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(body);
               }
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         if(worker.isBalance == false && worker.isPayment == false)
         {
            resolve();
            return;
         }

         worker.log("start checking balance...", worker.log_level_info);

         var query = "select sums.waves as waves, sums.mrt as mrt, sums.dist as dist from (select ifnull(sum(if(id_asset = " + worker.asset_waves + ", amount, 0)), 0) as 'waves', ifnull(sum(if(id_asset = " + worker.asset_mrt + ", amount, 0)), 0) as 'mrt', ifnull(sum(if(id_asset = " + worker.asset_dist + ", amount, 0)), 0) as 'dist' from journal_line where id_journal_line_type = " + worker.journal_line_type_dist + " and id_journal_line_ref is null) as sums";

         worker.db.query(query).then(function(rows)
         {
            var payWaves = rows[0]["waves"];
            var payMrt = rows[0]["mrt"];
            var payDist = rows[0]["dist"];

            callApi("/addresses/balance/" + worker.address).then(function(data)
            {
               var balanceWaves = data.balance;

               callApi("/assets/balance/" + worker.address + "/" + worker.asset_mrt_id).then(function(data)
               {
                  var balanceMrt = data.balance;

                  callApi("/assets/balance/" + worker.address + "/" + worker.distAssetId).then(function(data)
                        {
                           var balanceDist = data.balance;

                           worker.log("balance waves: " + balanceWaves + ", pay waves: " + payWaves + ", balance mrt: " + balanceMrt + ", pay mrt: " + payMrt + ", balance dist: " + balanceDist + ", pay dist: " + payDist, worker.log_level_info);

                           if(balanceWaves < payWaves || balanceMrt < payMrt || balanceDist < payDist)
                           {
                              worker.log("ERROR: balance unsufficient for paying!", worker.log_level_info);

                              if(worker.isPayment == true)
                              {
                                 reject();
                              }
                              else if(worker.isBalance == true)
                              {
                                 resolve();
                              }
                           }
                           else
                           {
                              worker.log("balance ok for paying -> next", worker.log_level_info);
                              resolve();
                           }
                        }).catch(function(e)
                        {
                           worker.log("ERROR:checking balance failed!", worker.log_level_info);
                           reject();
                        });
                     }).catch(function(e)
                     {
                        worker.log("ERROR: checking balance failed!", worker.log_level_info);
                        reject();
                     });
                  }).catch(function(e)
                  {
                     worker.log("ERROR: checking balance failed!", worker.log_level_info);
                     reject();
                  });
               }).catch(function(e)
               {
                  worker.log("ERROR: checking balance failed!", worker.log_level_info);
                  reject();
               });
            }).catch(function(e)
            {
               worker.log("ERROR: checking balance failed!", worker.log_level_info);
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

   storeLastBlock: function()
   {
      worker.log("start storing last block...", worker.log_level_info);

      return new Promise(function(resolve, reject)
      {
         var query = "update config set value = " + worker.endBlock + " where id_config = " + worker.conf_last_block;

         worker.db.query(query).then(function(result)
         {
            worker.log("last block stored. height: " + worker.endBlock + " -> next", worker.log_level_info);
            resolve();
         }).catch(function(e)
         {
            worker.log("ERROR: last block couldn't be stored: " + e, worker.log_level_info);
            reject();
         });
      });
   },

   updateGenerating: function()
   {
      worker.log("start updating generating...", worker.log_level_info);

      function getGenerating()
      {
         return new Promise(function(resolve, reject)
         {
            request.get({url: worker.node + "/addresses/effectiveBalance/" + worker.address + "/1000", json: true, timeout: 5000, headers:{"Accept": "application/json", "Content-Type": "application/json"}}, function(error, response, body)
            {
               if(error)
               {
                  worker.log("ERROR: generating couldn't be got: " + error, worker.log_level_info);
                  reject();
               }
               else if(response.statusCode != 200)
               {
                  worker.log("ERROR: generating couldn't be got: RESPONSE: " + JSON.stringify(response) + ", BODY: " + JSON.stringify(body), worker.log_level_info);
                  reject();
               }
               else
               {
                  resolve(body.balance);
               }
            });
         });
      }

      return new Promise(function(resolve, reject)
      {
         getGenerating().then(function(generating)
         {
            var query = "update status set generating = " + generating;

            worker.db.query(query).then(function(result)
            {
               worker.log("generating updated -> next", worker.log_level_info);
               resolve();
            }).catch(function(e)
            {
               worker.log("ERROR: generating couldn't be updated: " + e,  worker.log_level_info);
               reject();
            });
         }).catch(function(e)
         {
            worker.log("ERROR: update generating failed!", worker.log_level_info);
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
         subject: "Node 2/" + subject,
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
