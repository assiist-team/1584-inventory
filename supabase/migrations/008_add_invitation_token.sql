-- Add token column to invitations table for link-based invitations
ALTER TABLE invitations ADD COLUMN token TEXT UNIQUE;

-- Create index on token for fast lookups
CREATE INDEX idx_invitations_token ON invitations(token);

-- Generate tokens for existing pending invitations (optional, for existing data)
UPDATE invitations 
SET token = encode(gen_random_bytes(32), 'hex')
WHERE token IS NULL AND status = 'pending';

