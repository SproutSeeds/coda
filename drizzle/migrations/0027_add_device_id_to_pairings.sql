-- Add device_id column to track stable device identifiers across pairing attempts
ALTER TABLE dev_pairings ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_dev_pairings_device_id ON dev_pairings(device_id);

-- Create index for userId + runnerId lookups (for finding existing runners per user)
CREATE INDEX IF NOT EXISTS idx_dev_pairings_user_runner ON dev_pairings(user_id, runner_id) WHERE state = 'approved';
