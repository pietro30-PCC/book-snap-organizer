
CREATE POLICY "capas leitura publica" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'capas');
CREATE POLICY "capas envio publico" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'capas');
CREATE POLICY "capas remocao publica" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'capas');
