/**
 * Модуль розширеного розрахунку доходів за Методикою Міністерства юстиції України № 1445/5
 * (затверджена наказом Мін'юсту від 19.12.2013 № 1445/5 з наступними змінами)
 * для суб'єктів права на БВПД за п. 1 ч. 1 ст. 14 Закону України «Про безоплатну правничу допомогу».
 */

(function () {
    // 1. Повний класифікатор кодів доходів (з урахуванням форми 4ДФ та положень Методики № 1445/5)
    const INCOME_CODES = [
        // --- Оподатковувані доходи, що враховуються (абз. 1 пп. 1 п. 2 Методики) ---
        { 
            id: '101', 
            name: '101 — Заробітна плата (основна, додаткова, премії, відпускні, лікарняні)', 
            shortName: 'зарплата', 
            category: 'salary', 
            action: 'include', 
            allowDebt: true, 
            sourceName: 'заробітна плата',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '102', 
            name: '102 — Винагорода за ЦПД (цивільно-правовими договорами)', 
            shortName: 'ЦПД', 
            category: 'gpc', 
            action: 'include', 
            sourceName: 'винагорода за ЦПД',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: 'pfu', 
            name: 'Пенсія (ПФУ) — усі види державних пенсійних виплат', 
            shortName: 'пенсія', 
            category: 'pension', 
            action: 'include', 
            allowDebt: true, 
            sourceName: 'пенсія',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '185', 
            name: '185 — Грошове забезпечення військовослужбовців, правоохоронців', 
            shortName: 'грошове забезпечення', 
            category: 'military', 
            action: 'include', 
            allowDebt: true, 
            sourceName: 'грошове забезпечення',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '140', 
            name: '140 — Одержані аліменти на утримання дітей або непрацездатних осіб', 
            shortName: 'одержані аліменти', 
            category: 'alimony', 
            action: 'include', 
            sourceName: 'аліменти',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '103', 
            name: '103 — Оренда нерухомого майна (квартири, приміщення)', 
            shortName: 'оренда нерухомості', 
            category: 'rent', 
            action: 'include', 
            sourceName: 'дохід від надання майна в оренду',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '157', 
            name: '157 — Дохід від підприємницької діяльності ФОП (загальна система)', 
            shortName: 'дохід ФОП (загальна)', 
            category: 'fop', 
            action: 'fop_general', 
            sourceName: 'підприємницький дохід',
            normRef: 'пп. 6 п. 3 Методики'
        },
        { 
            id: '126', 
            name: '126 — Додаткове благо (матеріальна допомога від роботодавця тощо)', 
            shortName: 'додаткове благо', 
            category: 'benefit', 
            action: 'taxCheck', 
            allowTaxZero: true, 
            sourceName: 'інші доходи',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },
        { 
            id: '127', 
            name: '127 — Інші доходи, що підлягають оподаткуванню', 
            shortName: 'інші доходи', 
            category: 'other', 
            action: 'taxCheck', 
            allowTaxZero: true, 
            sourceName: 'інші доходи',
            normRef: 'абз. 1 пп. 1 п. 2 Методики'
        },

        // --- Доходи з періодичним розподілом (пп. 4 п. 3 Методики № 1445/5) ---
        { 
            id: '106_195', 
            name: '106, 195 — Оренда земельного паю / сільськогосподарських угідь', 
            shortName: 'оренда паю', 
            category: 'periodicity', 
            action: 'periodicity', 
            allowPeriodicity: true, 
            sourceName: 'дохід від здачі майна в оренду',
            normRef: 'пп. 4 п. 3 Методики'
        },
        { 
            id: '104', 
            name: '104 — Продаж (відчуження) нерухомого майна', 
            shortName: 'продаж нерухомості', 
            category: 'sale', 
            action: 'periodicity', 
            allowPeriodicity: true, 
            allowTaxZero: true, 
            sourceName: 'дохід від відчуження майна',
            normRef: 'пп. 4 п. 3 та абз. 16 пп. 3 п. 2 Методики'
        },
        { 
            id: '105', 
            name: '105 — Продаж рухомого майна (автотранспорт тощо)', 
            shortName: 'продаж авто/майна', 
            category: 'sale', 
            action: 'periodicity', 
            allowPeriodicity: true, 
            allowTaxZero: true, 
            sourceName: 'дохід від відчуження майна',
            normRef: 'пп. 4 п. 3 та абз. 16 пп. 3 п. 2 Методики'
        },
        { 
            id: '109', 
            name: '109 — Інвестиційний прибуток (акції, корпоративні права)', 
            shortName: 'інвестприбуток', 
            category: 'invest', 
            action: 'periodicity', 
            allowPeriodicity: true, 
            sourceName: 'інвестиційний прибуток',
            normRef: 'пп. 4 п. 3 Методики'
        },
        { 
            id: '114_115', 
            name: '114, 115 — Продаж продукції тваринництва', 
            shortName: 'продукція тваринництва', 
            category: 'agri', 
            action: 'periodicity', 
            allowPeriodicity: true, 
            sourceName: 'дохід від тваринництва',
            normRef: 'пп. 4 п. 3 Методики'
        },

        // --- Відрахування з сукупного доходу (пп. 1 п. 4 Методики № 1445/5) ---
        { 
            id: 'alimony_paid', 
            name: 'Сплачені аліменти (фактично сплачені за рішенням суду / договором)', 
            shortName: 'сплачені аліменти', 
            category: 'deduction', 
            action: 'deduct', 
            sourceName: '',
            normRef: 'пп. 1 п. 4 Методики'
        },

        // --- Соціальні виплати за кодом 128: ЩО ВРАХОВУЮТЬСЯ (абз. 1 пп. 3 п. 2) ---
        { 
            id: '128_low_income', 
            name: '128 — Допомога малозабезпеченим сім\'ям', 
            shortName: 'малозабезпеченість (128)', 
            category: 'soc_included', 
            action: 'include', 
            sourceName: 'соціальні виплати',
            normRef: 'абз. 1 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_birth_monthly', 
            name: '128 — Щомісячна частина допомоги при народженні дитини (по 860 грн)', 
            shortName: 'народження дитини щоміс. (128)', 
            category: 'soc_included', 
            action: 'include', 
            sourceName: 'соціальні виплати',
            normRef: 'абз. 1 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_unemployment', 
            name: '128 — Допомога по безробіттю (центр зайнятості)', 
            shortName: 'безробіття (128)', 
            category: 'soc_included', 
            action: 'include', 
            sourceName: 'соціальні виплати',
            normRef: 'абз. 1 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_utilities_privilege', 
            name: '128 — Пільги на оплату житлово-комунальних послуг (у грошовій формі)', 
            shortName: 'пільги ЖКП (128)', 
            category: 'soc_included', 
            action: 'include', 
            sourceName: 'соціальні виплати',
            normRef: 'абз. 1 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_single_mother', 
            name: '128 — Допомога на дітей одиноким матерям', 
            shortName: 'одинокі матері (128)', 
            category: 'soc_included', 
            action: 'include', 
            sourceName: 'соціальні виплати',
            normRef: 'абз. 1 пп. 3 п. 2 Методики'
        },

        // --- Соціальні виплати за кодом 128: ВИКЛЮЧЕННЯ (абз. 2–15 пп. 3 п. 2 та п. 4) ---
        { 
            id: '128_vpo', 
            name: '128 — Допомога на проживання ВПО (2000 / 3000 грн)', 
            shortName: 'допомога ВПО (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 9 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_pregnancy', 
            name: '128 — Допомога у зв\'язку з вагітністю та пологами (декретні)', 
            shortName: 'декретні виплати (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'пп. 12 п. 4 Методики'
        },
        { 
            id: '128_birth_lump', 
            name: '128 — Одноразова частина допомоги при народженні дитини (10 320 грн)', 
            shortName: 'одноразово народження (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 2 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_adoption_lump', 
            name: '128 — Одноразова виплата при усиновленні дитини', 
            shortName: 'усиновлення одноразово (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 3 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_subsidy', 
            name: '128 — Житлова субсидія на оплату ЖКП', 
            shortName: 'житлова субсидія (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 10 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_baby_package', 
            name: '128 — Грошова компенсація «пакунок малюка»', 
            shortName: 'пакунок малюка (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 12 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_nanny', 
            name: '128 — Відшкодування послуги «муніципальна няня»', 
            shortName: 'муніципальна няня (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 13 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_care', 
            name: '128 — Компенсація за надання соціальних послуг з догляду', 
            shortName: 'компенсація за догляд (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 14 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_independence_day', 
            name: '128 — Разова грошова виплата до Дня Незалежності України', 
            shortName: 'до Дня Незалежності (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 15 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_alimony_temp', 
            name: '128 — Тимчасова держдопомога дітям при ухиленні батьків від аліментів', 
            shortName: 'тимчасова допомога на дітей (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 5 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_guardianship', 
            name: '128 — Допомога на дітей, над якими встановлено опіку чи піклування', 
            shortName: 'діти під опікою (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 7 пп. 3 п. 2 Методики'
        },
        { 
            id: '128_other_lump', 
            name: '128 — Інші одноразові виплати з державного або місцевих бюджетів', 
            shortName: 'інші одноразові допомоги (128)', 
            category: 'soc_excluded', 
            action: 'exclude', 
            normRef: 'абз. 8 пп. 3 п. 2 Методики'
        },

        // --- Інші доходи, що не враховуються (абз. 16 пп. 3 п. 2 та п. 4 Методики) ---
        { 
            id: '113', 
            name: '113 — Спадщина (подарунки за ставкою 0% від родичів 1-2 ступеня)', 
            shortName: 'спадщина (113)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики (ст. 174 ПКУ)',
            sourceName: ''
        },
        { 
            id: '153_197', 
            name: '153, 197 — Поворотна фінансова допомога / позика / кредит', 
            shortName: 'позика/допомога (153)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики (пп. 165.1.31 ПКУ)',
            sourceName: ''
        },
        { 
            id: '151', 
            name: '151 — Страхові виплати / страхове відшкодування', 
            shortName: 'страховка (151)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики (пп. 165.1.27 ПКУ)',
            sourceName: ''
        },
        { 
            id: '148_179', 
            name: '148, 179 — Продаж власної сільгосппродукції (городина, пп. 165.1.24 ПКУ)', 
            shortName: 'продаж городини (148)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики (пп. 165.1.24 ПКУ)',
            sourceName: ''
        },
        { 
            id: '131_205', 
            name: '131, 205 — Гуманітарна допомога / благодійні виплати (ООН тощо)', 
            shortName: 'гуманітарна допомога (131)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'пп. 7 п. 4 Методики',
            sourceName: ''
        },
        { 
            id: '156', 
            name: '156 — Вартість путівок на оздоровлення та лікування', 
            shortName: 'путівки (156)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики',
            sourceName: ''
        },
        { 
            id: '129', 
            name: '129 — Стипендія (неоподатковуваний розмір)', 
            shortName: 'стипендія (129)', 
            category: 'excluded', 
            action: 'exclude', 
            normRef: 'абз. 16 пп. 3 п. 2 Методики',
            sourceName: ''
        }
    ];

    // Нормативні константи для ФОП на ЄП (пп. 6 п. 3 Методики)
    const FOP_STANDARDS = {
        none: { group: 'none', monthly: 0, quarterly: 0, label: 'Не є ФОП / ФОП на загальній системі', source: '' },
        fop1: { group: 'fop1', monthly: 8647.00, quarterly: 25941.00, label: 'ФОП 1 група ЄП (1 прожитковий мінімум — 8 647,00 грн/міс)', source: 'дохід ФОП 1 групи ЄП' },
        fop2: { group: 'fop2', monthly: 17294.00, quarterly: 51882.00, label: 'ФОП 2 група ЄП (2 прожиткові мінімуми — 17 294,00 грн/міс)', source: 'дохід ФОП 2 групи ЄП' },
        fop3: { group: 'fop3', monthly: 25941.00, quarterly: 77823.00, label: 'ФОП 3 група ЄП (3 прожиткові мінімуми — 25 941,00 грн/міс)', source: 'дохід ФОП 3 групи ЄП' }
    };

    /**
     * Пошук конфігурації коду доходу за його id
     */
    function getCodeConfig(codeId) {
        return INCOME_CODES.find(c => c.id === codeId) || INCOME_CODES[0];
    }

    /**
     * Обрахунок окремого рядка доходу
     * @param {Object} rowData { codeId, rawAmount, periodicity, isTaxZero, isUnpaid, isFopActive }
     */
    function evaluateRow(rowData) {
        const config = getCodeConfig(rowData.codeId);
        const rawAmount = parseFloat(rowData.rawAmount !== undefined ? rowData.rawAmount : rowData.amount) || 0;
        const isFopEpActive = !!rowData.isFopActive;
        const isUnpaid = !!(rowData.isUnpaid || rowData.isDebt);

        let accountedAmount = 0;
        let badgeType = 'info'; // 'included', 'excluded', 'deduction'
        let badgeText = '';
        let sourceName = config.sourceName || '';
        let isExcluded = false;

        // 1. Аліменти сплачені (відрахування)
        if (config.action === 'deduct') {
            accountedAmount = -rawAmount;
            badgeType = 'deduction';
            badgeText = `🔴 Відрахування з доходу (-${rawAmount.toFixed(2)} грн) (пп. 1 п. 4 Методики № 1445/5)`;
            sourceName = '';
            return {
                rawAmount,
                accountedAmount,
                badgeType,
                badgeText,
                sourceName,
                isExcluded: false,
                config
            };
        }

        // 2. ФОП код 157 при активному режимі ФОП на ЄП (ігнорується за пп. 6 п. 3)
        if (config.id === '157' && isFopEpActive) {
            accountedAmount = 0;
            badgeType = 'excluded';
            badgeText = `⚪ Ігнорується (діє нормативна законодавча фіксація для ФОП на ЄП, пп. 6 п. 3 Методики)`;
            return {
                rawAmount,
                accountedAmount: 0,
                badgeType,
                badgeText,
                sourceName: '',
                isExcluded: true,
                config
            };
        }

        // 3. Заборгованість із виплати (фактично не виплачено, пп. 10 п. 4)
        if (config.allowDebt && isUnpaid) {
            accountedAmount = 0;
            badgeType = 'excluded';
            badgeText = `⚪ Не враховується (0,00 грн) (пп. 10 п. 4 Методики: нараховано, але не виплачено через заборгованість)`;
            return {
                rawAmount,
                accountedAmount: 0,
                badgeType,
                badgeText,
                sourceName: '',
                isExcluded: true,
                config
            };
        }

        // 4. Податок у 4ДФ = 0,00 грн (неоподатковуваний дохід за абз. 16 пп. 3 п. 2)
        if (config.allowTaxZero && rowData.isTaxZero) {
            accountedAmount = 0;
            badgeType = 'excluded';
            badgeText = `⚪ Не враховується (0,00 грн) (абз. 16 пп. 3 п. 2 Методики: ставка податку 0,00 грн)`;
            return {
                rawAmount,
                accountedAmount: 0,
                badgeType,
                badgeText,
                sourceName: '',
                isExcluded: true,
                config
            };
        }

        // 5. Неоподатковувані доходи та винятки соцвиплат (завжди не враховуються)
        if (config.action === 'exclude') {
            accountedAmount = 0;
            badgeType = 'excluded';
            badgeText = `⚪ Не враховується (0,00 грн) (${config.normRef || 'Методика № 1445/5'})`;
            return {
                rawAmount,
                accountedAmount: 0,
                badgeType,
                badgeText,
                sourceName: '',
                isExcluded: true,
                config
            };
        }

        // 6. Періодичний розподіл (пп. 4 п. 3 Методики)
        if (config.allowPeriodicity) {
            const monthsCount = parseInt(rowData.periodicity, 10) || 1;
            // Формула: сума ділиться на N місяців та множиться на 3 місяці розрахункового кварталу
            if (monthsCount > 1) {
                accountedAmount = (rawAmount / monthsCount) * 3;
                badgeType = 'included';
                badgeText = `🟢 Враховано: ${accountedAmount.toFixed(2)} грн (${rawAmount.toFixed(2)} грн / ${monthsCount} міс. × 3 міс. розрах. кварталу, пп. 4 п. 3 Методики)`;
            } else {
                accountedAmount = rawAmount;
                badgeType = 'included';
                badgeText = `🟢 Враховано: ${accountedAmount.toFixed(2)} грн`;
            }
            return {
                rawAmount,
                accountedAmount,
                badgeType,
                badgeText,
                sourceName,
                isExcluded: false,
                config
            };
        }

        // 7. Звичайний оподатковуваний дохід (100% суми)
        accountedAmount = rawAmount;
        badgeType = 'included';
        badgeText = `🟢 Враховано: ${accountedAmount.toFixed(2)} грн`;

        return {
            rawAmount,
            accountedAmount,
            badgeType,
            badgeText,
            sourceName,
            isExcluded: false,
            config
        };
    }

    /**
     * Повний обрахунок стану розширеного калькулятора
     * @param {Object} state { monthsData: [ [rows], [rows], [rows] ], fopStatus, isPensionFirst, pensionAmount }
     */
    function calculateFullState(state) {
        const monthsResults = [];
        const uniqueSourcesSet = new Set();
        let totalExcludedSum = 0;
        let totalRawSum = 0;
        let monthsAccountedSum = 0;

        const isFopEp = (state.fopStatus === 'fop1' || state.fopStatus === 'fop2' || state.fopStatus === 'fop3');
        const fopStandard = FOP_STANDARDS[state.fopStatus] || FOP_STANDARDS.none;

        // Помісячний аналіз
        (state.monthsData || [[], [], []]).forEach((monthRows, mIndex) => {
            let monthRaw = 0;
            let monthAccounted = 0;
            let monthExcluded = 0;
            const evaluatedRows = [];

            monthRows.forEach(row => {
                const evalRes = evaluateRow({
                    ...row,
                    isFopActive: isFopEp
                });
                evaluatedRows.push(evalRes);
                monthRaw += evalRes.rawAmount;

                if (evalRes.isExcluded || (evalRes.badgeType === 'excluded')) {
                    monthExcluded += evalRes.rawAmount;
                } else if (evalRes.badgeType === 'deduction') {
                    monthAccounted += evalRes.accountedAmount; // віднімається
                } else {
                    monthAccounted += evalRes.accountedAmount;
                    if (evalRes.sourceName) {
                        uniqueSourcesSet.add(evalRes.sourceName);
                    }
                }
            });

            monthsResults.push({
                monthIndex: mIndex,
                rawSum: monthRaw,
                accountedSum: monthAccounted,
                excludedSum: monthExcluded,
                rows: evaluatedRows
            });

            totalRawSum += monthRaw;
            totalExcludedSum += monthExcluded;
            monthsAccountedSum += monthAccounted;
        });

        let finalQuarterSum = 0;
        let finalAverageSum = 0;

        // Перевірка спеціальних режимів
        if (state.isPensionFirst) {
            // Вперше призначено пенсію (пп. 5 п. 3 Методики)
            const pAmount = parseFloat(state.pensionAmount) || 0;
            finalAverageSum = pAmount;
            finalQuarterSum = pAmount * 3;
            uniqueSourcesSet.clear();
            uniqueSourcesSet.add('пенсія');
        } else {
            // Звичайний або ФОП режим
            if (isFopEp) {
                finalQuarterSum = monthsAccountedSum + fopStandard.quarterly;
                finalAverageSum = finalQuarterSum / 3;
                uniqueSourcesSet.add(fopStandard.source);
            } else {
                finalQuarterSum = monthsAccountedSum;
                finalAverageSum = finalQuarterSum / 3;
            }
        }

        // Формування акуратного рядка джерел
        let sourcesList = Array.from(uniqueSourcesSet).filter(Boolean);
        let sourcesString = sourcesList.join(', ');

        return {
            monthsResults,
            totalRawSum,
            totalExcludedSum,
            monthsAccountedSum,
            finalQuarterSum,
            finalAverageSum,
            sourcesString,
            fopStandard,
            isPensionFirst: !!state.isPensionFirst,
            pensionAmount: parseFloat(state.pensionAmount) || 0
        };
    }

    // Експорт у глобальну область видимості
    window.IncomeCalculator = {
        INCOME_CODES,
        FOP_STANDARDS,
        getCodeConfig,
        evaluateRow,
        calculateFullState
    };
})();
