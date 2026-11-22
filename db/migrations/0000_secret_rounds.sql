ALTER TABLE `rooms`
  ADD COLUMN `heat` int NOT NULL DEFAULT 12,
  ADD COLUMN `streak` int NOT NULL DEFAULT 0,
  ADD COLUMN `completed_cards` int NOT NULL DEFAULT 0,
  ADD COLUMN `secret_status` enum('none','writing','countdown') NOT NULL DEFAULT 'none',
  ADD COLUMN `secret_prompt` int,
  ADD COLUMN `secret_answers` text NOT NULL,
  ADD COLUMN `secret_history` text NOT NULL,
  ADD COLUMN `secret_reveal_at` timestamp NULL;
