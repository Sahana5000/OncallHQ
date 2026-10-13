const { Client } = require('pg');

async function seed() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1234',
    database: 'oncallhq',
  });

  await client.connect();

  await client.query(`
    INSERT INTO users (id, email, name, role)
    VALUES ('11111111-1111-1111-1111-111111111111', 'smoke@oncallhq.com', 'Smoke Test User', 'RESPONDER')
    ON CONFLICT (email) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO services (id, org_id, name, description, ingestion_key, fallback_user_id)
    VALUES ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'Smoke Test Service', 'E2E Smoke Test Service', 'test_service_key_123', '11111111-1111-1111-1111-111111111111')
    ON CONFLICT (ingestion_key) DO NOTHING;
  `);

  console.log('Seed user and service created successfully!');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
