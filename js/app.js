/**
 * Головний модуль додатку 'Генератор документів на БВПД' (версія 2.10)
 * Відповідає за ініціалізацію форми, валідацію, обробку подій, відмінювання ПІБ, розрахунки та взаємодію з користувачем.
 */

document.addEventListener('DOMContentLoaded', function () {

    // 1. Блокування випадкового відправлення форми при натисканні Enter у текстових полях
    const legalForm = document.getElementById('legalForm');
    legalForm?.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // Отримання посилань на ключові DOM-елементи
    const lawPointSearch = document.getElementById('lawPointSearch');
    const lawPointHidden = document.getElementById('lawPointSelect');
    const clearLawSearchBtn = document.getElementById('clearLawSearchBtn');
    const helpIconBtn = document.getElementById('helpIconBtn');
    const previewModal = document.getElementById('previewModal');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const dropZone = document.getElementById('dropZone');
    const logoUpload = document.getElementById('logoUpload');
    const logoPreview = document.getElementById('logoPreview');
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const themeToggle = document.getElementById('themeToggle');

    // 2. Сповіщення (Toast)
    let toastTimeout;
    function showToast(message, isInfo = false) {
        const toast = document.getElementById('toastMessage');
        if (!toast) return;
        toast.textContent = message;
        if (isInfo) toast.classList.add('info'); else toast.classList.remove('info');
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    window.showToast = showToast;

    // 3. Перемикач теми (Світла / Темна)
    if (themeToggle) {
        const currentTheme = localStorage.getItem('theme') || 'light';
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
        }
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeToggle.textContent = '🌙';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeToggle.textContent = '☀️';
            }
        });
    }

    // 4. Попередження при закритті вкладки з незбереженими даними
    let isFormDirty = false;
    legalForm?.addEventListener('input', () => { isFormDirty = true; });
    window.addEventListener('beforeunload', (e) => {
        if (isFormDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // 5. Відновлення та автоматичне збереження службових даних працівника
    const workerFields = window.WORKER_FIELDS || ['workerName', 'workerNameGenitive', 'orderSigner', 'letterPosition', 'letterBureau'];
    workerFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const savedVal = localStorage.getItem(id);
            if (savedVal) { el.value = savedVal; }
            el.addEventListener('input', () => localStorage.setItem(id, el.value));
        }
    });

    // 6. Встановлення поточної дати за замовчуванням
    const today = new Date().toISOString().split('T')[0];
    const docDateInput = document.getElementById('docDate');
    const regDateInput = document.getElementById('regDate');
    if (docDateInput && !docDateInput.value) docDateInput.value = today;
    if (regDateInput && !regDateInput.value) regDateInput.value = today;

    // 7. Маска введення номера телефону
    const phoneInput = document.getElementById('applicantPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            let val = e.target.value;
            if (val === '+' || val === '') return;
            let digits = val.replace(/\D/g, '');
            if (digits.startsWith('38')) digits = digits.slice(2);
            if (digits.length === 0) { e.target.value = ''; return; }
            
            let res = '+38 (';
            if (digits.length > 0) res += digits.substring(0, 3);
            if (digits.length >= 4) res += ') ' + digits.substring(3, 6);
            if (digits.length >= 7) res += '-' + digits.substring(6, 8);
            if (digits.length >= 9) res += '-' + digits.substring(8, 10);
            e.target.value = res;
        });
    }

    // 8. Керування відображенням секцій за типом справи
    document.querySelectorAll('input[name="caseType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            const civilBlock = document.getElementById('civilFieldsBlock');
            const criminalBlock = document.getElementById('criminalFieldsBlock');
            const adminBlock = document.getElementById('adminFieldsBlock');
            
            if (civilBlock) civilBlock.style.display = (val === 'civil') ? 'block' : 'none';
            if (criminalBlock) criminalBlock.style.display = (val === 'criminal') ? 'block' : 'none';
            if (adminBlock) adminBlock.style.display = (val === 'admin') ? 'block' : 'none';
        });
    });

    // 9. Перемикання полів у вкладці КУпАП (оскарження постанови vs судова справа)
    document.getElementById('adminServiceType')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const courtBlock = document.getElementById('adminCourtBlock');
        const appealBlock = document.getElementById('adminAppealBlock');
        
        if (val === 'representation_appeal') {
            if (courtBlock) courtBlock.style.display = 'none';
            if (appealBlock) appealBlock.style.display = 'grid'; 
        } else {
            if (courtBlock) courtBlock.style.display = 'block';
            if (appealBlock) appealBlock.style.display = 'none';
        }
    });

    // 10. Керування гербом: використання вшитого за замовчуванням та завантаження нового
    function initLogo() {
        const activeLogo = localStorage.getItem('savedTryzub') || window.DEFAULT_TRYZUB_BASE64 || '';
        if (activeLogo && logoPreviewImg && logoPreview) {
            logoPreviewImg.src = activeLogo;
            logoPreview.style.display = 'flex';
        }
    }

    function handleLogoFile(file) {
        if (!file || !file.type.match('image.*')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const ratio = 200 / img.height;
                canvas.width = img.width * ratio;
                canvas.height = 200;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                localStorage.setItem('savedTryzub', dataUrl);
                if (logoPreviewImg) logoPreviewImg.src = dataUrl;
                if (logoPreview) logoPreview.style.display = 'flex';
                showToast("Герб збережено!", true);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    dropZone?.addEventListener('click', () => logoUpload?.click());
    logoUpload?.addEventListener('change', (e) => handleLogoFile(e.target.files[0]));
    dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files?.[0]) handleLogoFile(e.dataTransfer.files[0]);
    });

    // Скидання герба до стандартного вшитого
    document.getElementById('btnClearLogo')?.addEventListener('click', () => {
        localStorage.removeItem('savedTryzub');
        if (window.DEFAULT_TRYZUB_BASE64 && logoPreviewImg && logoPreview) {
            logoPreviewImg.src = window.DEFAULT_TRYZUB_BASE64;
            logoPreview.style.display = 'flex';
            showToast("Герб скинуто до типового!", true);
        } else if (logoPreview) {
            logoPreview.style.display = 'none';
        }
    });

    initLogo();

    // 11. Інтеграція бібліотеки shevchenko з кешуванням для відмінювання ПІБ
    const namesCache = {};

    async function declineFullName(fullName, caseName) {
        if (!window.shevchenko || !fullName) return fullName;
        
        const cacheKey = `${fullName.trim()}_${caseName}`;
        if (namesCache[cacheKey]) return namesCache[cacheKey]; 

        const parts = fullName.trim().split(/\s+/);
        let person = parts.length >= 3 
            ? { familyName: parts[0], givenName: parts[1], patronymicName: parts.slice(2).join(' ') } 
            : { givenName: parts[0] };
        person.gender = (person.patronymicName?.toLowerCase().endsWith('на') ? 'feminine' : 'masculine');
        
        try {
            const declined = (caseName === 'genitive' ? await window.shevchenko.inGenitive(person) : await window.shevchenko.inDative(person));
            const result = [declined.familyName, declined.givenName, declined.patronymicName].filter(Boolean).join(' ');
            namesCache[cacheKey] = result; 
            return result;
        } catch (e) {
            return fullName;
        }
    }

    async function setupAutoDecline(inputId, spinnerId, genId, datId, helperId) {
        const input = document.getElementById(inputId);
        input?.addEventListener('blur', async () => {
            if (!input.value.trim()) return;
            const spinner = document.getElementById(spinnerId);
            if (spinner) spinner.style.display = 'block';
            
            if (genId) {
                const genEl = document.getElementById(genId);
                if (genEl && (!genEl.value.trim() || genEl.dataset.sourceNom !== input.value)) {
                    genEl.value = await declineFullName(input.value, 'genitive');
                    genEl.dataset.sourceNom = input.value;
                }
            }
            if (datId) {
                const datEl = document.getElementById(datId);
                if (datEl && (!datEl.value.trim() || datEl.dataset.sourceNom !== input.value)) {
                    datEl.value = await declineFullName(input.value, 'dative');
                    datEl.dataset.sourceNom = input.value;
                }
            }
            const helper = document.getElementById(helperId);
            if (helper) helper.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
        });
    }

    setupAutoDecline('applicantName', 'spinnerApplicant', 'applicantNameGenitive', null, 'applicantGenitiveHelper');
    setupAutoDecline('helpReceiverName', 'spinnerReceiver', 'helpReceiverNameGenitive', 'helpReceiverNameDative', 'receiverGenitiveHelper');
    setupAutoDecline('workerName', 'spinnerWorker', 'workerNameGenitive', null, 'workerGenitiveHelper');

    async function ensureAllNamesDeclined() {
        const tasks = [];
        
        const appInput = document.getElementById('applicantName')?.value.trim();
        if (appInput) {
            const genEl = document.getElementById('applicantNameGenitive');
            if (genEl && (!genEl.value.trim() || genEl.dataset.sourceNom !== appInput)) { 
                tasks.push(declineFullName(appInput, 'genitive').then(r => {
                    genEl.value = r || appInput;
                    genEl.dataset.sourceNom = appInput;
                })); 
            }
        }
        
        const recInput = document.getElementById('helpReceiverName')?.value.trim();
        if (recInput) {
            const genEl = document.getElementById('helpReceiverNameGenitive');
            const datEl = document.getElementById('helpReceiverNameDative');
            if (genEl && (!genEl.value.trim() || genEl.dataset.sourceNom !== recInput)) {
                tasks.push(declineFullName(recInput, 'genitive').then(r => {
                    genEl.value = r || recInput;
                    genEl.dataset.sourceNom = recInput;
                }));
            }
            if (datEl && (!datEl.value.trim() || datEl.dataset.sourceNom !== recInput)) {
                tasks.push(declineFullName(recInput, 'dative').then(r => {
                    datEl.value = r || recInput;
                    datEl.dataset.sourceNom = recInput;
                }));
            }
        }
        
        const workerInput = document.getElementById('workerName')?.value.trim();
        if (workerInput) {
            const genEl = document.getElementById('workerNameGenitive');
            if (genEl && (!genEl.value.trim() || genEl.dataset.sourceNom !== workerInput)) {
                tasks.push(declineFullName(workerInput, 'genitive').then(r => {
                    genEl.value = r || workerInput;
                    genEl.dataset.sourceNom = workerInput;
                }));
            }
        }
        
        await Promise.all(tasks);
    }

    // 12. Пошук категорії суб'єкта права та відображення підказок
    lawPointSearch?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (clearLawSearchBtn) {
            clearLawSearchBtn.style.display = val ? 'block' : 'none';
        }
        
        const revMap = window.categoryReverseMap || {};
        if (revMap[val]) {
            lawPointHidden.value = revMap[val];
            lawPointSearch.classList.remove('error-border');
        } else {
            lawPointHidden.value = "";
        }
        handleCategoryChange();
    });

    lawPointSearch?.addEventListener('focus', function () {
        this.select();
    });

    clearLawSearchBtn?.addEventListener('click', () => {
        if (lawPointSearch) {
            lawPointSearch.value = '';
            lawPointHidden.value = '';
            clearLawSearchBtn.style.display = 'none';
            lawPointSearch.focus(); 
            handleCategoryChange();
        }
    });

    helpIconBtn?.addEventListener('click', () => {
        const lawDesc = document.getElementById('lawDescription');
        if (lawDesc && lawPointHidden.value) {
            lawDesc.style.display = (lawDesc.style.display === 'block' ? 'none' : 'block');
        }
    });

    // 13. Доходи: розрахунок середнього доходу за 3 місяці, визначення кварталу та валідація лімітів
    let activeIncomeTab = 'simple';
    let incomeCalcMode = 'simple';
    window.incomeCalcMode = 'simple';

    function setIncomeTab(tabName) {
        const isAdvanced = (tabName === 'extended' || tabName === 'advanced');
        activeIncomeTab = isAdvanced ? 'extended' : 'simple';
        incomeCalcMode = isAdvanced ? 'advanced' : 'simple';
        window.incomeCalcMode = incomeCalcMode;

        const btnSimple = document.getElementById('tabSimpleCalc');
        const btnExt = document.getElementById('tabExtendedCalc');
        const blockSimple = document.getElementById('threeMonthsBlock');
        const blockExt = document.getElementById('extendedCalcBlock');

        if (isAdvanced) {
            btnSimple?.classList.remove('active');
            btnExt?.classList.add('active');
            if (blockSimple) blockSimple.style.display = 'none';
            if (blockExt) blockExt.style.display = 'block';

            ['incomeMonth1', 'incomeMonth2', 'incomeMonth3'].forEach(id => {
                document.getElementById(id)?.classList.remove('error-border');
            });

            // Якщо всі картки місяців порожні, створимо по одному рядку
            [1, 2, 3].forEach(m => {
                const c = document.getElementById(`incomeRowsContainer${m}`);
                if (c && c.children.length === 0) {
                    createIncomeRow(m);
                }
            });

            syncExtendedIncome();
        } else {
            btnSimple?.classList.add('active');
            btnExt?.classList.remove('active');
            if (blockSimple) blockSimple.style.display = 'grid';
            if (blockExt) blockExt.style.display = 'none';

            calculateAverageIncome();
        }
    }
    window.setIncomeTab = setIncomeTab;

    document.getElementById('tabSimpleCalc')?.addEventListener('click', () => setIncomeTab('simple'));
    document.getElementById('tabExtendedCalc')?.addEventListener('click', () => setIncomeTab('extended'));

    function updateQuarterMonths() {
        const quarterEl = document.getElementById('incomePeriodQuarter');
        if (!quarterEl) return;
        const q = quarterEl.value;
        const qMap = window.QUARTER_MONTHS || {};
        const months = qMap[q];
        if (months) {
            const l1 = document.getElementById('labelMonth1');
            const l2 = document.getElementById('labelMonth2');
            const l3 = document.getElementById('labelMonth3');
            if (l1) l1.textContent = months[0].charAt(0).toUpperCase() + months[0].slice(1);
            if (l2) l2.textContent = months[1].charAt(0).toUpperCase() + months[1].slice(1);
            if (l3) l3.textContent = months[2].charAt(0).toUpperCase() + months[2].slice(1);

            const mTitle1 = document.getElementById('monthTitle1');
            const mTitle2 = document.getElementById('monthTitle2');
            const mTitle3 = document.getElementById('monthTitle3');
            if (mTitle1) mTitle1.textContent = months[0].charAt(0).toUpperCase() + months[0].slice(1);
            if (mTitle2) mTitle2.textContent = months[1].charAt(0).toUpperCase() + months[1].slice(1);
            if (mTitle3) mTitle3.textContent = months[2].charAt(0).toUpperCase() + months[2].slice(1);
        }
        if (activeIncomeTab === 'extended') {
            checkIncomeLimits();
        }
    }
    document.getElementById('incomePeriodQuarter')?.addEventListener('change', updateQuarterMonths);

    // Створення рядка доходу в розширеному калькуляторі
    function createIncomeRow(containerIndex, initialData = {}) {
        const container = document.getElementById(`incomeRowsContainer${containerIndex}`);
        if (!container) return null;

        const row = document.createElement('div');
        row.className = 'income-row';

        const codes = window.IncomeCalculator?.INCOME_CODES || [];
        const optgroups = [
            { label: "💼 Оподатковувані доходи (зарплата, пенсія, ЦПД)", codes: ['101', '102', 'pfu', '185', '140', '103', '157', '126', '127'] },
            { label: "🌾 Доходи з періодичним розподілом (паї, майно)", codes: ['106_195', '104', '105', '109', '114_115'] },
            { label: "🔻 Відрахування з доходу (пп. 1 п. 4 Методики)", codes: ['alimony_paid'] },
            { label: "🏛️ Соціальні виплати код 128 (ВРАХОВУЮТЬСЯ)", codes: ['128_low_income', '128_birth_monthly', '128_unemployment', '128_utilities_privilege', '128_single_mother'] },
            { label: "🛡️ Соціальні виплати код 128 (НЕ враховуються)", codes: ['128_vpo', '128_pregnancy', '128_birth_lump', '128_adoption_lump', '128_subsidy', '128_baby_package', '128_nanny', '128_care', '128_independence_day', '128_alimony_temp', '128_guardianship', '128_other_lump'] },
            { label: "🚫 Інші неоподатковувані доходи (НЕ враховуються)", codes: ['113', '153_197', '151', '148_179', '131_205', '146'] }
        ];

        let selectHtml = `<select class="income-code-select">`;
        optgroups.forEach(grp => {
            selectHtml += `<optgroup label="${grp.label}">`;
            grp.codes.forEach(cid => {
                const cDef = codes.find(c => c.id === cid);
                if (cDef) {
                    const sel = (initialData.codeId === cDef.id) ? 'selected' : '';
                    selectHtml += `<option value="${cDef.id}" ${sel}>${cDef.name}</option>`;
                }
            });
            selectHtml += `</optgroup>`;
        });
        selectHtml += `</select>`;

        row.innerHTML = `
            ${selectHtml}
            <input type="number" class="income-amount-input" placeholder="Сума (грн)" step="0.01" value="${initialData.amount !== undefined ? initialData.amount : ''}">
            <select class="income-periodicity-select" style="display: none;">
                <option value="1">Період: 1 міс.</option>
                <option value="3">Період: 3 міс. (квартал)</option>
                <option value="6">Період: 6 міс. (півріччя)</option>
                <option value="12" selected>Період: 12 міс. (рік)</option>
            </select>
            <label class="income-checkbox-label income-tax-label" style="display: none;">
                <input type="checkbox" class="income-tax-zero" ${initialData.isTaxZero ? 'checked' : ''}>
                <span>Податок у 4ДФ = 0,00 грн</span>
            </label>
            <label class="income-checkbox-label income-debt-label" style="display: none;">
                <input type="checkbox" class="income-debt-check" ${initialData.isDebt ? 'checked' : ''}>
                <span>Фактично НЕ виплачено (довідка про заборгованість)</span>
            </label>
            <div class="income-badge"></div>
            <button type="button" class="btn-icon btn-remove-income" title="Видалити рядок">✕</button>
        `;

        container.appendChild(row);

        const codeSelect = row.querySelector('.income-code-select');
        const amountInput = row.querySelector('.income-amount-input');
        const periodicitySelect = row.querySelector('.income-periodicity-select');
        const taxLabel = row.querySelector('.income-tax-label');
        const taxCheck = row.querySelector('.income-tax-zero');
        const debtLabel = row.querySelector('.income-debt-label');
        const debtCheck = row.querySelector('.income-debt-check');
        const removeBtn = row.querySelector('.btn-remove-income');

        function updateRowControls() {
            const selectedCodeId = codeSelect.value;
            const cfg = window.IncomeCalculator?.getCodeConfig(selectedCodeId) || {};

            if (cfg.allowPeriodicity) {
                periodicitySelect.style.display = 'inline-block';
                if (initialData.periodicity) {
                    periodicitySelect.value = initialData.periodicity;
                }
            } else {
                periodicitySelect.style.display = 'none';
            }

            if (cfg.allowTaxZero) {
                taxLabel.style.display = 'inline-flex';
            } else {
                taxLabel.style.display = 'none';
                taxCheck.checked = false;
            }

            if (cfg.allowDebt) {
                debtLabel.style.display = 'inline-flex';
            } else {
                debtLabel.style.display = 'none';
                debtCheck.checked = false;
            }
        }

        codeSelect.addEventListener('change', () => {
            updateRowControls();
            syncExtendedIncome();
        });

        amountInput.addEventListener('input', syncExtendedIncome);
        periodicitySelect.addEventListener('change', syncExtendedIncome);
        taxCheck.addEventListener('change', syncExtendedIncome);
        debtCheck.addEventListener('change', syncExtendedIncome);

        removeBtn.addEventListener('click', () => {
            row.remove();
            syncExtendedIncome();
        });

        updateRowControls();
        return row;
    }
    window.createIncomeRow = createIncomeRow;

    [1, 2, 3].forEach(mIndex => {
        document.getElementById(`btnAddIncome${mIndex}`)?.addEventListener('click', () => {
            const r = createIncomeRow(mIndex);
            r?.querySelector('.income-amount-input')?.focus();
            syncExtendedIncome();
        });
    });

    document.getElementById('fopStatusSelect')?.addEventListener('change', syncExtendedIncome);
    document.getElementById('pensionFirstTimeCheck')?.addEventListener('change', (e) => {
        const pBlock = document.getElementById('pensionFirstTimeBlock');
        if (pBlock) pBlock.style.display = e.target.checked ? 'block' : 'none';
        syncExtendedIncome();
    });
    document.getElementById('pensionFirstTimeAmount')?.addEventListener('input', syncExtendedIncome);

    function syncExtendedIncome() {
        if (activeIncomeTab !== 'extended' || !window.IncomeCalculator) return;

        const monthsData = [];
        for (let m = 1; m <= 3; m++) {
            const container = document.getElementById(`incomeRowsContainer${m}`);
            const rows = container ? Array.from(container.querySelectorAll('.income-row')) : [];
            const mRowsData = rows.map(r => {
                const codeId = r.querySelector('.income-code-select')?.value || '101';
                const amount = parseFloat(r.querySelector('.income-amount-input')?.value) || 0;
                const periodicity = parseInt(r.querySelector('.income-periodicity-select')?.value) || 12;
                const isTaxZero = !!r.querySelector('.income-tax-zero')?.checked;
                const isDebt = !!r.querySelector('.income-debt-check')?.checked;
                return { codeId, amount, periodicity, isTaxZero, isDebt, rowEl: r };
            });
            monthsData.push(mRowsData);
        }

        const fopStatus = document.getElementById('fopStatusSelect')?.value || 'none';
        const isPensionFirst = !!document.getElementById('pensionFirstTimeCheck')?.checked;
        const pensionAmount = parseFloat(document.getElementById('pensionFirstTimeAmount')?.value) || 0;

        const calcResult = window.IncomeCalculator.calculateFullState({
            monthsData,
            fopStatus,
            isPensionFirst,
            pensionAmount
        });

        window._lastExtendedIncomeResult = calcResult;

        calcResult.monthsResults.forEach((mRes, idx) => {
            const mNum = idx + 1;
            const accountedSpan = document.getElementById(`monthAccounted${mNum}`);
            if (accountedSpan) {
                accountedSpan.textContent = mRes.accountedSum.toFixed(2);
            }

            mRes.rows.forEach((evalRes, rIdx) => {
                const rowObj = monthsData[idx][rIdx];
                if (!rowObj || !rowObj.rowEl) return;
                const badgeEl = rowObj.rowEl.querySelector('.income-badge');
                if (!badgeEl) return;

                badgeEl.className = 'income-badge';
                if (evalRes.badgeType === 'excluded') {
                    badgeEl.classList.add('badge-excluded');
                    badgeEl.textContent = `⚪ Не враховується (0,00 грн)`;
                    badgeEl.title = evalRes.reason || 'Не підлягає включенню до сукупного доходу';
                } else if (evalRes.badgeType === 'deduction') {
                    badgeEl.classList.add('badge-deduction');
                    badgeEl.textContent = `🔴 Відрахування (-${Math.abs(evalRes.accountedAmount).toFixed(2)} грн)`;
                    badgeEl.title = evalRes.reason || 'Відрахування з доходу згідно з пп. 1 п. 4 Методики';
                } else {
                    badgeEl.classList.add('badge-included');
                    badgeEl.textContent = `🟢 Враховується (+${evalRes.accountedAmount.toFixed(2)} грн)`;
                    badgeEl.title = evalRes.normRef || 'Враховується до сукупного доходу';
                }
            });
        });

        const totalEl = document.getElementById('incomeTotalAmount');
        const avgEl = document.getElementById('incomeAverageAmount');
        const srcEl = document.getElementById('incomeSource');

        if (totalEl) totalEl.value = calcResult.finalQuarterSum.toFixed(2);
        if (avgEl) avgEl.value = calcResult.finalAverageSum.toFixed(2);
        if (srcEl && calcResult.sourcesString) srcEl.value = calcResult.sourcesString;

        checkIncomeLimits();
    }
    window.syncExtendedIncome = syncExtendedIncome;

    function checkIncomeLimits() {
        const val = lawPointHidden?.value;
        const warningBox = document.getElementById('incomeWarning');
        const warningDetails = document.getElementById('incomeWarningDetails');
        const limitSpan = document.getElementById('incomeLimitSpan');
        const avgEl = document.getElementById('incomeAverageAmount');
        const totEl = document.getElementById('incomeTotalAmount');
        
        if (!warningBox) return;

        if (!val || (val !== '1_low' && val !== '1_disability')) {
            warningBox.style.display = 'none';
            if (warningDetails) warningDetails.innerHTML = '';
            avgEl?.classList.remove('error-border');
            totEl?.classList.remove('error-border');
            return;
        }

        let amountToCheck = 0;
        let limit = 0;
        let errorField = null;

        if (val === '1_disability') {
            limit = window.LIMIT_ABLE || 6656; 
            amountToCheck = parseFloat(totEl?.value) || 0;
            errorField = totEl;
            avgEl?.classList.remove('error-border');
        } else if (val === '1_low') {
            const cap = document.getElementById('workingCapacitySelect')?.value;
            const limitAble = window.LIMIT_ABLE || 6656;
            const limitDisabled = window.LIMIT_DISABLED || 5190;
            limit = (cap === 'able') ? limitAble : limitDisabled;
            amountToCheck = parseFloat(avgEl?.value) || 0;
            errorField = avgEl;
            totEl?.classList.remove('error-border');
        }

        if (limit > 0 && amountToCheck > limit) {
            if (limitSpan) limitSpan.textContent = limit;
            warningBox.style.display = 'block';
            errorField?.classList.add('error-border');

            if (warningDetails) {
                const diff = amountToCheck - limit;
                let detailsHtml = `
                    <div style="margin-bottom: 12px; font-weight: 600; color: #b3261e;">
                        ⚠️ Перевищення ліміту на ${diff.toFixed(2)} грн/міс. (середньомісячний дохід: ${amountToCheck.toFixed(2)} грн, встановлений законом поріг: ${limit.toFixed(2)} грн).
                    </div>
                `;

                if (activeIncomeTab === 'extended' && window._lastExtendedIncomeResult) {
                    const res = window._lastExtendedIncomeResult;
                    const q = document.getElementById('incomePeriodQuarter')?.value;
                    const qMap = window.QUARTER_MONTHS || {};
                    const months = qMap[q] || ['Місяць 1', 'Місяць 2', 'Місяць 3'];

                    detailsHtml += `
                        <table class="warning-breakdown-table">
                            <thead>
                                <tr>
                                    <th>Період</th>
                                    <th>Нараховано брутто (грн)</th>
                                    <th>Виключено / не враховано (грн)</th>
                                    <th>Враховано до розрахунку (грн)</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    res.monthsResults.forEach((mRes, i) => {
                        const mName = months[i] ? (months[i].charAt(0).toUpperCase() + months[i].slice(1)) : `Місяць ${i + 1}`;
                        detailsHtml += `
                            <tr>
                                <td><strong>${mName}</strong></td>
                                <td>${mRes.rawSum.toFixed(2)}</td>
                                <td>${mRes.excludedSum.toFixed(2)}</td>
                                <td><strong>${mRes.accountedSum.toFixed(2)}</strong></td>
                            </tr>
                        `;
                    });

                    detailsHtml += `
                            <tr style="font-weight: 600; background-color: rgba(0,0,0,0.04);">
                                <td>Разом за квартал:</td>
                                <td>${res.totalRawSum.toFixed(2)}</td>
                                <td>${res.totalExcludedSum.toFixed(2)}</td>
                                <td>${res.monthsAccountedSum.toFixed(2)}</td>
                            </tr>
                            <tr style="font-weight: 700; background-color: rgba(186, 26, 26, 0.08); color: #ba1a1a;">
                                <td>Підсумковий середньомісячний:</td>
                                <td colspan="2">Джерела: ${res.sourcesString || '—'}</td>
                                <td>${res.finalAverageSum.toFixed(2)} грн/міс.</td>
                            </tr>
                        </tbody>
                        </table>
                    `;

                    if (res.fopStandard && res.fopStandard.group && res.fopStandard.group !== 'none') {
                        detailsHtml += `
                            <div style="margin-top: 10px; padding: 8px 12px; background: #fff; border-left: 4px solid var(--md-sys-color-primary); border-radius: 4px; font-size: 13px;">
                                <strong>ℹ️ Застосовано законодавчий норматив ФОП (${res.fopStandard.label}):</strong> 
                                нормативний дохід зафіксовано у розмірі <strong>${res.fopStandard.monthly.toFixed(2)} грн/міс.</strong> (${res.fopStandard.quarterly.toFixed(2)} грн за квартал) згідно з абз. 1–4 пп. 6 п. 3 Методики № 1445/5. Суми за кодом 157 у таблицях ігноруються.
                            </div>
                        `;
                    }

                    if (res.isPensionFirst) {
                        detailsHtml += `
                            <div style="margin-top: 10px; padding: 8px 12px; background: #fff; border-left: 4px solid var(--md-sys-color-primary); border-radius: 4px; font-size: 13px;">
                                <strong>ℹ️ Режим первинного призначення пенсії / звільнення (пп. 5 п. 3 Методики № 1445/5):</strong> 
                                середньомісячний дохід зафіксовано на рівні призначеної пенсії <strong>${res.pensionAmount.toFixed(2)} грн/міс.</strong>
                            </div>
                        `;
                    }
                }

                detailsHtml += `
                    <div class="legal-checklist">
                        <div class="legal-checklist-title">📋 Юридичний чеклист перед прийняттям рішення про відмову:</div>
                        <ul>
                            <li>1. Перевірте, чи не належить заявник до інших суб'єктів права за ст. 14 Закону (ВПО, ветерани війни, постраждалі від домашнього насильства, діти тощо), де право на БВПД надається без урахування доходів.</li>
                            <li>2. Перевірте наявність неоподатковуваних доходів за ст. 165 ПК України та абз. 16 пп. 3 п. 2 Методики (одноразова матеріальна допомога, кредити, позики, спадщина, допомога на поховання).</li>
                            <li>3. У разі заборгованості з виплати зарплати чи пенсії — вимагайте довідку про заборгованість від роботодавця або органу ПФУ (абз. 2 пп. 1 п. 2 Методики). Фактично невиплачені суми виключаються з розрахунку.</li>
                            <li>4. У разі підтвердження перевищення ліміту — підготуйте мотивоване письмове рішення про відмову у наданні БВПД відповідно до ч. 1 ст. 15 Закону із зазначенням порядку та строків його оскарження.</li>
                        </ul>
                    </div>
                `;

                warningDetails.innerHTML = detailsHtml;
            }
        } else {
            warningBox.style.display = 'none';
            if (warningDetails) warningDetails.innerHTML = '';
            if (amountToCheck > 0 || (errorField && errorField.value.trim() !== '')) {
                errorField?.classList.remove('error-border');
            }
        }
    }

    document.getElementById('workingCapacitySelect')?.addEventListener('change', checkIncomeLimits);
    document.getElementById('incomeAverageAmount')?.addEventListener('input', checkIncomeLimits);
    document.getElementById('incomeTotalAmount')?.addEventListener('input', checkIncomeLimits);

    function calculateAverageIncome() {
        const v1 = document.getElementById('incomeMonth1')?.value || '';
        const v2 = document.getElementById('incomeMonth2')?.value || '';
        const v3 = document.getElementById('incomeMonth3')?.value || '';
        
        if (v1 !== '' || v2 !== '' || v3 !== '') {
            const m1 = parseFloat(v1) || 0;
            const m2 = parseFloat(v2) || 0;
            const m3 = parseFloat(v3) || 0;
            const sum = m1 + m2 + m3;
            const avg = sum / 3;
            const totalEl = document.getElementById('incomeTotalAmount');
            const avgEl = document.getElementById('incomeAverageAmount');
            if (totalEl) totalEl.value = sum.toFixed(2);
            if (avgEl) avgEl.value = avg.toFixed(2);
            checkIncomeLimits();
        }
    }

    ['incomeMonth1', 'incomeMonth2', 'incomeMonth3'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calculateAverageIncome);
    });

    function autoFillIncomePeriod() {
        const lawVal = lawPointHidden?.value;
        if (lawVal !== '1_low' && lawVal !== '1_disability') return;

        const dateInput = document.getElementById('docDate');
        const baseDate = dateInput?.valueAsDate ? new Date(dateInput.valueAsDate) : new Date();
        const currentMonth = baseDate.getMonth(); 
        let targetYear = baseDate.getFullYear();

        const quarterSelect = document.getElementById('incomePeriodQuarter');
        const monthSelect = document.getElementById('incomePeriodMonth');
        const yearInput = document.getElementById('incomeYear');

        if (lawVal === '1_low') {
            let targetQuarter = "";
            switch (currentMonth) {
                case 0: targetQuarter = "3 квартал"; targetYear -= 1; break;
                case 1: case 2: case 3: targetQuarter = "4 квартал"; targetYear -= 1; break;
                case 4: case 5: case 6: targetQuarter = "1 квартал"; break;
                case 7: case 8: case 9: targetQuarter = "2 квартал"; break;
                case 10: case 11: targetQuarter = "3 квартал"; break;
            }
            if (quarterSelect) quarterSelect.value = targetQuarter;
            if (yearInput) yearInput.value = targetYear;

        } else if (lawVal === '1_disability') {
            const months = window.MONTH_NAMES || ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"];
            let targetMonthIndex = currentMonth - 1;
            if (targetMonthIndex < 0) targetMonthIndex = 11; 
            
            if (monthSelect) monthSelect.value = months[targetMonthIndex];
            if (yearInput) yearInput.value = targetYear; 
        }
        updateQuarterMonths();
    }

    document.getElementById('docDate')?.addEventListener('change', autoFillIncomePeriod);

    function handleCategoryChange() {
        const val = lawPointHidden?.value;
        const lawDesc = document.getElementById('lawDescription');
        const lawDescMap = window.LAW_DESCRIPTIONS || {};
        
        if (lawDesc) {
            lawDesc.textContent = lawDescMap[val] || "";
            lawDesc.style.display = val ? 'block' : 'none';
        }
        
        const incSec = document.getElementById('incomeSection');
        const incResBlock = document.getElementById('incomeResultsBlock');
        const avgGrp = document.getElementById('averageAmountGroup');

        if (val === '1_low' || val === '1_disability') {
            if (incSec) incSec.style.display = 'block';
            const periodQ = document.getElementById('periodQuarterBlock');
            const periodM = document.getElementById('periodMonthBlock');
            if (periodQ) periodQ.style.display = (val === '1_low' ? 'block' : 'none');
            if (periodM) periodM.style.display = (val === '1_low' ? 'none' : 'block');
            
            const tabsContainer = document.getElementById('incomeCalcTabsContainer');
            if (tabsContainer) {
                tabsContainer.style.display = (val === '1_low') ? 'block' : 'none';
            }

            const threeMonthsBlock = document.getElementById('threeMonthsBlock');
            const extendedCalcBlock = document.getElementById('extendedCalcBlock');
            if (val === '1_low') {
                if (activeIncomeTab === 'extended') {
                    if (threeMonthsBlock) threeMonthsBlock.style.display = 'none';
                    if (extendedCalcBlock) extendedCalcBlock.style.display = 'block';
                } else {
                    if (threeMonthsBlock) threeMonthsBlock.style.display = 'grid';
                    if (extendedCalcBlock) extendedCalcBlock.style.display = 'none';
                }
            } else {
                if (threeMonthsBlock) threeMonthsBlock.style.display = 'none';
                if (extendedCalcBlock) extendedCalcBlock.style.display = 'none';
            }
            
            const capacityRow = document.getElementById('workingCapacityRow');
            if (capacityRow) {
                capacityRow.style.display = (val === '1_low') ? 'block' : 'none';
            }

            if (val === '1_low') {
                if (incResBlock) incResBlock.className = 'row-3';
                if (avgGrp) avgGrp.style.display = 'block';
            } else { 
                if (incResBlock) incResBlock.className = 'row';
                if (avgGrp) avgGrp.style.display = 'none';
                const avgEl = document.getElementById('incomeAverageAmount');
                if (avgEl) avgEl.value = ''; 
            }

            autoFillIncomePeriod(); 
            checkIncomeLimits();
        } else {
            if (incSec) incSec.style.display = 'none';
            const tabsContainer = document.getElementById('incomeCalcTabsContainer');
            if (tabsContainer) tabsContainer.style.display = 'none';
            const extendedCalcBlock = document.getElementById('extendedCalcBlock');
            if (extendedCalcBlock) extendedCalcBlock.style.display = 'none';
            const warnBox = document.getElementById('incomeWarning');
            if (warnBox) warnBox.style.display = 'none';
        }
    }

    handleCategoryChange();

    // 14. Динамічна таблиця додатків
    function addAttachmentRow() {
        const container = document.getElementById('attachmentsContainer');
        if (!container) return;
        const index = container.children.length + 1;
        const row = document.createElement('div');
        row.className = 'attachment-row';
        row.innerHTML = `<span class="attachment-number">${index}.</span><input type="text" class="attachment-name" placeholder="Назва документа"><span class="attachment-suffix">на</span><input type="text" class="attachment-pages" placeholder="__"><span class="attachment-suffix">арк.</span><button type="button" class="btn-icon btn-remove" title="Видалити рядок">✕</button>`;
        container.appendChild(row);
    }
    
    // Ініціалізація 5 порожніх рядків додатків
    const attContainer = document.getElementById('attachmentsContainer');
    if (attContainer && attContainer.children.length === 0) {
        for (let i = 0; i < 5; i++) addAttachmentRow();
    }
    
    document.getElementById('btnAddAttachment')?.addEventListener('click', addAttachmentRow);
    document.getElementById('attachmentsContainer')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            e.target.closest('.attachment-row').remove();
            Array.from(document.getElementById('attachmentsContainer').children).forEach((r, i) => {
                const numEl = r.querySelector('.attachment-number');
                if (numEl) numEl.textContent = `${i + 1}.`;
            });
        }
    });

    // 15. Експорт та імпорт профілю клієнта (JSON)
    const profileFields = window.PROFILE_FIELDS || [
        'applicantName', 'applicantNameGenitive', 'applicantPhone', 'applicantEmail', 
        'applicantAddress', 'notifyMethod', 'applicantPassport', 'helpReceiverName', 
        'helpReceiverNameDative', 'helpReceiverNameGenitive'
    ];
    
    document.getElementById('btnExportProfile')?.addEventListener('click', () => {
        const profile = {};
        profileFields.forEach(f => { profile[f] = document.getElementById(f)?.value || ''; });
        const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
        const name = document.getElementById('applicantName')?.value?.trim() || 'Клієнт';
        saveAs(blob, `Profile_${name}.json`);
        showToast("Профіль завантажено на ПК!", true);
    });

    document.getElementById('btnImportProfile')?.addEventListener('click', () => {
        document.getElementById('importProfileInput')?.click();
    });

    document.getElementById('importProfileInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                profileFields.forEach(f => {
                    const el = document.getElementById(f);
                    if (data[f] !== undefined && el) el.value = data[f];
                });
                showToast('Профіль успішно завантажено!', true);
                document.querySelectorAll('.error-border').forEach(el => el.classList.remove('error-border'));
                ['applicantGenitiveHelper', 'receiverDativeHelper', 'receiverGenitiveHelper'].forEach(id => {
                    const h = document.getElementById(id);
                    if (h) h.style.display = 'block';
                });
            } catch (err) {
                showToast('Помилка читання файлу профілю');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    // 16. Скидання клієнтських даних
    document.getElementById('btnClearClientData')?.addEventListener('click', function () {
        const fieldsToKeep = ['centerSelect', 'workerName', 'workerNameGenitive', 'orderSigner', 'letterPosition', 'letterBureau', 'docDate', 'regDate', 'incomeYear'];
        document.querySelectorAll('#legalForm input, #legalForm textarea, #legalForm select').forEach(el => {
            if (!fieldsToKeep.includes(el.id) && el.type !== 'file' && el.type !== 'radio' && el.type !== 'checkbox') {
                if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
            }
        });
        document.querySelectorAll('.inflection-helper').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.error-border').forEach(el => el.classList.remove('error-border'));
        
        const ac = document.getElementById('attachmentsContainer');
        if (ac) {
            ac.innerHTML = '';
            for (let i = 0; i < 5; i++) addAttachmentRow();
        }
        
        if (lawPointHidden) lawPointHidden.value = '';
        if (lawPointSearch) lawPointSearch.value = '';
        if (clearLawSearchBtn) clearLawSearchBtn.style.display = 'none';
        
        const civilRadio = document.querySelector('input[name="caseType"][value="civil"]');
        if (civilRadio) civilRadio.checked = true;
        
        const civilBlock = document.getElementById('civilFieldsBlock');
        const criminalBlock = document.getElementById('criminalFieldsBlock');
        const adminBlock = document.getElementById('adminFieldsBlock');
        if (civilBlock) civilBlock.style.display = 'block';
        if (criminalBlock) criminalBlock.style.display = 'none';
        if (adminBlock) adminBlock.style.display = 'none';

        if (typeof window.setIncomeTab === 'function') window.setIncomeTab('simple');
        [1, 2, 3].forEach(m => {
            const container = document.getElementById(`incomeRowsContainer${m}`);
            if (container) container.innerHTML = '';
            const acc = document.getElementById(`monthAccounted${m}`);
            if (acc) acc.textContent = '0,00';
        });
        const fopSel = document.getElementById('fopStatusSelect');
        if (fopSel) fopSel.selectedIndex = 0;
        const penCheck = document.getElementById('pensionFirstTimeCheck');
        if (penCheck) penCheck.checked = false;
        const penBlock = document.getElementById('pensionFirstTimeBlock');
        if (penBlock) penBlock.style.display = 'none';
        const penAmt = document.getElementById('pensionFirstTimeAmount');
        if (penAmt) penAmt.value = '';
        const warnDetails = document.getElementById('incomeWarningDetails');
        if (warnDetails) warnDetails.innerHTML = '';

        handleCategoryChange();
        showToast("Дані клієнта очищено!", true);
    });

    // 17. Валідація форми
    function validateForm() {
        let isValid = true;
        
        const commonFields = window.COMMON_MANDATORY_FIELDS || [
            'applicantName', 'applicantPhone', 'applicantAddress', 'applicantPassport',
            'helpReceiverName', 'workerName', 'rkzkNum'
        ];
        
        commonFields.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.value.trim()) { el.classList.add('error-border'); isValid = false; }
            else if (el) { el.classList.remove('error-border'); }
        });
        
        if (!lawPointHidden?.value) {
            lawPointSearch?.classList.add('error-border');
            isValid = false;
        } else {
            lawPointSearch?.classList.remove('error-border');
        }

        const caseType = document.querySelector('input[name="caseType"]:checked')?.value;
        if (caseType === 'civil') {
            ['questionDetails', 'caseDetails'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.value.trim()) { el.classList.add('error-border'); isValid = false; }
                else if (el) { el.classList.remove('error-border'); }
            });
        } else if (caseType === 'criminal') {
            // Номер судової справи ('courtCaseNum') НЕ є обов'язковим для потерпілого
            ['erdrNum', 'erdrDate', 'criminalArticle'].forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.value.trim()) { el.classList.add('error-border'); isValid = false; }
                else if (el) { el.classList.remove('error-border'); }
            });
        } else if (caseType === 'admin') {
            // Усі поля у вкладці КУпАП не є обов'язковими
            ['adminArticle', 'adminPostanovaSeries', 'adminPostanovaNumber', 'adminCourtCaseNum'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('error-border');
            });
        }

        // Перевірка доходів для малозабезпечених та осіб з інвалідністю
        if (lawPointHidden?.value === '1_low' || lawPointHidden?.value === '1_disability') {
            let fieldsToCheck = [];
            const currentCalcMode = (window.incomeCalcMode === 'advanced' || incomeCalcMode === 'advanced' || activeIncomeTab === 'extended') ? 'advanced' : 'simple';
            
            if (lawPointHidden.value === '1_low') {
                if (currentCalcMode === 'simple') {
                    ['incomeMonth1', 'incomeMonth2', 'incomeMonth3'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el && !el.value.trim()) { el.classList.add('error-border'); isValid = false; }
                        else if (el) { el.classList.remove('error-border'); }
                    });
                    fieldsToCheck = ['incomeTotalAmount', 'incomeAverageAmount', 'incomeSource'];
                } else {
                    ['incomeMonth1', 'incomeMonth2', 'incomeMonth3'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.classList.remove('error-border');
                    });
                    fieldsToCheck = ['incomeTotalAmount'];
                    const avgEl = document.getElementById('incomeAverageAmount');
                    if (avgEl) avgEl.classList.remove('error-border');
                    const srcEl = document.getElementById('incomeSource');
                    if (srcEl) srcEl.classList.remove('error-border');
                }
            } else {
                ['incomeMonth1', 'incomeMonth2', 'incomeMonth3', 'incomeAverageAmount'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.remove('error-border');
                });
                fieldsToCheck = ['incomeTotalAmount', 'incomeSource'];
            }

            fieldsToCheck.forEach(id => {
                const el = document.getElementById(id);
                if (el && !el.value.trim()) { el.classList.add('error-border'); isValid = false; }
                else if (el) { el.classList.remove('error-border'); }
            });
        }
        
        if (!isValid) {
            showToast("Заповніть обов'язкові поля!");
            const firstError = document.querySelector('.error-border');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus({ preventScroll: true });
            }
        }
        return isValid;
    }
    window.validateForm = validateForm;

    // 18. Обробка дій (кнопки генерації та перегляду)
    async function handleAction(actionFn) {
        if (!validateForm()) return;
        document.body.style.cursor = 'wait';
        try {
            await ensureAllNamesDeclined(); 
            isFormDirty = false;
            await actionFn();
        } finally {
            document.body.style.cursor = 'default';
        }
    }
    window.handleAction = handleAction;

    // Слухачі кнопок попереднього перегляду (👁️)
    document.getElementById('btnPreviewDoc')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('zayava')));
    document.getElementById('btnPreviewTalon')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('talon')));
    document.getElementById('btnPreviewOrderLawyer')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('order', true)));
    document.getElementById('btnPreviewOrderEmployee')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('order', false)));
    document.getElementById('btnPreviewLetterLawyer')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('letter', true)));
    document.getElementById('btnPreviewLetterEmployee')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.openPreview('letter', false)));

    // Слухачі кнопок генерації DOCX
    document.getElementById('btnGenerateDoc')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateDoc()));
    document.getElementById('btnGenerateTalon')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateTalon()));
    document.getElementById('btnGenerateOrderLawyer')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateOrder(true)));
    document.getElementById('btnGenerateOrderEmployee')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateOrder(false)));
    document.getElementById('btnGenerateLetterLawyer')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateServiceLetter(true)));
    document.getElementById('btnGenerateLetterEmployee')?.addEventListener('click', () => handleAction(() => window.DocxGenerator.generateServiceLetter(false)));

    // Закриття модального вікна
    closePreviewBtn?.addEventListener('click', () => {
        if (previewModal) previewModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === previewModal) previewModal.style.display = 'none';
    });

    // 19. Ініціалізація модуля ШІ
    if (window.AIHelper && typeof window.AIHelper.initAI === 'function') {
        window.AIHelper.initAI();
    }
});
