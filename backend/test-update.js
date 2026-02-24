/**
 * End-to-end test: simulates the exact browser flow for report editing
 */
const http = require('http');
const fs = require('fs');

function httpRequest(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body && typeof body === 'string') headers['Content-Type'] = 'application/json';
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: headers
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

const log = [];

(async () => {
    try {
        // Login
        const loginRes = await httpRequest('POST', '/api/auth/login', JSON.stringify({
            email: 'admin@invias.gov.co',
            password: 'admin123'
        }));
        const token = loginRes.body?.token;
        log.push('Token: ' + (token ? 'OK' : 'FAIL'));

        // PUT
        const newTitle = 'TITULO_TEST_' + Date.now();
        const putBody = JSON.stringify({
            title: newTitle,
            description: 'Desc test',
            is_public: true,
            is_featured: true
        });
        log.push('Sending PUT with title: ' + newTitle);

        const putRes = await httpRequest('PUT', '/api/reports/rep-001', putBody, token);
        log.push('PUT status: ' + putRes.status);
        log.push('PUT response title: ' + putRes.body?.title);
        log.push('PUT response updated_at: ' + putRes.body?.updated_at);

        // Wait a moment then check GET
        await new Promise(r => setTimeout(r, 500));

        const getRes = await httpRequest('GET', '/api/reports?page=1&limit=20', null, token);
        log.push('GET first report title: ' + getRes.body?.reports?.[0]?.title);
        log.push('Title matches: ' + (getRes.body?.reports?.[0]?.title === newTitle));

    } catch (e) {
        log.push('ERROR: ' + e.message);
    }

    fs.writeFileSync('test-flow-result.txt', log.join('\n'));
    console.log('Done');
    process.exit(0);
})();
