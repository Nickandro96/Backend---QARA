ALTER TABLE `user_profiles` ADD `subscriptionStatus` enum('active','canceled','past_due','trialing') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `stripeSubscriptionId` varchar(255);