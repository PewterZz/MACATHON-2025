-- Add created_by column to the requests table
ALTER TABLE requests ADD COLUMN created_by uuid REFERENCES profiles(id);

-- Create RLS policy for users to view their own requests
CREATE POLICY "Users can view their own requests"
  ON requests FOR SELECT
  USING (auth.uid() = created_by);

-- Create RLS policy for users to insert their own requests
CREATE POLICY "Users can create their own requests"
  ON requests FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Create RLS policy for users to view messages for their own requests
CREATE POLICY "Users can view messages for their own requests"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_id
      AND requests.created_by = auth.uid()
    )
  );

-- Create RLS policy for users to insert messages to their own requests
CREATE POLICY "Users can insert messages to their own requests"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_id
      AND requests.created_by = auth.uid()
    ) AND
    sender = 'caller'
  ); 