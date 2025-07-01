CREATE POLICY "Allow authenticated users to insert notification logs"
ON public.transfer_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
