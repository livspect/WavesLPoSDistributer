--
-- import into the database with your favorite name
--

-- ------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
 SET NAMES utf8mb4 ;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `address`
--

DROP TABLE IF EXISTS `address`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `address` (
  `id_address` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `address` varchar(36) NOT NULL,
  PRIMARY KEY (`id_address`)
) ENGINE=InnoDB AUTO_INCREMENT=969 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset`
--

DROP TABLE IF EXISTS `asset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `asset` (
  `id_asset` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id` varchar(64) NOT NULL,
  PRIMARY KEY (`id_asset`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `block`
--

DROP TABLE IF EXISTS `block`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `block` (
  `id_block` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_node` int(10) unsigned NOT NULL,
  `height` int(10) unsigned NOT NULL,
  `fee` bigint(20) unsigned NOT NULL,
  `mrt` bigint(10) unsigned NOT NULL,
  `tx_count` int(10) unsigned NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id_block`)
) ENGINE=InnoDB AUTO_INCREMENT=5280 DEFAULT CHARSET=utf8;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `config`
--

DROP TABLE IF EXISTS `config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `config` (
  `id_config` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `value` bigint(10) unsigned NOT NULL,
  PRIMARY KEY (`id_config`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `distribution`
--

DROP TABLE IF EXISTS `distribution`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `distribution` (
  `id_distribution` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `height_start` int(10) unsigned NOT NULL,
  `height_end` int(10) unsigned NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id_distribution`)
) ENGINE=InnoDB AUTO_INCREMENT=167 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `journal_line`
--

DROP TABLE IF EXISTS `journal_line`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `journal_line` (
  `id_journal_line` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_journal_line_type` int(10) unsigned NOT NULL,
  `id_distribution` int(10) unsigned DEFAULT NULL,
  `id_address` int(10) unsigned NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `id_asset` int(10) unsigned NOT NULL,
  `id_tx` varchar(255) DEFAULT NULL,
  `tx_status` tinyint(1) DEFAULT NULL,
  `id_journal_line_ref` int(10) unsigned DEFAULT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id_journal_line`)
) ENGINE=InnoDB AUTO_INCREMENT=221408 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lease`
--

DROP TABLE IF EXISTS `lease`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `lease` (
  `id_lease` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id_address` int(10) unsigned NOT NULL,
  `id_tx_start` varchar(255) NOT NULL,
  `height_start` int(10) unsigned NOT NULL,
  `id_tx_end` varchar(255) DEFAULT NULL,
  `height_end` int(10) unsigned DEFAULT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `timestamp_start` datetime NOT NULL,
  `timestamp_end` datetime DEFAULT NULL,
  PRIMARY KEY (`id_lease`)
) ENGINE=InnoDB AUTO_INCREMENT=1708 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `node`
--

DROP TABLE IF EXISTS `node`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `node` (
  `id_node` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `address` varchar(64) NOT NULL,
  PRIMARY KEY (`id_node`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `richlist`
--

DROP TABLE IF EXISTS `richlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `richlist` (
  `id_richlist` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `address` varchar(36) NOT NULL,
  `balance` bigint(20) unsigned NOT NULL,
  `id_tx` varchar(255) DEFAULT NULL,
  `status` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id_richlist`)
) ENGINE=InnoDB AUTO_INCREMENT=3320 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `status`
--

DROP TABLE IF EXISTS `status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `status` (
  `id_status` int(1) unsigned NOT NULL,
  `status` int(10) unsigned NOT NULL,
  `status_jumpstart` int(10) unsigned NOT NULL,
  `generating` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id_status`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `transaction`
--

DROP TABLE IF EXISTS `transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
 SET character_set_client = utf8mb4 ;
CREATE TABLE `transaction` (
  `id_transaction_type` int(10) unsigned NOT NULL,
  `count` int(10) unsigned NOT NULL,
  `date` date NOT NULL,
  PRIMARY KEY (`id_transaction_type`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
