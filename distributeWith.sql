--
-- import into the database with your favorite name
--

-- ------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `distributeWith`
--

-- --------------------------------------------------------

--
-- Table structure for table `address`
--

CREATE TABLE `address` (
  `id_address` int(10) UNSIGNED NOT NULL,
  `address` varchar(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `asset`
--

CREATE TABLE `asset` (
  `id_asset` int(10) UNSIGNED NOT NULL,
  `id` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `asset`
--

INSERT INTO `asset` (`id_asset`, `id`) VALUES
(2, '4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC'),
(3, 'your_asset_id');

-- --------------------------------------------------------

--
-- Table structure for table `block`
--

CREATE TABLE `block` (
  `id_block` int(10) UNSIGNED NOT NULL,
  `id_node` int(10) UNSIGNED NOT NULL,
  `height` int(10) UNSIGNED NOT NULL,
  `fee` bigint(20) UNSIGNED NOT NULL,
  `mrt` bigint(10) UNSIGNED NOT NULL,
  `wnet` bigint(16) UNSIGNED NOT NULL,
  `tokyo` bigint(15) UNSIGNED NOT NULL,
  `dist` bigint(20) UNSIGNED NOT NULL,
  `tx_count` int(10) UNSIGNED NOT NULL,
  `timestamp` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `config`
--

CREATE TABLE `config` (
  `id_config` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `config`
--

INSERT INTO `config` (`id_config`, `name`, `value`) VALUES
(1, 'last block', '0'),
(2, 'mrt per block', '1000'),
(3, 'waves payout share (%)', '90'),
(4, 'mrt payout share (%)', '90'),
(5, 'last distributed block', '0'),
(6, 'end distribute block', '0'),
(9, 'distribution asset id', 'your_asset_id'),
(10, 'distribution amount per block', '100000000');

-- --------------------------------------------------------

--
-- Table structure for table `distribution`
--

CREATE TABLE `distribution` (
  `id_distribution` int(10) UNSIGNED NOT NULL,
  `height_start` int(10) UNSIGNED NOT NULL,
  `height_end` int(10) UNSIGNED NOT NULL,
  `timestamp` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `journal_line`
--

CREATE TABLE `journal_line` (
  `id_journal_line` int(10) UNSIGNED NOT NULL,
  `id_journal_line_type` int(10) UNSIGNED NOT NULL,
  `id_distribution` int(10) UNSIGNED DEFAULT NULL,
  `id_address` int(10) UNSIGNED NOT NULL,
  `amount` bigint(20) UNSIGNED NOT NULL,
  `id_asset` int(10) UNSIGNED NOT NULL,
  `id_tx` varchar(255) DEFAULT NULL,
  `tx_status` tinyint(1) DEFAULT NULL,
  `id_journal_line_ref` int(10) UNSIGNED DEFAULT NULL,
  `timestamp` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `lease`
--

CREATE TABLE `lease` (
  `id_lease` int(10) UNSIGNED NOT NULL,
  `id_address` int(10) UNSIGNED NOT NULL,
  `id_tx_start` varchar(255) NOT NULL,
  `height_start` int(10) UNSIGNED NOT NULL,
  `id_tx_end` varchar(255) DEFAULT NULL,
  `height_end` int(10) UNSIGNED DEFAULT NULL,
  `amount` bigint(20) UNSIGNED NOT NULL,
  `timestamp_start` datetime NOT NULL,
  `timestamp_end` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `node`
--

CREATE TABLE `node` (
  `id_node` int(10) UNSIGNED NOT NULL,
  `address` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `node`
--

INSERT INTO `node` (`id_node`, `address`) VALUES
(1, 'your_waves_address');

-- --------------------------------------------------------

--
-- Table structure for table `status`
--

CREATE TABLE `status` (
  `id_status` int(1) UNSIGNED NOT NULL,
  `status` int(10) UNSIGNED NOT NULL,
  `generating` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

--
-- Dumping data for table `status`
--

INSERT INTO `status` (`id_status`, `status`, `generating`) VALUES
(1, 0, 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `address`
--
ALTER TABLE `address`
  ADD PRIMARY KEY (`id_address`);

--
-- Indexes for table `asset`
--
ALTER TABLE `asset`
  ADD PRIMARY KEY (`id_asset`);

--
-- Indexes for table `block`
--
ALTER TABLE `block`
  ADD PRIMARY KEY (`id_block`);

--
-- Indexes for table `config`
--
ALTER TABLE `config`
  ADD PRIMARY KEY (`id_config`);

--
-- Indexes for table `distribution`
--
ALTER TABLE `distribution`
  ADD PRIMARY KEY (`id_distribution`);

--
-- Indexes for table `journal_line`
--
ALTER TABLE `journal_line`
  ADD PRIMARY KEY (`id_journal_line`);

--
-- Indexes for table `lease`
--
ALTER TABLE `lease`
  ADD PRIMARY KEY (`id_lease`);

--
-- Indexes for table `node`
--
ALTER TABLE `node`
  ADD PRIMARY KEY (`id_node`);

--
-- Indexes for table `status`
--
ALTER TABLE `status`
  ADD PRIMARY KEY (`id_status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `address`
--
ALTER TABLE `address`
  MODIFY `id_address` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `asset`
--
ALTER TABLE `asset`
  MODIFY `id_asset` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `block`
--
ALTER TABLE `block`
  MODIFY `id_block` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `config`
--
ALTER TABLE `config`
  MODIFY `id_config` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `distribution`
--
ALTER TABLE `distribution`
  MODIFY `id_distribution` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `journal_line`
--
ALTER TABLE `journal_line`
  MODIFY `id_journal_line` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lease`
--
ALTER TABLE `lease`
  MODIFY `id_lease` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `node`
--
ALTER TABLE `node`
  MODIFY `id_node` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
