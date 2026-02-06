ALTER TABLE `user_profiles` ADD COLUMN `subscriptionStatus` enum('active','canceled','past_due','trialing') DEFAULT 'active' IF NOT EXISTS;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD COLUMN `stripeCustomerId` varchar(255) IF NOT EXISTS;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD COLUMN `stripeSubscriptionId` varchar(255) IF NOT EXISTS;