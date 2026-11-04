const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const PORT = 8088;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEMP_PROFILE = path.join(process.env.TEMP || "C:\\temp", "chrome_qa_profile_" + Date.now());
const OUTPUT_DIR = path.join(__dirname, "output_docs");

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Допоміжна функція для витягнення тексту з word/document.xml всередині DOCX (ZIP)
function extractDocxText(buffer) {
    let offset = 0;
    while (offset + 30 < buffer.length) {
        if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
        const compression = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const nameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const fileName = buffer.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
        const dataStart = offset + 30 + nameLen + extraLen;
        const dataEnd = dataStart + compressedSize;
        if (fileName === 'word/document.xml') {
            const rawData = buffer.slice(dataStart, dataEnd);
            const xml = compression === 8 ? zlib.inflateRawSync(rawData).toString('utf8') : rawData.toString('utf8');
            return xml.replace(/<[^>]+>/g, '');
        }
        offset = dataEnd;
    }
    return '';
}

// 1. Створення простого HTTP-сервера для локальних файлів
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
    let rawPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, rawPath === '/' ? 'index.html' : rawPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not Found: ' + req.url);
    }
});

let chromeProcess = null;

function cleanup() {
    try {
        if (chromeProcess) chromeProcess.kill();
    } catch (e) {}
    try {
        server.close();
    } catch (e) {}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

server.listen(PORT, '127.0.0.1', async () => {
    console.log(`[HTTP Server] Started at http://127.0.0.1:${PORT}`);
    try {
        await runAllTests();
    } catch (err) {
        console.error("[FATAL ERROR]", err);
        cleanup();
        process.exit(1);
    }
});

async function runAllTests() {
    console.log("[Chrome] Starting Chrome headless...");
    chromeProcess = spawn(CHROME_PATH, [
        "--headless=new",
        "--remote-debugging-port=9222",
        `--user-data-dir=${TEMP_PROFILE}`,
        "--no-first-run",
        "--no-default-browser-check"
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const targets = await fetchJson("http://127.0.0.1:9222/json/list");
    let pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
        throw new Error("No page target found in Chrome!");
    }

    console.log("[CDP] Connecting to page:", pageTarget.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let messageId = 1;
    const callbacks = new Map();
    const consoleLogs = [];
    const consoleErrors = [];
    const failedRequests = [];

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            const cb = callbacks.get(msg.id);
            callbacks.delete(msg.id);
            if (msg.error) cb.reject(new Error(msg.error.message));
            else cb.resolve(msg.result);
        }

        if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
            consoleLogs.push({ type: msg.params.type, text });
            if (msg.params.type === 'error') {
                consoleErrors.push(text);
                console.error("  [Browser Console ERROR]:", text);
            }
        } else if (msg.method === 'Runtime.exceptionThrown') {
            const err = msg.params.exceptionDetails.text + (msg.params.exceptionDetails.exception?.description || '');
            consoleErrors.push(err);
            console.error("  [Browser Exception]:", err);
        } else if (msg.method === 'Network.responseReceived') {
            if (msg.params.response.status >= 400 && !msg.params.response.url.endsWith('favicon.ico')) {
                failedRequests.push({ url: msg.params.response.url, status: msg.params.response.status });
                console.error(`  [Network 4xx/5xx]: ${msg.params.response.status} ${msg.params.response.url}`);
            }
        }
    };

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    function sendCmd(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = messageId++;
            callbacks.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evaluate(expression, awaitPromise = true) {
        const res = await sendCmd("Runtime.evaluate", {
            expression,
            awaitPromise,
            returnByValue: true
        });
        if (res.exceptionDetails) {
            throw new Error("Evaluation error: " + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
        }
        return res.result?.value;
    }

    await sendCmd("Page.enable");
    await sendCmd("Runtime.enable");
    await sendCmd("Network.enable");

    console.log("[Navigation] Navigating to http://127.0.0.1:" + PORT + "/index.html ...");
    await sendCmd("Page.navigate", { url: `http://127.0.0.1:${PORT}/index.html` });

    await new Promise(r => setTimeout(r, 2500));

    console.log("\n=======================================================");
    console.log("   ПОЧАТОК ПОВНОГО ЦИКЛУ АВТОНОМНОГО QA ТЕСТУВАННЯ");
    console.log("=======================================================\n");

    // БАЗОВІ ПЕРЕВІРКИ
    console.log("-> ПЕРЕВІРКА 0: Завантаження бібліотек та модулів...");
    const libsLoaded = await evaluate(`({
        docx: typeof window.docx !== 'undefined',
        saveAs: typeof window.saveAs !== 'undefined',
        shevchenko: typeof window.shevchenko !== 'undefined',
        CONFIG: typeof window.CONFIG !== 'undefined',
        DocxGenerator: typeof window.DocxGenerator !== 'undefined',
        AIHelper: typeof window.AIHelper !== 'undefined',
        IncomeCalculator: typeof window.IncomeCalculator !== 'undefined',
        getPlainFormattedDate: typeof window.getPlainFormattedDate === 'function'
    })`);
    console.log("   Статус модулів:", libsLoaded);
    if (!libsLoaded.docx || !libsLoaded.saveAs || !libsLoaded.DocxGenerator || !libsLoaded.IncomeCalculator || !libsLoaded.getPlainFormattedDate) {
        throw new Error("Не всі необхідні модулі завантажено!");
    }
    console.log("   [OK] Усі модулі та функції успішно завантажені.");

    // Перехоплювач збереження DOCX
    await evaluate(`
        window.__savedBlobs = {};
        const originalSaveAs = window.saveAs;
        window.saveAs = function(blob, filename) {
            window.__lastSavedDoc = { filename: filename, size: blob.size, type: blob.type };
            const reader = new FileReader();
            reader.onload = function() {
                window.__savedBlobs[filename] = reader.result.split(',')[1];
            };
            reader.readAsDataURL(blob);
            return originalSaveAs ? originalSaveAs(blob, filename) : null;
        };
    `);

    // =======================================================
    // ТЕСТ 1: Валідація Розширеного розрахунку доходів
    // =======================================================
    console.log("\n-------------------------------------------------------");
    console.log("-> ТЕСТ 1: Валідація Розширеного розрахунку доходів");
    console.log("-------------------------------------------------------");

    await evaluate(`document.getElementById('btnClearClientData').click();`);

    console.log("   1. Обираємо 'п. 1 - Малозабезпечені особи' та заповнюємо обов'язкові поля клієнта...");
    await evaluate(`
        document.getElementById('applicantName').value = 'Коваленко Олександр Іванович';
        document.getElementById('applicantNameGenitive').value = 'Коваленка Олександра Івановича';
        document.getElementById('applicantPhone').value = '+38 (067) 111-22-33';
        document.getElementById('applicantAddress').value = 'м. Одеса, вул. Дерибасівська, 10';
        document.getElementById('applicantPassport').value = 'Паспорт серії КК №123456';
        document.getElementById('helpReceiverName').value = 'Коваленко Олександр Іванович';
        document.getElementById('helpReceiverNameDative').value = 'Коваленку Олександру Івановичу';
        document.getElementById('helpReceiverNameGenitive').value = 'Коваленка Олександра Івановича';

        document.querySelector('input[name="caseType"][value="civil"]').checked = true;
        document.querySelector('input[name="caseType"][value="civil"]').dispatchEvent(new Event('change'));
        document.getElementById('questionDetails').value = 'здійснення представництва інтересів в суді';
        document.getElementById('caseDetails').value = 'про перерахунок пенсії';

        document.getElementById('lawPointSearch').value = 'п. 1 - Малозабезпечені особи';
        document.getElementById('lawPointSearch').dispatchEvent(new Event('input'));

        document.getElementById('workerName').value = 'Сидоренко Марія Іванівна';
        document.getElementById('workerNameGenitive').value = 'Сидоренко Марії Іванівни';
        document.getElementById('rkzkNum').value = '2026-1001';
    `);

    // Спочатку перевіримо, що в режимі 'simple' незаповнені поля Місяць 1, 2, 3 блокують валідацію
    const validInSimpleEmpty = await evaluate(`window.validateForm()`);
    const m1ErrorInSimple = await evaluate(`document.getElementById('incomeMonth1').classList.contains('error-border')`);
    console.log(`   Перевірка у режимі 'simple' з порожніми місяцями: validateForm() = ${validInSimpleEmpty}, m1.error-border = ${m1ErrorInSimple}`);
    if (validInSimpleEmpty || !m1ErrorInSimple) {
        throw new Error("У режимі 'simple' порожні поля Місяць 1, 2, 3 повинні блокувати валідацію!");
    }

    // 2. Перемикаємося на вкладку «⚖️ Розширений розрахунок»
    console.log("   2. Перемикаємося на вкладку '⚖️ Розширений розрахунок' (поля Простого розрахунку залишаються порожніми)...");
    await evaluate(`document.getElementById('tabExtendedCalc').click();`);

    const calcMode = await evaluate(`window.incomeCalcMode`);
    const m1Val = await evaluate(`document.getElementById('incomeMonth1').value`);
    const m2Val = await evaluate(`document.getElementById('incomeMonth2').value`);
    const m3Val = await evaluate(`document.getElementById('incomeMonth3').value`);
    console.log(`   Поточний режим incomeCalcMode: "${calcMode}" | Поля простого розрахунку: ["${m1Val}", "${m2Val}", "${m3Val}"]`);
    if (calcMode !== 'advanced') {
        throw new Error(`Очікувався incomeCalcMode === 'advanced', отримано '${calcMode}'!`);
    }

    // 3. Перевіряємо валідацію та генеруємо Заяву
    const validInAdvanced = await evaluate(`window.validateForm()`);
    const mErrorsInAdvanced = await evaluate(`[
        document.getElementById('incomeMonth1').classList.contains('error-border'),
        document.getElementById('incomeMonth2').classList.contains('error-border'),
        document.getElementById('incomeMonth3').classList.contains('error-border')
    ]`);
    console.log(`   Результат validateForm() у Розширеному розрахунку: ${validInAdvanced} | error-border на Місяць 1,2,3: ${JSON.stringify(mErrorsInAdvanced)}`);

    if (!validInAdvanced || mErrorsInAdvanced.some(Boolean)) {
        throw new Error("У режимі Розширеного розрахунку форма не пройшла валідацію або залишився error-border на полях Простого розрахунку!");
    }

    await evaluate(`window.DocxGenerator.generateDoc();`);
    await new Promise(r => setTimeout(r, 1000));
    const test1DocMeta = await evaluate(`window.__lastSavedDoc`);
    const test1Path = await saveBlobToDisk(test1DocMeta.filename, evaluate);
    console.log(`   [OK] ТЕСТ 1 ПРОЙДЕНО! Форма валідується успішно, згенеровано файл: ${test1DocMeta.filename} (${test1DocMeta.size} байт).`);


    // =======================================================
    // ТЕСТ 2: Дати з провідним нулем (02 листопада 2026 року)
    // =======================================================
    console.log("\n-------------------------------------------------------");
    console.log("-> ТЕСТ 2: Дати з провідним нулем (02 листопада 2026 року)");
    console.log("-------------------------------------------------------");

    console.log("   1. Встановлюємо дату docDate = '2026-11-02'...");
    await evaluate(`
        document.getElementById('docDate').value = '2026-11-02';
        document.getElementById('docDate').dispatchEvent(new Event('change'));
    `);

    const plainDate02Nov = await evaluate(`window.getPlainFormattedDate(document.getElementById('docDate').value)`);
    console.log(`   Виклик getPlainFormattedDate('2026-11-02'): "${plainDate02Nov}"`);
    if (plainDate02Nov !== '02 листопада 2026 року') {
        throw new Error(`Очікувалося "02 листопада 2026 року", отримано "${plainDate02Nov}"`);
    }

    // 2. Попередній перегляд Наказу на адвоката
    console.log("   2. Відкриваємо попередній перегляд Наказу на адвоката (openPreview('order', true))...");
    await evaluate(`window.DocxGenerator.openPreview('order', true);`);
    const orderPreviewHtml = await evaluate(`document.getElementById('previewDocContent').innerHTML`);
    if (!orderPreviewHtml.includes("про надання безоплатної вторинної правничої допомоги від 02 листопада 2026 року,")) {
        throw new Error("Преамбула Наказу не містить очікуваного тексту '...допомоги від 02 листопада 2026 року,'!");
    }
    if (orderPreviewHtml.includes("«02»")) {
        throw new Error("У Наказі знайдено лапки біля дати «02»!");
    }
    console.log("   [OK] Преамбула Наказу на адвоката містить: '...допомоги від 02 листопада 2026 року,' (з нулем, без лапок).");

    // Генерація DOCX Наказу на адвоката та перевірка XML
    await evaluate(`window.DocxGenerator.generateOrder(true);`);
    await new Promise(r => setTimeout(r, 1000));
    const orderDocMeta = await evaluate(`window.__lastSavedDoc`);
    const orderPath = await saveBlobToDisk(orderDocMeta.filename, evaluate);
    const orderXmlText = extractDocxText(fs.readFileSync(orderPath));
    if (!orderXmlText.includes("від 02 листопада 2026 року,")) {
        throw new Error("DOCX Наказу на адвоката не містить тексту 'від 02 листопада 2026 року,'!");
    }
    console.log(`   [OK] DOCX Наказу на адвоката перевірено (${orderDocMeta.filename}).`);

    // 3. Попередній перегляд Службового листа
    console.log("   3. Відкриваємо попередній перегляд Службового листа (openPreview('letter', true))...");
    await evaluate(`window.DocxGenerator.openPreview('letter', true);`);
    const letterPreviewHtml = await evaluate(`document.getElementById('previewDocContent').innerHTML`);
    if (!letterPreviewHtml.includes("<p style=\"margin-top:10px;\">02 листопада 2026 року</p>")) {
        throw new Error("Внизу Службового листа (preview) дата не відповідає формату '02 листопада 2026 року'!");
    }
    if (letterPreviewHtml.includes("«02»")) {
        throw new Error("Внизу Службового листа (preview) залишилися лапки «02»!");
    }
    console.log("   [OK] Внизу Службового листа дата вказана як '02 листопада 2026 року' (без лапок).");
    console.log("   [OK] ТЕСТ 2 ПРОЙДЕНО!");


    // =======================================================
    // ТЕСТ 3: Числові дати без слова «року»
    // =======================================================
    console.log("\n-------------------------------------------------------");
    console.log("-> ТЕСТ 3: Числові дати DD.MM.YYYY без слова «року»");
    console.log("-------------------------------------------------------");

    // 1. Перевірка другого абзацу Службового листа
    console.log("   1. Перевіряємо другий абзац Службового листа (від 02.11.2026 про надання...)...");
    if (!letterPreviewHtml.includes("від 02.11.2026 про надання БВПД")) {
        throw new Error("Другий абзац Службового листа не містить 'від 02.11.2026 про надання БВПД'!");
    }
    if (letterPreviewHtml.includes("02.11.2026 року")) {
        throw new Error("Після числової дати '02.11.2026' залишилося слово 'року'!");
    }
    console.log("   [OK] У Службовому листі дата звернення: 'від 02.11.2026 про надання БВПД' (без слова 'року').");

    // 2. Кримінальне провадження з датою ЄРДР 2026-05-05
    console.log("   2. Обираємо Кримінальне провадження, встановлюємо erdrDate = '2026-05-05'...");
    await evaluate(`
        document.querySelector('input[name="caseType"][value="criminal"]').checked = true;
        document.querySelector('input[name="caseType"][value="criminal"]').dispatchEvent(new Event('change'));
        document.getElementById('erdrNum').value = '12026160000000555';
        document.getElementById('erdrDate').value = '2026-05-05';
        document.getElementById('criminalArticle').value = 'ч. 1 ст. 185 КК України';
        document.getElementById('courtCaseNum').value = '';
    `);

    await evaluate(`window.DocxGenerator.openPreview('zayava');`);
    const crimZayavaPreview = await evaluate(`document.getElementById('previewDocContent').innerHTML`);
    console.log("   Перевірка предмета послуги у Заяві (кримінальне провадження)...");
    if (!crimZayavaPreview.includes("від 05.05.2026 за ч. 1 ст. 185 КК України")) {
        throw new Error("Предмет послуги у Заяві не містить 'від 05.05.2026 за ч. 1 ст. 185 КК України'!");
    }
    if (crimZayavaPreview.includes("05.05.2026 року")) {
        throw new Error("Після дати ЄРДР '05.05.2026' залишилося слово 'року'!");
    }
    console.log("   [OK] У preview Заяви: '...від 05.05.2026 за ч. 1 ст. 185 КК України' (без слова 'року').");

    // Генерація DOCX Заяви для кримінального провадження та перевірка XML
    await evaluate(`window.DocxGenerator.generateDoc();`);
    await new Promise(r => setTimeout(r, 1000));
    const crimDocMeta = await evaluate(`window.__lastSavedDoc`);
    const crimDocPath = await saveBlobToDisk(crimDocMeta.filename, evaluate);
    const crimDocXmlText = extractDocxText(fs.readFileSync(crimDocPath));
    if (!crimDocXmlText.includes("від 05.05.2026 за ч. 1 ст. 185 КК України") || crimDocXmlText.includes("05.05.2026 року")) {
        throw new Error("У DOCX Заяви некоректне форматування дати ЄРДР!");
    }
    console.log(`   [OK] DOCX Заяви перевірено (${crimDocMeta.filename}): слово 'року' після 05.05.2026 відсутнє.`);
    console.log("   [OK] ТЕСТ 3 ПРОЙДЕНО!");


    // =======================================================
    // ТЕСТ 4: Звернення через представника (Службовий лист)
    // =======================================================
    console.log("\n-------------------------------------------------------");
    console.log("-> ТЕСТ 4: Звернення через представника (Службовий лист)");
    console.log("-------------------------------------------------------");

    console.log("   1. Вводимо ПІБ Заявника: 'Іванова Юлія Михайлівна', ПІБ отримувача: 'Петров Петро Петрович'...");
    await evaluate(`
        document.getElementById('applicantName').value = 'Іванова Юлія Михайлівна';
        document.getElementById('applicantNameGenitive').value = 'Іванової Юлії Михайлівни';
        document.getElementById('helpReceiverName').value = 'Петров Петро Петрович';
        document.getElementById('helpReceiverNameDative').value = 'Петрову Петру Петровичу';
        document.getElementById('helpReceiverNameGenitive').value = 'Петрова Петра Петровича';
    `);

    await evaluate(`window.DocxGenerator.openPreview('letter', true);`);
    const repLetterPreview = await evaluate(`document.getElementById('previewDocContent').innerHTML`);
    const expectedRepLetterText = "За результатами розгляду звернення Іванової Юлії Михайлівни в інтересах Петрова Петра Петровича від 02.11.2026 про надання БВПД";

    if (!repLetterPreview.includes(expectedRepLetterText)) {
        throw new Error(`Службовий лист (preview) не містить очікуваного тексту: "${expectedRepLetterText}"`);
    }
    console.log(`   [OK] У preview Службового листа: "${expectedRepLetterText}..."`);

    // Генерація DOCX Службового листа на адвоката та перевірка XML
    await evaluate(`window.DocxGenerator.generateServiceLetter(true);`);
    await new Promise(r => setTimeout(r, 1000));
    const repLetterMeta = await evaluate(`window.__lastSavedDoc`);
    const repLetterPath = await saveBlobToDisk(repLetterMeta.filename, evaluate);
    const repLetterXmlText = extractDocxText(fs.readFileSync(repLetterPath));

    if (!repLetterXmlText.includes(expectedRepLetterText)) {
        throw new Error(`DOCX Службового листа не містить тексту: "${expectedRepLetterText}"`);
    }
    if (!repLetterXmlText.includes("02 листопада 2026 року")) {
        throw new Error("DOCX Службового листа не містить дати внизу '02 листопада 2026 року'!");
    }
    console.log(`   [OK] DOCX Службового листа перевірено (${repLetterMeta.filename}, ${repLetterMeta.size} байт).`);
    console.log("   [OK] ТЕСТ 4 ПРОЙДЕНО!");


    // =======================================================
    // ПІДСУМКОВА ПЕРЕВІРКА ФАЙЛІВ ТА КОНСОЛІ БРАУЗЕРА
    // =======================================================
    console.log("\n-------------------------------------------------------");
    console.log("-> ПІДСУМКОВА ПЕРЕВІРКА ФАЙЛІВ ТА ЛОГІВ БРАУЗЕРА");
    console.log("-------------------------------------------------------");

    const savedFiles = fs.readdirSync(OUTPUT_DIR);
    console.log(`   Файли у папці output_docs (${savedFiles.length}):`, savedFiles);

    for (const file of savedFiles) {
        const filePath = path.join(OUTPUT_DIR, file);
        const buffer = fs.readFileSync(filePath);
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
        console.log(`   ✓ ${file} | Розмір: ${buffer.length} байт | Валідний DOCX/Zip: ${isZip}`);
        if (!isZip || buffer.length < 5000) {
            throw new Error(`Файл ${file} пошкоджений або замалий (${buffer.length} байт)!`);
        }
    }

    console.log("\n-> Статус консолі Chrome:");
    console.log("   Помилок JS в консолі:", consoleErrors.length);
    console.log("   Мережевих помилок (4xx/5xx):", failedRequests.length);

    if (consoleErrors.length > 0) {
        console.error("   Помилки:", consoleErrors);
        throw new Error("Виявлено помилки в консолі браузера!");
    } else {
        console.log("   [OK] Консоль браузера абсолютно чиста (0 помилок).");
    }

    if (failedRequests.length > 0) {
        console.error("   Невдалі запити:", failedRequests);
        throw new Error("Виявлено мережеві помилки!");
    } else {
        console.log("   [OK] Мережеві запити успішні (0 помилок).");
    }

    console.log("\n=======================================================");
    console.log("   УСІ 4 ТЕСТ-КЕЙСИ ПРОЙДЕНО УСПІШНО! (EXIT CODE 0)");
    console.log("=======================================================\n");

    ws.close();
    cleanup();
    process.exit(0);
}

async function saveBlobToDisk(filename, evaluate) {
    let attempts = 0;
    let base64 = null;
    while (attempts < 15 && !base64) {
        base64 = await evaluate(`window.__savedBlobs[${JSON.stringify(filename)}]`);
        if (!base64) await new Promise(r => setTimeout(r, 200));
        attempts++;
    }
    if (!base64) {
        throw new Error(`Не вдалося отримати вміст файлу ${filename} з браузера!`);
    }
    const filePath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return filePath;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}
