CREATE TABLE `regulatory_sources` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `url_base` varchar(2048) NOT NULL,
  `type` enum('rss','rest','odata','sparql','html','pdf') NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `last_collected_at` timestamp NULL,
  `last_success_at` timestamp NULL,
  `last_error` text NULL,
  `last_error_at` timestamp NULL,
  `frequency` varchar(100) NOT NULL,
  `access_type` varchar(100) NOT NULL,
  `commercial_use_allowed` boolean NULL,
  `licence_notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
