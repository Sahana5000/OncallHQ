const http = require('http');

const BACKEND_URL = 'http://127.0.0.1:4000';
const FRONTEND_URL = 'http://127.0.0.1:3000';
const SERVICE_KEY = 'test_service_key_123';

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

async function runAudit() {
  console.log('================================================================');
  console.log('    OnCallHQ Comprehensive Live Final Integration Audit');
  console.log('================================================================\n');

  const auditLog = [];

  function record(checkId, description, passed, details = '') {
    auditLog.push({ checkId, description, status: passed ? 'PASS' : 'FAIL', details });
    const mark = passed ? '[PASS]' : '[FAIL]';
    console.log(`${mark} ${checkId}: ${description}`);
    if (details) console.log(`       Details: ${details}`);
  }

  // CHECK 1: Health Check
  try {
    const health = await request(`${BACKEND_URL}/health`);
    record(
      'CHK-01',
      'Backend Health Check (/health)',
      health.status === 200 && health.data.status === 'ok',
      `HTTP ${health.status}, status=${health.data?.status}`
    );
  } catch (err) {
    record('CHK-01', 'Backend Health Check', false, err.message);
  }

  // CHECK 2: Frontend Server Availability
  try {
    const fe = await request(`${FRONTEND_URL}/`);
    record(
      'CHK-02',
      'Frontend Production Server (/ - Home Page)',
      fe.status === 200,
      `HTTP ${fe.status}`
    );
  } catch (err) {
    record('CHK-02', 'Frontend Production Server', false, err.message);
  }

  // CHECK 3: Frontend Feature Routes (/login, /register, /maintenance, /analytics)
  const feRoutes = ['/login', '/register', '/maintenance', '/analytics', '/incidents', '/schedules'];
  let allFeRoutesOk = true;
  for (const r of feRoutes) {
    try {
      const res = await request(`${FRONTEND_URL}${r}`);
      if (res.status !== 200) allFeRoutesOk = false;
    } catch {
      allFeRoutesOk = false;
    }
  }
  record(
    'CHK-03',
    'Frontend Feature Route Availability (Login, Register, Maintenance, Analytics)',
    allFeRoutesOk,
    `Verified 6 routes: ${feRoutes.join(', ')}`
  );

  // CHECK 4: Unauthenticated Request to Protected Endpoint returns 401
  try {
    const unauth = await request(`${BACKEND_URL}/api/v1/incidents`);
    record(
      'CHK-04',
      'Unauthenticated API Guard (GET /api/v1/incidents without token -> 401)',
      unauth.status === 401,
      `HTTP ${unauth.status}, expected 401`
    );
  } catch (err) {
    record('CHK-04', 'Unauthenticated API Guard', false, err.message);
  }

  // CHECK 5: User Registration & JWT Issuance (ADMIN, LEAD, RESPONDER)
  const testRunId = Date.now();
  let adminToken = null;
  let leadToken = null;
  let respToken = null;
  let respUserId = null;

  try {
    const adminReg = await request(`${BACKEND_URL}/api/v1/auth/register`, { method: 'POST' }, {
      email: `admin-${testRunId}@oncallhq.com`,
      password: 'AdminPassword123!',
      name: 'Audit Admin',
      role: 'ADMIN',
    });
    adminToken = adminReg.data.accessToken;

    const leadReg = await request(`${BACKEND_URL}/api/v1/auth/register`, { method: 'POST' }, {
      email: `lead-${testRunId}@oncallhq.com`,
      password: 'LeadPassword123!',
      name: 'Audit Lead',
      role: 'LEAD',
    });
    leadToken = leadReg.data.accessToken;

    const respReg = await request(`${BACKEND_URL}/api/v1/auth/register`, { method: 'POST' }, {
      email: `resp-${testRunId}@oncallhq.com`,
      password: 'RespPassword123!',
      name: 'Audit Responder',
      role: 'RESPONDER',
    });
    respToken = respReg.data.accessToken;
    respUserId = respReg.data.user.id;

    record(
      'CHK-05',
      'User Registration & JWT Issuance for ADMIN, LEAD, RESPONDER',
      Boolean(adminToken && leadToken && respToken),
      `Tokens issued successfully. Roles: ADMIN, LEAD, RESPONDER`
    );
  } catch (err) {
    record('CHK-05', 'User Registration & JWT Issuance', false, err.message);
  }

  // CHECK 6: JWT Login & Token Validation via /api/v1/auth/me
  try {
    const loginRes = await request(`${BACKEND_URL}/api/v1/auth/login`, { method: 'POST' }, {
      email: `admin-${testRunId}@oncallhq.com`,
      password: 'AdminPassword123!',
    });
    const loggedToken = loginRes.data.accessToken;

    const meRes = await request(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${loggedToken}` },
    });

    record(
      'CHK-06',
      'JWT Login & Identity Verification (/api/v1/auth/me)',
      loginRes.status === 200 && meRes.status === 200 && meRes.data.role === 'ADMIN',
      `Login HTTP ${loginRes.status}, Auth/me: email=${meRes.data?.email}, role=${meRes.data?.role}`
    );
  } catch (err) {
    record('CHK-06', 'JWT Login & Identity Verification', false, err.message);
  }

  // CHECK 7: RBAC Server-Side Enforcement (RESPONDER cannot create maintenance window -> 403)
  let testServiceId = '22222222-2222-2222-2222-222222222222';
  try {
    const forbiddenRes = await request(`${BACKEND_URL}/api/v1/maintenance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${respToken}` },
    }, {
      serviceId: testServiceId,
      name: 'Unauthorized Window',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
    });

    record(
      'CHK-07',
      'RBAC Enforcement: RESPONDER Forbidden to Create Maintenance Window (403)',
      forbiddenRes.status === 403,
      `HTTP ${forbiddenRes.status}, message: ${JSON.stringify(forbiddenRes.data?.message)}`
    );
  } catch (err) {
    record('CHK-07', 'RBAC Enforcement', false, err.message);
  }

  // CHECK 8: Maintenance Window Creation (ADMIN / LEAD authorized)
  let maintWindowId = null;
  const now = Date.now();
  const startTime = new Date(now - 10 * 60 * 1000).toISOString(); // 10 mins ago
  const endTime = new Date(now + 60 * 60 * 1000).toISOString();   // 1 hour later

  try {
    const createMaintRes = await request(`${BACKEND_URL}/api/v1/maintenance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      serviceId: testServiceId,
      name: `Audit Maintenance ${testRunId}`,
      description: 'Scheduled DB Maintenance during audit test',
      startTime,
      endTime,
    });

    maintWindowId = createMaintRes.data?.id;
    record(
      'CHK-08',
      'Maintenance Window Creation by ADMIN/LEAD',
      createMaintRes.status === 201 && !!maintWindowId,
      `Window ID=${maintWindowId}, start=${startTime}, end=${endTime}`
    );
  } catch (err) {
    record('CHK-08', 'Maintenance Window Creation', false, err.message);
  }

  // CHECK 9: Alert Noise Suppression during Active Maintenance Window
  const suppressedTarget = `node-suppressed-${testRunId}`;
  try {
    const suppressRes = await request(`${BACKEND_URL}/ingest/${SERVICE_KEY}`, { method: 'POST' }, {
      alertName: 'DiskIOpsSpike',
      targetResource: suppressedTarget,
      severity: 'CRITICAL',
      title: 'Disk IOPS Spike during maintenance',
      description: 'Expected spike during DB re-indexing',
    });

    record(
      'CHK-09',
      'Alert Noise Suppression during Maintenance Window',
      suppressRes.status === 200 &&
      suppressRes.data.status === 'suppressed' &&
      suppressRes.data.action === 'ALERT_SUPPRESSED_MAINTENANCE',
      `status=${suppressRes.data?.status}, action=${suppressRes.data?.action}`
    );
  } catch (err) {
    record('CHK-09', 'Alert Noise Suppression', false, err.message);
  }

  // CHECK 10: Alert Suppression Audit Log Recorded
  try {
    // Check audit log for suppressed alert
    const auditRes = await request(`${BACKEND_URL}/api/v1/audit/SERVICE/${testServiceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const suppressedLogs = Array.isArray(auditRes.data) ? auditRes.data.filter(l => l.action === 'ALERT_SUPPRESSED_MAINTENANCE') : [];
    record(
      'CHK-10',
      'Audit Trail for Suppressed Alerts Recorded',
      suppressedLogs.length > 0,
      `Found ${suppressedLogs.length} ALERT_SUPPRESSED_MAINTENANCE entries in service audit log`
    );
  } catch (err) {
    record('CHK-10', 'Suppression Audit Log', false, err.message);
  }

  // CHECK 11: Normal Alert Processing after Maintenance Window Ends
  // Update the maintenance window to end in the past
  let activeIncidentId = null;
  const normalTarget = `node-normal-${testRunId}`;
  try {
    // End maintenance window
    await request(`${BACKEND_URL}/api/v1/maintenance/${maintWindowId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
    }, {
      endTime: new Date(now - 1000).toISOString(), // 1 second ago (expired)
    });

    // Ingest alert now that maintenance window has expired
    const normalAlertRes = await request(`${BACKEND_URL}/ingest/${SERVICE_KEY}`, { method: 'POST' }, {
      alertName: 'HighCPUUsage',
      targetResource: normalTarget,
      severity: 'HIGH',
      title: `High CPU on ${normalTarget}`,
      description: 'CPU threshold exceeded after maintenance ended',
    });

    activeIncidentId = normalAlertRes.data?.incidentId;
    record(
      'CHK-11',
      'Alert Processing Normally Resumes After Maintenance Window Ends',
      normalAlertRes.status === 200 &&
      normalAlertRes.data.status === 'triggered' &&
      normalAlertRes.data.action === 'INCIDENT_TRIGGERED' &&
      !!activeIncidentId,
      `status=${normalAlertRes.data?.status}, action=${normalAlertRes.data?.action}, incidentId=${activeIncidentId}`
    );
  } catch (err) {
    record('CHK-11', 'Alert Processing After Maintenance', false, err.message);
  }

  // CHECK 12: Alert Deduplication on Same Target / Fingerprint
  try {
    const dedupAlertRes = await request(`${BACKEND_URL}/ingest/${SERVICE_KEY}`, { method: 'POST' }, {
      alertName: 'HighCPUUsage',
      targetResource: normalTarget,
      severity: 'HIGH',
      title: `High CPU on ${normalTarget}`,
    });

    record(
      'CHK-12',
      'Alert Deduplication Engine',
      dedupAlertRes.status === 200 &&
      dedupAlertRes.data.status === 'deduplicated' &&
      dedupAlertRes.data.alertCount >= 2,
      `status=${dedupAlertRes.data?.status}, alertCount=${dedupAlertRes.data?.alertCount}`
    );
  } catch (err) {
    record('CHK-12', 'Alert Deduplication Engine', false, err.message);
  }

  // CHECK 13: Incident Lifecycle: Acknowledge & Resolve
  try {
    const ackRes = await request(`${BACKEND_URL}/api/v1/incidents/${activeIncidentId}/acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${respToken}` },
    }, { userId: respUserId });

    // Wait a brief delay to simulate resolution time
    await new Promise((r) => setTimeout(r, 600));

    const resolveRes = await request(`${BACKEND_URL}/api/v1/incidents/${activeIncidentId}/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${respToken}` },
    }, { userId: respUserId });

    record(
      'CHK-13',
      'Incident Acknowledge and Resolve Actions',
      ackRes.status === 200 && ackRes.data.state === 'ACKNOWLEDGED' &&
      resolveRes.status === 200 && resolveRes.data.state === 'RESOLVED',
      `Ack: state=${ackRes.data?.state}, Resolve: state=${resolveRes.data?.state}, resolvedAt=${resolveRes.data?.resolvedAt}`
    );
  } catch (err) {
    record('CHK-13', 'Incident Lifecycle', false, err.message);
  }

  // CHECK 14: MTTA / MTTR Analytics from Real Incidents
  try {
    const analyticsOverview = await request(`${BACKEND_URL}/api/v1/analytics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const ov = analyticsOverview.data;
    const hasMtta = typeof ov.mtta?.minutes === 'number' && ov.mtta.minutes >= 0;
    const hasMttr = typeof ov.mttr?.minutes === 'number' && ov.mttr.minutes >= 0;
    const hasIncidents = ov.totalIncidents > 0;

    record(
      'CHK-14',
      'MTTA and MTTR Real Mathematical Analytics (/api/v1/analytics/overview)',
      analyticsOverview.status === 200 && hasMtta && hasMttr && hasIncidents,
      `totalIncidents=${ov.totalIncidents}, mttaMinutes=${ov.mtta?.minutes}, mttrMinutes=${ov.mttr?.minutes}, resolvedCount=${ov.resolvedCount}`
    );
  } catch (err) {
    record('CHK-14', 'MTTA and MTTR Analytics', false, err.message);
  }

  // CHECK 15: Service-Wise Analytics & Trend Bucketing
  try {
    const svcAnalytics = await request(`${BACKEND_URL}/api/v1/analytics/services`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const trendsAnalytics = await request(`${BACKEND_URL}/api/v1/analytics/trends?days=7`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const svcList = Array.isArray(svcAnalytics.data) ? svcAnalytics.data : [];
    const trendBuckets = Array.isArray(trendsAnalytics.data) ? trendsAnalytics.data : [];

    record(
      'CHK-15',
      'Service Breakdown and Trend Bucketing APIs',
      svcAnalytics.status === 200 && trendsAnalytics.status === 200 && svcList.length > 0 && trendBuckets.length > 0,
      `Services count=${svcList.length}, Trend buckets count=${trendBuckets.length}`
    );
  } catch (err) {
    record('CHK-15', 'Service Breakdown and Trend Bucketing', false, err.message);
  }

  // CLEANUP: Delete temporary maintenance window
  if (maintWindowId) {
    try {
      await request(`${BACKEND_URL}/api/v1/maintenance/${maintWindowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
    } catch {
      // ignore
    }
  }

  console.log('\n================================================================');
  console.log('    Audit Execution Summary Table');
  console.log('================================================================');
  console.table(auditLog);

  const total = auditLog.length;
  const passed = auditLog.filter(l => l.status === 'PASS').length;
  const failed = auditLog.filter(l => l.status === 'FAIL').length;
  console.log(`\nTOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error('\nAUDIT FAILED: Some checks did not pass.');
    process.exit(1);
  } else {
    console.log('\nAUDIT SUCCESS: All live checks passed flawlessly!');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
