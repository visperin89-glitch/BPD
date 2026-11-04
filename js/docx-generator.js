/**
 * Модуль генерації та попереднього перегляду документів DOCX для системи БВПД (версія 2.10)
 * Забезпечує точне дотримання юридичних правил оформлення (ДСТУ, Times New Roman, відступи, таблиці).
 */

// Допоміжні функції форматування дат та імен
function getFormattedDate(d) {
    if (!d) return "«__» ____ 20__";
    const m = window.MONTH_NAMES_GENITIVE || ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
    return `«${String(d.getDate()).padStart(2, '0')}» ${m[d.getMonth()]} ${d.getFullYear()}`;
}

function getPlainFormattedDate(d) {
    if (d && typeof d === 'object' && !(d instanceof Date) && d.docDate !== undefined) {
        d = d.docDate;
    }
    const m = window.MONTH_NAMES_GENITIVE || ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
    if (!d) return "__ ________ 20__ року";
    if (typeof d === 'string') {
        const parts = d.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            const day = String(parseInt(parts[2], 10)).padStart(2, '0');
            return `${day} ${m[monthIdx]} ${year} року`;
        }
        d = new Date(d);
    }
    if (d instanceof Date && !isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')} ${m[d.getMonth()]} ${d.getFullYear()} року`;
    }
    return "__ ________ 20__ року";
}

function getShortDate(d) {
    return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : "__.__.____";
}

function formatInitialsSurnameDative(val) {
    if (!val) return "";
    const p = val.trim().split(/\s+/);
    return p.length >= 3 ? `${p[1][0]}. ${p[2][0]}. ${p[0]}` : val;
}

function formatWorkerNameUpper(val) {
    if (!val) return "";
    const p = val.trim().split(/\s+/);
    return p.length >= 2 ? `${p[1]} ${p[0].toUpperCase()}` : val.toUpperCase();
}

/**
 * Отримання активного герба (збережений користувачем або типовий вшитий)
 */
function getActiveTryzub() {
    return localStorage.getItem('savedTryzub') || window.DEFAULT_TRYZUB_BASE64 || '';
}

/**
 * Конвертація Base64 data-URI в ArrayBuffer для ImageRun бібліотеки docx
 */
function base64ToArrayBuffer(base64) {
    if (!base64) return null;
    try {
        const parts = base64.split(',');
        const binaryString = window.atob(parts.length > 1 ? parts[1] : parts[0]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("Помилка конвертації base64 в ArrayBuffer:", e);
        return null;
    }
}

/**
 * Побудова назви файлу для завантаження
 */
function buildFileName(docName, isOrder = false) {
    const clientName = document.getElementById('helpReceiverName')?.value.trim() || document.getElementById('applicantName')?.value.trim() || "Клієнт";
    const surname = clientName.split(/\s+/)[0] || "Клієнт";
    
    let rkzk = document.getElementById('rkzkNum')?.value.trim() || "Без_РКЗК";
    rkzk = rkzk.replace(/[\\/:*?"<>|]/g, '_'); 
    
    const prefix = isOrder ? `1_${docName}` : docName;
    return `${prefix}_${surname}_${rkzk}.docx`;
}

/**
 * Збір даних з полів форми
 */
function collectData() {
    const gV = (id) => document.getElementById(id)?.value?.trim() || "";
    const lawPointHidden = document.getElementById('lawPointSelect');
    const rawL = lawPointHidden?.value || "";
    const lawConfig = window.CONFIG?.LAW_SHORT_NAMES || {};
    
    const caseType = document.querySelector('input[name="caseType"]:checked')?.value || 'civil';
    let actionDesc = "";
    
    if (caseType === 'civil') {
        actionDesc = `${gV('questionDetails')} у справі ${gV('caseDetails')}`;
    } else if (caseType === 'criminal') {
        const erdr = gV('erdrNum') || "___________";
        const erdrDateVal = document.getElementById('erdrDate')?.value;
        const erdrDateObj = erdrDateVal ? new Date(erdrDateVal + 'T12:00:00') : document.getElementById('erdrDate')?.valueAsDate;
        const erdrDate = erdrDateObj ? getShortDate(erdrDateObj) : '"__" _____ 20__';
        const article = gV('criminalArticle') || "_____________";
        const courtNum = gV('courtCaseNum');
        
        if (courtNum) {
            actionDesc = `здійснення представництва інтересів потерпілого у справі № ${courtNum} за обвинувальним актом, внесеним до ЄРДР № ${erdr} від ${erdrDate} за обвинуваченням у вчиненні кримінального правопорушення, передбаченого ${article}`;
        } else {
            actionDesc = `здійснення представництва інтересів потерпілого у кримінальному провадженні № ${erdr} від ${erdrDate} за ${article}`;
        }
    } else if (caseType === 'admin') {
        const adminService = gV('adminServiceType');
        let article = gV('adminArticle');
        
        if (article) {
            if (!article.toLowerCase().includes('купап')) {
                article += ' КУпАП';
            }
        } else {
            article = "_____________";
        }
        
        if (adminService === 'representation_appeal') {
            const series = gV('adminPostanovaSeries') || "___";
            const num = gV('adminPostanovaNumber') || "___";
            actionDesc = `здійснення представництва інтересів в суді у справі про визнання протиправною та скасування постанови серії ${series} №${num} про притягнення до адміністративної відповідальності за вчинення адміністративного правопорушення, передбаченого ${article}`;
        } else if (adminService === 'representation_court') {
            const caseNum = gV('adminCourtCaseNum') || "_____________";
            actionDesc = `здійснення представництва інтересів у справі № ${caseNum} про притягнення до адміністративної відповідальності за вчинення адміністративного правопорушення, передбаченого ${article}`;
        } else if (adminService === 'defense') {
            const caseNum = gV('adminCourtCaseNum') || "_____________";
            actionDesc = `захисту у справі №${caseNum} про притягнення до адміністративної відповідальності за вчинення адміністративного правопорушення, передбаченого ${article}`;
        }
    }
    
    return {
        centerName: gV('centerSelect'), 
        applicantName: gV('applicantName'), 
        applicantNameGenitive: gV('applicantNameGenitive') || gV('applicantName'),
        applicantAddress: gV('applicantAddress'), 
        applicantPhone: gV('applicantPhone'), 
        applicantEmail: gV('applicantEmail'),
        notifyMethod: gV('notifyMethod'), 
        applicantPassport: gV('applicantPassport'), 
        helpReceiverName: gV('helpReceiverName'),
        helpReceiverNameDative: gV('helpReceiverNameDative') || gV('helpReceiverName'), 
        helpReceiverNameGenitive: gV('helpReceiverNameGenitive') || gV('helpReceiverName'),
        questionDetails: gV('questionDetails'), 
        caseDetails: gV('caseDetails'), 
        caseType: caseType, 
        actionDescription: actionDesc,
        lawPoint: rawL.split('_')[0],
        lawPointNumber: (lawConfig[rawL]?.point || "___"), 
        lawPointShortName: (lawConfig[rawL]?.name || "___"),
        docDate: document.getElementById('docDate')?.value ? new Date(document.getElementById('docDate').value + 'T12:00:00') : (document.getElementById('docDate')?.valueAsDate || null), 
        workerName: gV('workerName'), 
        workerNameGenitive: gV('workerNameGenitive') || gV('workerName'),
        rkzkNum: gV('rkzkNum'), 
        regDate: document.getElementById('regDate')?.value ? new Date(document.getElementById('regDate').value + 'T12:00:00') : (document.getElementById('regDate')?.valueAsDate || null), 
        regNum: gV('regNum'),
        orderSignerName: gV('orderSigner'), 
        letterPosition: gV('letterPosition'), 
        letterBureau: gV('letterBureau'),
        letterAdditionalInfo: gV('letterAdditionalInfo'), 
        signerName: gV('signerName') || gV('applicantName'),
        categoryPoint: rawL.split('_')[0], 
        incomePeriod: (rawL === '1_low' ? gV('incomePeriodQuarter') : gV('incomePeriodMonth')),
        incomeYear: gV('incomeYear'), 
        incomeAmount: gV('incomeTotalAmount'), 
        incomeSource: gV('incomeSource'),
        attachments: Array.from(document.querySelectorAll('.attachment-row')).map(r => ({
            name: r.querySelector('.attachment-name')?.value?.trim() || '',
            pages: r.querySelector('.attachment-pages')?.value?.trim() || ''
        }))
    };
}

/**
 * Відображення модального вікна попереднього перегляду документа
 */
function openPreview(type, isLawyer = false) {
    const d = collectData();
    let html = '';
    const fullDate = getFormattedDate(d.docDate);
    const shortDate = getShortDate(d.docDate);
    const regDateStr = getShortDate(d.regDate);
    const previewDocContent = document.getElementById('previewDocContent');
    const previewModal = document.getElementById('previewModal');

    if (type === 'zayava') {
        const normApplicant = (d.applicantName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const normReceiver = (d.helpReceiverName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const isSelf = normApplicant && normReceiver && normApplicant === normReceiver;
        const requestLead = isSelf ? `Прошу надати мені, ${d.helpReceiverNameDative}` : `Прошу надати ${d.helpReceiverNameDative}`;

        let bodyHTML = '';
        bodyHTML += `<p class="pr-p">${requestLead} безоплатну вторинну правничу допомогу з питання ${d.actionDescription}.</p>`;
        bodyHTML += `<p class="pr-p">Суб’єкт права на безоплатну вторинну правничу допомогу, визначеного пунктом ${d.lawPoint} частини першої статті 14 Закону України «Про безоплатну правничу допомогу» (далі - Закон).</p>`;
        bodyHTML += `<p class="pr-p">З правами та обов’язками суб’єктів права на безоплатну вторинну правничу допомогу, визначеними у статті 26<sup>1</sup> Закону, ознайомлений (-а), у тому числі щодо обов'язку вчасно подавати до міжрегіонального центру з надання безоплатної правничої допомоги правдиві відомості у повному обсязі, необхідні для організації надання мені безоплатної вторинної правничої допомоги.</p>`;
        bodyHTML += `<p class="pr-p">Про зобов’язання здійснити відшкодування вартості фактичних витрат, пов’язаних з наданням безоплатної вторинної правничої допомоги, у разі припинення її надання у зв’язку з встановленням факту подання неправдивих відомостей, що стали підставою для надання такої допомоги, повідомлений (-а).</p>`;
        
        if (d.lawPoint === '1') {
            const formattedIncomeAmountPreview = d.incomeAmount ? String(d.incomeAmount).replace('.', ',') : "";
            bodyHTML += `<p class="pr-p">Засвідчую, що на момент подання цієї заяви отримав (-ла) дохід за ${d.incomePeriod} ${d.incomeYear} року у розмірі ${formattedIncomeAmountPreview} грн. (${d.incomeSource}).</p>`;
            bodyHTML += `<p class="pr-p">Інших доходів, крім тих, що зазначені в цій заяві та поданих документах (довідках), не маю.</p>`;
        }
        
        bodyHTML += `<p class="pr-p">Копії документів, що ідентифікують особу та підтверджують мою належність до категорії осіб, передбаченої пунктом ${d.categoryPoint} частини першої статті 14 цього Закону, додаються до цієї заяви.</p>`;
        bodyHTML += `<p class="pr-p">Про прийняте центром рішення прошу мене повідомити ${d.notifyMethod}.</p>`;
        
        let attachmentsHTML = d.attachments.map((att, i) => {
            let textStr = att.name ? `${i + 1}. ${att.name} на ${att.pages || "__"} арк. в 1 прим.` : `${i + 1}. ______________________________________________ на __ арк. в 1 прим.`;
            return `<p class="pr-p pr-mt-0 pr-mb-0">${textStr}</p>`;
        }).join('');

        html = `
        <div class="pr-wrap">
            <div class="pr-header-right">
                <b>${d.centerName}</b><br><br>
                ${d.applicantNameGenitive}<br>
                ${d.applicantAddress}<br>
                ${d.applicantPhone}<br>
                ${d.applicantEmail ? d.applicantEmail + '<br>' : ''}
                ${d.applicantPassport}
            </div>
            <h3 class="pr-title">ЗАЯВА</h3>
            <p class="pr-subtitle">про надання безоплатної вторинної правничої допомоги</p>
            ${bodyHTML}
            <br>
            <p class="pr-text-left">Додатки:</p>
            ${attachmentsHTML}
            <br>
            <div class="pr-flex">
                <span>${fullDate} року</span>
                <span>${d.signerName}</span>
            </div>
            <table class="pr-table-noborder">
                <tr>
                    <td>Прийняв:<br>${d.workerName}<br>________________</td>
                    <td>№ ${d.regNum}<br>від ${regDateStr}</td>
                </tr>
            </table>
        </div>`;
    } else if (type === 'talon') {
        let attHtml = d.attachments.map((a, i) => {
            if (!a.name) return '';
            return `<tr><td class="pr-center">${i + 1}</td><td>${a.name}</td><td class="pr-center">${regDateStr}</td></tr>`;
        }).join('');
        
        const centerNameInstrumental = d.centerName.replace('ому міжрегіональному центру', 'им міжрегіональним центром');
        
        html = `
        <div class="pr-wrap">
            <h3 class="pr-title pr-mt-0">ТАЛОН</h3>
            <p class="pr-subtitle">про прийняття заяви про надання безоплатної вторинної правничої допомоги</p>
            <p class="pr-center pr-mt-0 pr-mb-0">до реєстраційного номеру звернення від ${regDateStr} № ${d.rkzkNum}</p>
            <p class="pr-center" style="margin-top:15px;">виданий ${centerNameInstrumental}</p>
            <p class="pr-subtitle">${d.helpReceiverName}</p>
            <p class="pr-p-bold">про те, що центром було прийнято та зареєстровано Вашу заяву, до якої додані копії таких документів:</p>
            <table class="pr-table">
                <tr><th>№ з/п</th><th>Вид документа</th><th>Дата прийняття</th></tr>
                ${attHtml}
            </table>
            <p class="pr-p">Протягом 10 робочих днів центром буде прийнято рішення про надання або відмову у наданні Вам безоплатної вторинної правничої допомоги, про що Вас буде повідомлено.</p>
            <p class="pr-p">У разі виникнення уточнювальних запитань, <b>у тому числі для отримання інформації про прийняте центром рішення про надання або відмову у наданні Вам безоплатної вторинної правничої допомоги</b>, Ви можете звернутися на Єдиний контактний номер телефону системи надання безоплатної правничої допомоги <b>0 800 213 103</b> (усі дзвінки безкоштовні). Під час розмови з працівником вкажіть, будь ласка, реєстраційний номер Вашого звернення.</p>
            <div class="pr-flex" style="margin-top:30px;">
                <span>Дата видачі: ${shortDate}</span>
                <span class="pr-sign-block">${d.workerName}<br><span class="pr-sign-hint">/власне ім’я, прізвище працівника центру/</span></span>
            </div>
        </div>`;
    } else if (type === 'order') {
        const initialsDative = formatInitialsSurnameDative(d.helpReceiverNameDative);
        const tryzubBase64 = getActiveTryzub();
        const imgTag = tryzubBase64 ? `<img src="${tryzubBase64}" style="width:45px;display:block;margin:0 auto 10px auto;" alt="Герб">` : '';
        const signerLines = d.orderSignerName === "Сергій МЕРЗЛЯКОВ" 
            ? "Начальник Південного управління<br>надання безоплатної правничої<br>допомоги" 
            : "Заступник начальника Південного управління<br>надання безоплатної правничої<br>допомоги";
        let controlNum = isLawyer ? "3" : "2";
        
        let orderActionDesc = d.actionDescription;
        if (orderActionDesc.startsWith('захисту')) {
            orderActionDesc = orderActionDesc.replace(/^захисту/, 'захист');
        }

        let p2 = isLawyer ? `<p class="pr-p">2. Направити наказ до відділу організації надання безоплатної вторинної правничої допомоги у цивільних та адміністративних справах Управління організації надання безоплатної вторинної правничої допомоги та проведення медіації Південного міжрегіонального центру з надання безоплатної правничої допомоги для призначення адвоката ${d.helpReceiverNameDative}.</p>` : '';

        html = `
        <div class="pr-wrap">
            ${imgTag}
            <p class="pr-subtitle pr-mb-0" style="font-size: 13pt;">ПІВДЕННИЙ МІЖРЕГІОНАЛЬНИЙ ЦЕНТР З НАДАННЯ</p>
            <p class="pr-subtitle" style="font-size: 13pt;">БЕЗОПЛАТНОЇ ПРАВНИЧОЇ ДОПОМОГИ</p>
            <h2 class="pr-center" style="margin:20px 0 10px 0; font-size: 13pt;">Н А К А З</h2>
            
            <table style="width:100%; border:none; margin-bottom:20px; font-size:16px;">
                <tr>
                    <td style="width:33%; text-align:left; border:none; padding:0;">від __________________</td>
                    <td style="width:34%; text-align:center; border:none; padding:0;">Одеса</td>
                    <td style="width:33%; text-align:right; border:none; padding:0;">№ _________</td>
                </tr>
            </table>

            <p style="font-weight:bold;margin:0;">Про надання безоплатної</p>
            <p style="font-weight:bold;margin:0;">вторинної правничої допомоги</p>
            <p style="font-weight:bold;margin:0;">${initialsDative}</p>
            <br>
            <p class="pr-p">Відповідно до пункту 3 частини першої статті 17, частини першої статті 19 Закону України «Про безоплатну правничу допомогу» та на підставі заяви ${d.applicantNameGenitive || d.applicantName} про надання безоплатної вторинної правничої допомоги від ${getPlainFormattedDate(d.docDate)},</p>
            <p style="font-weight:bold;">НАКАЗУЮ:</p>
            <p class="pr-p">1. Надати безоплатну вторинну правничу допомогу ${d.helpReceiverNameDative}, що передбачає ${orderActionDesc}.</p>
            ${p2}
            <p class="pr-p">${controlNum}. Контроль за виконанням цього наказу покласти на начальника Одеського відділу надання безоплатної правничої допомоги Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги Туровського Ігоря Сергійовича.</p>
            <br>
            <div class="pr-flex-end">
                <div>${signerLines}</div>
                <div>${d.orderSignerName}</div>
            </div>
        </div>`;
    } else if (type === 'letter') {
        const recipientNameText = d.orderSignerName === "Сергій КУДРЯВЦЕВ" 
            ? "Заступнику начальника Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги<br>Сергію КУДРЯВЦЕВУ" 
            : "Начальнику Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги<br>Сергію МЕРЗЛЯКОВУ";
        const positionGenitiveMap = { "помічник юриста": "помічника юриста", "юрист": "юриста", "начальник": "начальника" };
        const senderText = `${positionGenitiveMap[d.letterPosition] || d.letterPosition} ${d.letterBureau} Одеського відділу надання безоплатної правничої допомоги Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги<br>${formatWorkerNameUpper(d.workerNameGenitive)}`;
        const signaturePos = d.letterPosition === 'начальник' ? 'Начальник бюро' : d.letterPosition.charAt(0).toUpperCase() + d.letterPosition.slice(1);
        
        const subjectStr = isLawyer 
            ? `Стосовно: призначення адвоката для надання безоплатної вторинної правничої допомоги (далі – БВПД) ${d.helpReceiverNameDative} з питання ${d.actionDescription}.` 
            : `Стосовно: уповноваження працівника для надання безоплатної вторинної правничої допомоги (далі – БВПД) ${d.helpReceiverNameDative} щодо ${d.actionDescription}.`;
        
        const prop1 = isLawyer ? `призначити адвоката для надання особі БВПД, у зв’язку з тим, що:` : `уповноважити працівника сектору для надання особі БВПД, у зв'язку з тим, що:`;
        const prop2 = isLawyer ? d.letterAdditionalInfo : `справа є малозначною в силу вимог процесуального законодавства.`;

        const normApplicant = (d.applicantName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const normReceiver = (d.helpReceiverName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const isSelf = !normApplicant || !normReceiver || normApplicant === normReceiver;
        const appealPersonGenitive = isSelf
            ? d.applicantNameGenitive
            : `${d.applicantNameGenitive} в інтересах ${d.helpReceiverNameGenitive}`;

        html = `
        <div class="pr-wrap">
            <div style="margin-left:50%;margin-bottom:20px;">${recipientNameText}</div>
            <div style="margin-left:50%;margin-bottom:40px;">${senderText}</div>
            <h4 class="pr-center pr-mt-0 pr-mb-0">СЛУЖБОВИЙ ЛИСТ</h4>
            <p class="pr-p">${subjectStr}</p>
            <p class="pr-p">Реєстраційний номер справи у СПЗ КІАС: ${d.rkzkNum}.</p>
            <p class="pr-p">За результатами розгляду звернення ${appealPersonGenitive} від ${shortDate} про надання БВПД, повідомляю, що особа належить до категорії осіб, визначених п. ${d.lawPointNumber} частини 1 статті 14 Закону України «Про безоплатну правничу допомогу» (${d.lawPointShortName}). Відтак, надсилаю проект рішення про надання БВПД та</p>
            <p class="pr-text-left">П Р О П О Н У Ю:</p>
            <p class="pr-p-bold">${prop1}</p>
            <p class="pr-p">${prop2}</p>
            <br><br>
            <div class="pr-flex" style="font-weight:bold;">
                <span>${signaturePos}</span>
                <span>${formatWorkerNameUpper(d.workerName)}</span>
            </div>
            <br>
            <p style="margin-top:10px;">${getPlainFormattedDate(d.docDate)}</p>
        </div>`;
    }

    if (previewDocContent) previewDocContent.innerHTML = html;
    if (previewModal) previewModal.style.display = 'flex';
}

/**
 * Константи стилів docx
 */
const SPACING = { line: 276, after: 120 }; 
const NO_SPACE = { line: 276, after: 0 };
const INDENT = 709; 
const MARGINS = { top: 850, bottom: 850, left: 1418, right: 850 };

function TR(text, opt = {}) {
    const { TextRun } = docx;
    return new TextRun({ text: text, font: "Times New Roman", size: 24, language: "uk-UA", ...opt });
}

function TR_B(text, opt = {}) {
    return TR(text, { bold: true, ...opt });
}

/**
 * 1. Генерація заяви (DOCX)
 */
async function generateDoc() {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } = docx;
    const d = collectData();
    const dateStr = getFormattedDate(d.docDate) + " року";
    const regDateStr = getShortDate(d.regDate);
    
    const ZAYAVA_SPACING = { line: 240, after: 120 };
    const ZAYAVA_NO_SPACE = { line: 240, after: 0 };
    
    const bodyParagraphs = [];
    const pushP = (textArr) => bodyParagraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: INDENT },
        spacing: ZAYAVA_SPACING,
        children: textArr.map(t => typeof t === 'string' ? TR(t) : t)
    }));

    const normApplicant = (d.applicantName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normReceiver = (d.helpReceiverName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const isSelf = normApplicant && normReceiver && normApplicant === normReceiver;
    const requestLead = isSelf ? "Прошу надати мені, " : "Прошу надати ";

    pushP([requestLead, d.helpReceiverNameDative + " ", "безоплатну вторинну правничу допомогу з питання ", d.actionDescription + "."]);
    pushP(["Суб’єкт права на безоплатну вторинну правничу допомогу, визначеного пунктом ", d.lawPoint, " частини першої статті 14 Закону України «Про безоплатну правничу допомогу» (далі - Закон)."]);
    pushP(["З правами та обов’язками суб’єктів права на безоплатну вторинну правничу допомогу, визначеними у статті 26", new TextRun({ text: "1", superScript: true, font: "Times New Roman", size: 24 }), " Закону, ознайомлений (-а), у тому числі щодо обов'язку вчасно подавати до міжрегіонального центру з надання безоплатної правничої допомоги правдиві відомості у повному обсязі, необхідні для організації надання мені безоплатної вторинної правничої допомоги."]);
    pushP(["Про зобов’язання здійснити відшкодування вартості фактичних витрат, пов’язаних з наданням безоплатної вторинної правничої допомоги, у разі припинення її надання у зв’язку з встановленням факту подання неправдивих відомостей, що стали підставою для надання такої допомоги, повідомлений (-а)."]);
    
    if (d.lawPoint === '1') {
        const formattedIncomeAmount = d.incomeAmount ? String(d.incomeAmount).replace('.', ',') : "";
        pushP(["Засвідчую, що на момент подання цієї заяви отримав (-ла) дохід за ", d.incomePeriod, " " + d.incomeYear, " року у розмірі ", formattedIncomeAmount, " грн. (", d.incomeSource, ")."]);
        pushP(["Інших доходів, крім тих, що зазначені в цій заяві та поданих документах (довідках), не маю."]);
    }
    
    pushP(["Копії документів, що ідентифікують особу та підтверджують мою належність до категорії осіб, передбаченої пунктом ", d.categoryPoint, " частини першої статті 14 цього Закону, додаються до цієї заяви."]);
    pushP(["Про прийняте центром рішення прошу мене повідомити ", d.notifyMethod, "."]);

    const attachmentParagraphs = d.attachments.map((att, index) => {
        const textStr = att.name ? `${index + 1}. ${att.name} на ${att.pages || "__"} арк. в 1 прим.` : `${index + 1}. ______________________________________________ на __ арк. в 1 прим.`;
        return new Paragraph({ children: [TR(textStr)], indent: { firstLine: INDENT }, spacing: ZAYAVA_NO_SPACE });
    });

    const noBorders = {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
    };

    const doc = new Document({
        creator: "Система БВПД",
        title: "Заява",
        sections: [{
            properties: { page: { margin: MARGINS } },
            children: [
                new Paragraph({ children: [TR_B(d.centerName)], indent: { left: 4252 }, spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ text: "", spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ children: [TR(d.applicantNameGenitive)], indent: { left: 4252 }, spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ children: [TR(d.applicantAddress)], indent: { left: 4252 }, spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ children: [TR(d.applicantPhone)], indent: { left: 4252 }, spacing: ZAYAVA_NO_SPACE }),
                ...(d.applicantEmail ? [new Paragraph({ children: [TR(d.applicantEmail)], indent: { left: 4252 }, spacing: ZAYAVA_NO_SPACE })] : []),
                new Paragraph({ children: [TR(d.applicantPassport)], indent: { left: 4252 }, spacing: { line: 240, after: 300 } }),
                
                new Paragraph({ children: [TR_B("ЗАЯВА", { size: 28 })], alignment: AlignmentType.CENTER, spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ children: [TR_B("про надання безоплатної вторинної правничої допомоги")], alignment: AlignmentType.CENTER, spacing: { line: 240, after: 200 } }),
                
                ...bodyParagraphs,
                
                new Paragraph({ text: "", spacing: ZAYAVA_NO_SPACE }),
                new Paragraph({ children: [TR_B("Додатки:")], indent: { firstLine: INDENT }, spacing: ZAYAVA_NO_SPACE }),
                ...attachmentParagraphs,
                new Paragraph({ text: "", spacing: { after: 300 } }),
                
                new Paragraph({ children: [TR(dateStr), TR("\t" + d.signerName)], tabStops: [{ type: "right", position: 9300 }], spacing: ZAYAVA_SPACING }),
                new Paragraph({ text: "", spacing: { after: 200 } }),
                
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: noBorders,
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [TR("Прийняв:")], spacing: ZAYAVA_NO_SPACE }),
                                        new Paragraph({ children: [TR(d.workerName)], spacing: ZAYAVA_NO_SPACE }),
                                        new Paragraph({ children: [TR("________________")], spacing: ZAYAVA_NO_SPACE })
                                    ]
                                }),
                                new TableCell({
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({ children: [TR("№ " + d.regNum)], alignment: AlignmentType.LEFT, spacing: ZAYAVA_NO_SPACE }),
                                        new Paragraph({ children: [TR("від " + regDateStr)], alignment: AlignmentType.LEFT, spacing: ZAYAVA_NO_SPACE })
                                    ],
                                    verticalAlign: VerticalAlign.TOP
                                })
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, buildFileName('Заява'));
    return blob;
}

/**
 * 2. Генерація талону (DOCX)
 */
async function generateTalon() {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, UnderlineType } = docx;
    const d = collectData(); 
    const regDateStr = getShortDate(d.regDate); 
    const issueDateStr = getShortDate(d.docDate || new Date()); 
    const TR_11 = (text, opt = {}) => new TextRun({ text: text, font: "Times New Roman", size: 22, language: "uk-UA", ...opt });
    
    const centerNameInstrumental = d.centerName.replace('ому міжрегіональному центру', 'им міжрегіональним центром');
    const talonMargins = { top: 567, bottom: 284, left: 1134, right: 567 };
    
    const tableRows = [
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [TR_B("№ з/п")], alignment: AlignmentType.CENTER, spacing: NO_SPACE })], width: { size: 10, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [TR_B("Вид документа")], alignment: AlignmentType.CENTER, spacing: NO_SPACE })], width: { size: 60, type: WidthType.PERCENTAGE } }),
                new TableCell({ children: [new Paragraph({ children: [TR_B("Дата прийняття")], alignment: AlignmentType.CENTER, spacing: NO_SPACE })], width: { size: 30, type: WidthType.PERCENTAGE } }),
            ]
        })
    ];
    
    d.attachments.forEach((att, index) => { 
        if (att.name) { 
            tableRows.push(new TableRow({
                children: [ 
                    new TableCell({ children: [new Paragraph({ children: [TR((index + 1).toString())], alignment: AlignmentType.CENTER, spacing: NO_SPACE })] }), 
                    new TableCell({ children: [new Paragraph({ children: [TR(att.name)], alignment: AlignmentType.LEFT, spacing: NO_SPACE })] }), 
                    new TableCell({ children: [new Paragraph({ children: [TR(regDateStr)], alignment: AlignmentType.CENTER, spacing: NO_SPACE })] }) 
                ],
                height: { value: 300 }
            })); 
        } 
    });

    const noBorders = {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
    };
    
    const doc = new Document({
        creator: "Система БВПД",
        title: "Талон",
        sections: [
            {
                properties: { page: { margin: talonMargins } },
                children: [
                    new Paragraph({ children: [TR_B("ТАЛОН", { size: 28 })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_B("про прийняття заяви про надання безоплатної вторинної правничої допомоги")], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR(`до реєстраційного номеру звернення від ${regDateStr} № ${d.rkzkNum}`, { size: 20 })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }), 
                    new Paragraph({ children: [TR(`виданий ${centerNameInstrumental}`)], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                    new Paragraph({ children: [TR_B(d.helpReceiverName)], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                    new Paragraph({ children: [TR_B("про те, що центром було прийнято та зареєстровано Вашу заяву, до якої додані копії таких документів:")], alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 } }),
                    new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                    new Paragraph({ children: [TR("Протягом 10 робочих днів центром буде прийнято рішення про надання або відмову у наданні Вам безоплатної вторинної правничої допомоги, про що Вас буде повідомлено.")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                    new Paragraph({ children: [ TR("У разі виникнення уточнювальних запитань, "), TR_B("у тому числі для отримання інформації про прийняте центром рішення про надання або відмову у наданні Вам безоплатної вторинної правничої допомоги"), TR(", Ви можете звернутися на Єдиний контактний номер телефону системи надання безоплатної правничої допомоги "), TR_B("0 800 213 103"), TR(" (усі дзвінки безкоштовні). Під час розмови з працівником вкажіть, будь ласка, реєстраційний номер Вашого звернення.") ], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        rows: [
                            new TableRow({
                                children: [ 
                                    new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [TR(`Дата видачі: ${issueDateStr}`)], spacing: NO_SPACE })] }), 
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        children: [ 
                                            new Paragraph({ children: [ new TextRun({ text: d.workerName, font: "Times New Roman", size: 24, underline: { type: UnderlineType.SINGLE }, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }), 
                                            new Paragraph({ children: [ new TextRun({ text: "/власне ім’я, прізвище працівника центру/", font: "Times New Roman", size: 16, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }) 
                                        ]
                                    }) 
                                ]
                            })
                        ]
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        rows: [
                            new TableRow({
                                children: [ 
                                    new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [TR("Отримав:")], spacing: NO_SPACE })] }), 
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        children: [ 
                                            new Paragraph({ children: [ new TextRun({ text: d.signerName, font: "Times New Roman", size: 24, underline: { type: UnderlineType.SINGLE }, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }), 
                                            new Paragraph({ children: [ new TextRun({ text: "( власне ім’я, прізвище особи, яка звернулася за безоплатною вторинною правничою допомогою )", font: "Times New Roman", size: 16, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }) 
                                        ]
                                    }) 
                                ]
                            })
                        ]
                    })
                ]
            },
            {
                properties: { page: { margin: talonMargins } },
                children: [
                    new Paragraph({ children: [TR_11("Права та обов’язки особи – суб’єкта права", { bold: true })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("на безоплатну вторинну правничу допомогу", { bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                    new Paragraph({ children: [TR_11("Права та обов’язки суб’єктів права на безоплатну вторинну правничу допомогу передбачені Законом України «Про безоплатну правничу допомогу» (далі – Закон), іншими актами законодавства.")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("Безоплатна вторинна правнича допомога – вид державної гарантії, що полягає у створенні рівних можливостей для доступу осіб до правосуддя.")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("Суб’єкт права на безоплатну вторинну правничу допомогу має право:", { bold: true })], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("1) особисто або через представника звертатися із зверненням про надання безоплатної вторинної правничої допомоги до центру з надання безоплатної правничої допомоги (далі – центр), найближчого до місця фактичного проживання, за отриманням одного з таких видів правничих послуг: захист, здійснення представництва інтересів в суді інших державних органах, органах місцевого самоврядування, перед іншими особами, складення документів процесуального характеру;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("2) отримувати від центру інформацію про документи, які необхідно подати для прийняття рішення про надання безоплатної вторинної правничої допомоги;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("3) отримати копію рішення про надання (відмову в наданні) безоплатної вторинної правничої допомоги;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("4) отримати роз’яснення щодо порядку оскарження рішення про відмову в наданні безоплатної вторинної правничої допомоги;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("5) своєчасно отримувати якісну, у повному обсязі безоплатну вторинну правничу допомогу;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("6) безперервно отримувати безоплатну вторинну правничу допомогу в разі заміни адвоката або працівника, уповноваженого центром;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("7) отримувати безоплатну вторинну правничу допомогу в межах національних засобів правового захисту (правнича допомога щодо звернень до Європейського суду з прав людини не надається).")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("Суб’єкт права на безоплатну вторинну правничу допомогу зобов’язаний:", { bold: true })], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("1) вчасно подавати до центру правдиві відомості у повному обсязі, необхідні для організації надання йому такої допомоги;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("2) невідкладно повідомляти центр про припинення існування обставин чи підстав, за наявності яких особа була віднесена до категорій осіб, передбачених статтею 14 Закону, а також про залучення ним іншого захисника (представника);")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("3) відшкодовувати вартість фактичних витрат, пов’язаних з наданням безоплатної вторинної правничої допомоги, у разі припинення її надання у зв’язку з встановленням факту подання неправдивих відомостей, що стали підставою для надання такої допомоги;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("4) нести всі необхідні судові/процесуальні, інші витрати у справі, крім витрат на оплату послуг адвокатів, які надають безоплатну вторинну правничу допомогу, та відшкодовувати витрати, що пов’язані з її наданням, і послуги перекладу;")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("5) з’являтися у визначені центром час та місце для організації надання безоплатної вторинної правничої допомоги.")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("Пам’ятати, що:", { bold: true })], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("1) правничу допомогу у вигляді захисту, складання документів правового характеру та представництва інтересів в судах надає адвокат/працівник центру (за дорученням/наказом центру);")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ children: [TR_11("2) центр має право замінити адвоката/працівника центру у випадку його хвороби, повної або часткової втрати працездатності, смерті адвоката/працівника; неналежного виконання адвокатом своїх зобов’язань за умовами договору; відмови адвоката/працівника центру від виконання доручення/наказу центру з підстав, передбачених законом; зміни підсудності провадження або справи чи підслідності кримінального правопорушення; припинення дії договору про надання безоплатної вторинної правничої допомоги; неналежне надання безоплатної вторинної правничої допомоги працівником центру, припинення трудового договору з працівником; зупинення або припинення права на зайняття адвокатською діяльністю; виключення адвоката з Реєстру адвокатів, які надають безоплатну вторинну правничу допомогу; наявності інших підстав, передбачених законом.")], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: NO_SPACE }),
                    new Paragraph({ text: "", spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorders,
                        rows: [
                            new TableRow({
                                children: [ 
                                    new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [] }), 
                                    new TableCell({
                                        width: { size: 60, type: WidthType.PERCENTAGE },
                                        children: [ 
                                            new Paragraph({ children: [ new TextRun({ text: d.signerName, font: "Times New Roman", size: 24, underline: { type: UnderlineType.SINGLE }, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }), 
                                            new Paragraph({ children: [ new TextRun({ text: "( власне ім’я, прізвище особи )", font: "Times New Roman", size: 16, language: "uk-UA" }) ], alignment: AlignmentType.CENTER, spacing: NO_SPACE }) 
                                        ]
                                    }) 
                                ]
                            })
                        ]
                    })
                ]
            }
        ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, buildFileName('Талон'));
    return blob;
}

/**
 * 3. Генерація наказу (на адвоката або працівника) (DOCX)
 */
async function generateOrder(isLawyer) {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle } = docx;
    const d = collectData(); 
    const initialsDative = formatInitialsSurnameDative(d.helpReceiverNameDative); 
    const dateStr = getPlainFormattedDate(d.docDate);
    
    const signerLines = d.orderSignerName === "Сергій МЕРЗЛЯКОВ" 
        ? ["Начальник Південного управління", "надання безоплатної правничої", "допомоги"] 
        : ["Заступник начальника Південного управління", "надання безоплатної правничої", "допомоги"];
    
    const tryzubBase64 = getActiveTryzub();
    const tryzubBuffer = base64ToArrayBuffer(tryzubBase64);
    
    const headerChildren = [];
    if (tryzubBuffer) {
        headerChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: NO_SPACE,
                children: [ new ImageRun({ data: tryzubBuffer, transformation: { width: 45, height: 64 } }) ]
            }),
            new Paragraph({ text: "", spacing: NO_SPACE }) 
        );
    }
    
    headerChildren.push(
        new Paragraph({ children: [TR_B("ПІВДЕННИЙ МІЖРЕГІОНАЛЬНИЙ ЦЕНТР З НАДАННЯ", { size: 26 })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
        new Paragraph({ children: [TR_B("БЕЗОПЛАТНОЇ ПРАВНИЧОЇ ДОПОМОГИ", { size: 26 })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
        new Paragraph({ text: "", spacing: NO_SPACE }),
        new Paragraph({ children: [TR_B("Н А К А З", { size: 26 })], alignment: AlignmentType.CENTER, spacing: NO_SPACE }),
        new Paragraph({ text: "", spacing: NO_SPACE }),
        
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE }
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [TR("від __________________")], alignment: AlignmentType.LEFT, spacing: NO_SPACE })], width: { size: 33, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [TR("Одеса")], alignment: AlignmentType.CENTER, spacing: NO_SPACE })], width: { size: 34, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [new Paragraph({ children: [TR("№ _________")], alignment: AlignmentType.RIGHT, spacing: NO_SPACE })], width: { size: 33, type: WidthType.PERCENTAGE } })
                    ]
                })
            ]
        }),
        new Paragraph({ text: "", spacing: NO_SPACE }),
        
        new Paragraph({ children: [TR_B("Про надання безоплатної", { size: 26 })], alignment: AlignmentType.LEFT, spacing: NO_SPACE }),
        new Paragraph({ children: [TR_B("вторинної правничої допомоги", { size: 26 })], alignment: AlignmentType.LEFT, spacing: NO_SPACE }),
        new Paragraph({ children: [TR_B(initialsDative, { size: 26 })], alignment: AlignmentType.LEFT, spacing: { after: 200 } }),
        
        new Paragraph({ children: [TR(`Відповідно до пункту 3 частини першої статті 17, частини першої статті 19 Закону України «Про безоплатну правничу допомогу» та на підставі заяви ${d.applicantNameGenitive || d.applicantName} про надання безоплатної вторинної правничої допомоги від ${dateStr},`, { size: 26 })], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
        
        new Paragraph({ children: [TR_B("НАКАЗУЮ:")], alignment: AlignmentType.LEFT, spacing: SPACING })
    );
    
    let orderActionDesc = d.actionDescription;
    if (orderActionDesc.startsWith('захисту')) {
        orderActionDesc = orderActionDesc.replace(/^захисту/, 'захист');
    }

    headerChildren.push(new Paragraph({
        children: [TR(`1. Надати безоплатну вторинну правничу допомогу ${d.helpReceiverNameDative}, що передбачає ${orderActionDesc}.`, { size: 26 })],
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: INDENT },
        spacing: SPACING
    }));
    
    let controlNum = "2";
    if (isLawyer) { 
        headerChildren.push(new Paragraph({
            children: [TR(`2. Направити наказ до відділу організації надання безоплатної вторинної правничої допомоги у цивільних та адміністративних справах Управління організації надання безоплатної вторинної правничої допомоги та проведення медіації Південного міжрегіонального центру з надання безоплатної правничої допомоги для призначення адвоката ${d.helpReceiverNameDative}.`, { size: 26 })],
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: INDENT },
            spacing: SPACING
        })); 
        controlNum = "3"; 
    }
    
    headerChildren.push(
        new Paragraph({
            children: [TR(`${controlNum}. Контроль за виконанням цього наказу покласти на начальника Одеського відділу надання безоплатної правничої допомоги Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги Туровського Ігоря Сергійовича.`, { size: 26 })],
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: INDENT },
            spacing: SPACING
        }),
        new Paragraph({ text: "", spacing: NO_SPACE }),
        new Paragraph({
            children: [
                TR_B(signerLines[0], { size: 26 }),
                TR_B(signerLines[1], { break: 1, size: 26 }),
                TR_B(signerLines[2], { break: 1, size: 26 }),
                TR_B("\t" + d.orderSignerName, { size: 26 })
            ],
            tabStops: [{ type: "right", position: 9300 }],
            spacing: NO_SPACE
        })
    );

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
            children: headerChildren
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, buildFileName(isLawyer ? 'Наказ_на_адвоката' : 'Наказ_на_працівника', true));
    return blob;
}

/**
 * 4. Генерація службового листа (на адвоката або працівника) (DOCX)
 */
async function generateServiceLetter(isLawyer) {
    const { Document, Packer, Paragraph, AlignmentType } = docx;
    const d = collectData(); 
    const recipientNameText = d.orderSignerName === "Сергій КУДРЯВЦЕВ" 
        ? "Заступнику начальника Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги\nСергію КУДРЯВЦЕВУ" 
        : "Начальнику Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги\nСергію МЕРЗЛЯКОВУ";
    
    const positionGenitiveMap = { "помічник юриста": "помічника юриста", "юрист": "юриста", "начальник": "начальника" };
    const senderText = `${positionGenitiveMap[d.letterPosition] || d.letterPosition} ${d.letterBureau} Одеського відділу надання безоплатної правничої допомоги Південного управління надання безоплатної правничої допомоги Південного міжрегіонального центру з надання безоплатної правничої допомоги\n${formatWorkerNameUpper(d.workerNameGenitive)}`;
    
    const signaturePos = d.letterPosition === 'начальник' ? 'Начальник бюро' : d.letterPosition.charAt(0).toUpperCase() + d.letterPosition.slice(1);
    const subjectStr = isLawyer 
        ? `Стосовно: призначення адвоката для надання безоплатної вторинної правничої допомоги (далі – БВПД) ${d.helpReceiverNameDative} з питання ${d.actionDescription}.` 
        : `Стосовно: уповноваження працівника для надання безоплатної вторинної правничої допомоги (далі – БВПД) ${d.helpReceiverNameDative} щодо ${d.actionDescription}.`;
    
    const proposalLines = isLawyer 
        ? [`призначити адвоката для надання особі БВПД, у зв’язку з тим, що:`, d.letterAdditionalInfo] 
        : [`уповноважити працівника сектору для надання особі БВПД, у зв'язку з тим, що:`, `справа є малозначною в силу вимог процесуального законодавства.`];

    const normApplicant = (d.applicantName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normReceiver = (d.helpReceiverName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const isSelf = !normApplicant || !normReceiver || normApplicant === normReceiver;
    const appealPersonGenitive = isSelf
        ? d.applicantNameGenitive
        : `${d.applicantNameGenitive} в інтересах ${d.helpReceiverNameGenitive}`;

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } },
            children: [
                new Paragraph({
                    children: recipientNameText.split('\n').map((line, i) => TR(line, i > 0 ? { break: 1 } : {})),
                    alignment: AlignmentType.LEFT,
                    indent: { left: 4252 },
                    spacing: { line: 276, after: 200 }
                }),
                new Paragraph({
                    children: senderText.split('\n').map((line, i) => TR(line, i > 0 ? { break: 1 } : {})),
                    alignment: AlignmentType.LEFT,
                    indent: { left: 4252 },
                    spacing: { line: 276, after: 400 }
                }),
                
                new Paragraph({ children: [TR_B("СЛУЖБОВИЙ ЛИСТ")], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                
                new Paragraph({ children: [TR(subjectStr)], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                new Paragraph({ children: [TR(`Реєстраційний номер справи у СПЗ КІАС: ${d.rkzkNum}.`)], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                new Paragraph({ children: [TR(`За результатами розгляду звернення ${appealPersonGenitive} від ${getShortDate(d.docDate)} про надання БВПД, повідомляю, що особа належить до категорії осіб, визначених п. ${d.lawPointNumber} частини 1 статті 14 Закону України «Про безоплатну правничу допомогу» (${d.lawPointShortName}). Відтак, надсилаю проект рішення про надання БВПД та`)], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                
                new Paragraph({ children: [TR_B("П Р О П О Н У Ю:")], alignment: AlignmentType.LEFT, indent: { firstLine: INDENT }, spacing: SPACING }),
                
                new Paragraph({ children: [TR_B(proposalLines[0])], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: SPACING }),
                new Paragraph({ children: [TR(proposalLines[1])], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: INDENT }, spacing: { line: 276, after: 400 } }),
                
                new Paragraph({ children: [TR_B(signaturePos), TR_B("\t" + formatWorkerNameUpper(d.workerName))], tabStops: [{ type: "right", position: 9300 }], spacing: NO_SPACE }),
                new Paragraph({ text: "", spacing: NO_SPACE }),
                new Paragraph({ children: [TR(getPlainFormattedDate(d.docDate))], alignment: AlignmentType.LEFT, spacing: NO_SPACE })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, buildFileName(isLawyer ? 'Службова_на_адвоката' : 'Службова_на_працівника'));
    return blob;
}

// Експорт у глобальну область видимості
window.DocxGenerator = {
    getFormattedDate,
    getPlainFormattedDate,
    getShortDate,
    formatInitialsSurnameDative,
    formatWorkerNameUpper,
    getActiveTryzub,
    base64ToArrayBuffer,
    buildFileName,
    collectData,
    openPreview,
    generateDoc,
    generateTalon,
    generateOrder,
    generateServiceLetter
};

window.collectData = collectData;
window.openPreview = openPreview;
window.generateDoc = generateDoc;
window.generateTalon = generateTalon;
window.generateOrder = generateOrder;
window.generateServiceLetter = generateServiceLetter;
window.getActiveTryzub = getActiveTryzub;
window.buildFileName = buildFileName;
window.getPlainFormattedDate = getPlainFormattedDate;
