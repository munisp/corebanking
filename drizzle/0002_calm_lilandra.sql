CREATE TABLE `customerSessionPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` varchar(96) NOT NULL,
	`actorRole` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`activeCustomerId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customerSessionPreferences_id` PRIMARY KEY(`id`)
);
