const http = require('http');
const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:3000';
const SERVICE_KEY = 'test_service_key_123';
const USER_ID = '11111111-1111-1111-1111-111111111111';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    if (body) {
      reqOpts.headers['Content-Type'] = 'application/json';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSmokeTest() {
  console.log('====================================================');
  console.log('   OnCallHQ End-to-End System Smoke Test');
  console.log('====================================================\n');

  const results = [];

  // Step 1: Health Check
  try {
    const res = await request(`${BACKEND_URL}/health`);
    console.log('[STEP 1] Backend Health Check:', res.status === 200 ? 'PASS' : 'FAIL', res.data);
    results.push({ step: '1. Backend Health Check', status: res.status === 200 ? 'PASS' : 'FAIL' });
  } catch (err) {
    console.error('[STEP 1] Health Check Error:', err.message);
    results.push({ step: '1. Backend Health Check', status: 'FAIL', error: err.message });
  }

  // Step 2: Frontend Check
  try {
    const res = await request(`${FRONTEND_URL}/`);
    console.log('[STEP 2] Frontend Home Page:', res.status === 200 ? 'PASS' : 'FAIL');
    results.push({ step: '2. Frontend Server Check', status: res.status === 200 ? 'PASS' : 'FAIL' });
  } catch (err) {
    console.error('[STEP 2] Frontend Check Error:', err.message);
    results.push({ step: '2. Frontend Server Check', status: 'FAIL', error: err.message });
  }

  // Step 3: WebSocket Listener Setup
  const receivedWsEvents = [];
  const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
  socket.on('incident:created', (data) => {
    console.log('[WS EVENT] incident:created ->', data.id, data.title);
    receivedWsEvents.push({ event: 'created', data });
  });
  socket.on('incident:update', (data) => {
    console.log('[WS EVENT] incident:update ->', data.id, 'state:', data.state);
    receivedWsEvents.push({ event: 'update', data });
  });
  await new Promise((r) => setTimeout(r, 500));

  // Step 4: Webhook Ingestion API (Unique targetResource to trigger fresh incident)
  let incidentId = null;
  const targetResource = `node-${Date.now()}`;
  try {
    const alertBody = {
      alertName: 'High CPU Load',
      targetResource: targetResource,
      severity: 'CRITICAL',
      title: `High CPU Load on ${targetResource}`,
      description: 'CPU load exceeded 95% for 5 consecutive minutes',
    };
    const res = await request(`${BACKEND_URL}/ingest/${SERVICE_KEY}`, { method: 'POST' }, alertBody);
    console.log('[STEP 3] Alert Ingestion API Response:', res.status, res.data);
    if ((res.status === 200 || res.status === 201) && res.data.incidentId && res.data.status === 'triggered') {
      incidentId = res.data.incidentId;
      results.push({ step: '3. Webhook Alert Ingestion', status: 'PASS', incidentId, fingerprint: res.data.fingerprint });
    } else {
      results.push({ step: '3. Webhook Alert Ingestion', status: 'FAIL', response: res.data });
    }
  } catch (err) {
    console.error('[STEP 3] Ingestion Error:', err.message);
    results.push({ step: '3. Webhook Alert Ingestion', status: 'FAIL', error: err.message });
  }

  if (!incidentId) {
    console.error('Smoke test aborted: Ingestion failed to produce a new triggered incident ID.');
    socket.disconnect();
    return;
  }

  await new Promise((r) => setTimeout(r, 500));

  // Step 5: Verify Incident in List & Details API
  try {
    const listRes = await request(`${BACKEND_URL}/api/v1/incidents`);
    const detailRes = await request(`${BACKEND_URL}/api/v1/incidents/${incidentId}`);

    const foundInList = Array.isArray(listRes.data) && listRes.data.some((i) => i.id === incidentId);
    const detailOk = detailRes.status === 200 && detailRes.data.id === incidentId;

    console.log('[STEP 4] Incident List & Details API:', foundInList && detailOk ? 'PASS' : 'FAIL');
    results.push({
      step: '4. Incident List & Detail API Verification',
      status: foundInList && detailOk ? 'PASS' : 'FAIL',
      initialState: detailRes.data.state,
      assignedUser: detailRes.data.assignedUserId,
    });
  } catch (err) {
    console.error('[STEP 4] List/Detail Error:', err.message);
    results.push({ step: '4. Incident List & Detail API Verification', status: 'FAIL', error: err.message });
  }

  // Step 6: Acknowledge Incident API
  try {
    const ackRes = await request(`${BACKEND_URL}/api/v1/incidents/${incidentId}/acknowledge`, { method: 'POST' }, { userId: USER_ID });
    console.log('[STEP 5] Incident Acknowledge API Response:', ackRes.status, 'state:', ackRes.data.state, 'ackedAt:', ackRes.data.ackedAt);
    const ackPass = ackRes.status === 200 && ackRes.data.state === 'ACKNOWLEDGED' && !!ackRes.data.ackedAt;
    results.push({
      step: '5. Acknowledge Action',
      status: ackPass ? 'PASS' : 'FAIL',
      state: ackRes.data.state,
      ackedAt: ackRes.data.ackedAt,
    });
  } catch (err) {
    console.error('[STEP 5] Acknowledge Error:', err.message);
    results.push({ step: '5. Acknowledge Action', status: 'FAIL', error: err.message });
  }

  await new Promise((r) => setTimeout(r, 500));

  // Step 7: Resolve Incident API
  try {
    const resRes = await request(`${BACKEND_URL}/api/v1/incidents/${incidentId}/resolve`, { method: 'POST' }, { userId: USER_ID });
    console.log('[STEP 6] Incident Resolve API Response:', resRes.status, 'state:', resRes.data.state, 'resolvedAt:', resRes.data.resolvedAt);
    const resPass = resRes.status === 200 && resRes.data.state === 'RESOLVED' && !!resRes.data.resolvedAt;
    results.push({
      step: '6. Resolve Action',
      status: resPass ? 'PASS' : 'FAIL',
      state: resRes.data.state,
      resolvedAt: resRes.data.resolvedAt,
    });
  } catch (err) {
    console.error('[STEP 6] Resolve Error:', err.message);
    results.push({ step: '6. Resolve Action', status: 'FAIL', error: err.message });
  }

  await new Promise((r) => setTimeout(r, 500));

  // Step 8: Verify Audit Logs & Timeline
  try {
    const auditRes = await request(`${BACKEND_URL}/api/v1/audit/INCIDENT/${incidentId}`);
    const logs = Array.isArray(auditRes.data) ? auditRes.data : [];
    const actions = logs.map((l) => l.action);
    console.log('[STEP 7] Audit Timeline Events:', actions);

    const hasTriggered = actions.includes('INCIDENT_TRIGGERED');
    const hasAcked = actions.includes('INCIDENT_ACKNOWLEDGED');
    const hasResolved = actions.includes('INCIDENT_RESOLVED');

    const pass = hasTriggered && hasAcked && hasResolved;
    results.push({
      step: '7. Audit Timeline Verification',
      status: pass ? 'PASS' : 'FAIL',
      recordedActions: actions,
    });
  } catch (err) {
    console.error('[STEP 7] Audit Error:', err.message);
    results.push({ step: '7. Audit Timeline Verification', status: 'FAIL', error: err.message });
  }

  // Step 9: Verify WebSocket Events Received
  const wsPass = receivedWsEvents.length > 0;
  console.log('[STEP 8] WebSocket Events Received:', receivedWsEvents.length, 'events ->', wsPass ? 'PASS' : 'FAIL');
  results.push({
    step: '8. WebSocket Real-Time Event Broadcast',
    status: wsPass ? 'PASS' : 'FAIL',
    receivedCount: receivedWsEvents.length,
  });

  socket.disconnect();

  console.log('\n====================================================');
  console.log('   Final Smoke Test Results Summary');
  console.log('====================================================');
  console.table(results);
}

runSmokeTest().catch(console.error);
