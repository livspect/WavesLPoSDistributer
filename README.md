# WavesLPoSDistributer
A revenue distribution tool for Waves nodes

## Installation
First of all, you need to install Node.js (https://nodejs.org/en/) and NPM. Afterwards the installation of the dependencies could be done via:
```sh
npm install
cp .env-sample .env
```
Edit `.env` file as comment shows.
Once the dependencies are installed, the script that generates the payouts need to be configured. After putting the settings of the file you want to use, import the dump file into mysql with any name.

## distribute.js
When you just run the script, it collects information especially block and leasing for distribution.
Enter the following to run the program:
```sh
/*
 Replace your_waves_address to your waves address in the node table.
 Make sure to run periodically with cron.
 (better to run manually for the first time)
*/
node distribute.js
```
Find the latest mined block height from the block table and overwrite end distribute block in the config table.
After preparing, the calculation could be started with:
```sh
/*
 If an error occurs, the status field of the status table will be 2.
 Stopped: 0
 Running: 1
 Error:2
*/
node distribute.js dist
```
After calculating, chacking balance could be started with:
```sh
/*
 Note: The distribution of MRT is once a day.
*/
node distribute.js balance
```
After chacking balance for distribution, paying could be started with:
```sh
node distribute.js pay
```
## airdrop.js
This is not just a script for airdrop. It is, basically the same as distributor, able to distribute any amount of the token depending on the number of blocks mined in addition to holding and fluctuation rate. Do the following after distributing the assets in some way, such as an original airdrop script.
```sh
/*
 In the asset table replace your_asset_id to the asset ID which recognized by wavesplatform.
 Adjust airdrop amount in the config table.
 Make sure to run periodically with cron.
 (better to run manually for the first time)
*/
node airdrop.js

node airdrop.js dist
node airdrop.js balance
node airdrop.js pay
```
## dex.js
By running this script periodically, part of the data present in the blockchain is incorporated into the database.
```sh
/*
 Make sure to run periodically with cron.
*/
node dex.js
```

## distributeWith.js
You can distribute any asset in addition to WAVES and MRT. Once you have imported the dump file, you need to find your_asset_id and replace it with what you whould like to distribute. The basic operation is the same as the distribute.js script.
