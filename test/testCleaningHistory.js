const assert = require('node:assert/strict');
const cleaningHistory = require('../build/lib/cleaningHistory');

describe('Generic cleaning-history runtime', () => {
    it('parses modern and legacy cleaning summaries', () => {
        /** @type {import('../src/types/cleaningHistory').CleaningSummaryResponse[]} */
        const responses = [
            {
                result: {
                    clean_time: 25075,
                    clean_area: 376442500,
                    clean_count: 10,
                    records: [1617553319, 1617470350],
                },
            },
            { result: [25075, 376442500, 10, [1617553319, 1617470350]] },
        ];

        const expected = {
            clean_time: 25075,
            total_area: 376442500,
            num_cleanups: 10,
            cleaning_record_ids: [1617553319, 1617470350],
        };
        for (const response of responses) {
            assert.deepEqual(cleaningHistory.parseCleaningSummary(response), expected);
        }
    });

    it('parses modern, legacy, empty, and missing cleaning records', () => {
        /** @type {Array<import('../src/types/cleaningHistory').CleaningRecordsResponse | null>} */
        const responses = [
            {
                result: [
                    {
                        begin: 1617121021,
                        end: 1617135716,
                        duration: 4217,
                        area: 57002500,
                        error: 0,
                        complete: 1,
                        start_type: 2,
                        clean_type: 1,
                    },
                    [1617121021, 1617135716, 4217, 57002500, 3, 0, 1, 2],
                ],
            },
            { result: [] },
            {},
            null,
        ];

        assert.deepEqual(cleaningHistory.parseCleaningRecords(responses[0]), [
            {
                start_time: 1617121021,
                end_time: 1617135716,
                duration: 4217,
                area: 57002500,
                errors: 0,
                completed: true,
                start_type: 2,
                clean_type: 1,
            },
            {
                start_time: 1617121021,
                end_time: 1617135716,
                duration: 4217,
                area: 57002500,
                errors: 3,
                completed: false,
                start_type: 1,
                clean_type: 2,
            },
        ]);
        assert.deepEqual(cleaningHistory.parseCleaningRecords(responses[1]), []);
        assert.equal(cleaningHistory.parseCleaningRecords(responses[2]), null);
        assert.equal(cleaningHistory.parseCleaningRecords(responses[3]), null);
    });

    it('compares shallow ordered properties', () => {
        const cases = [
            [[1, 2, 3], [1, 2, 3]],
            [[1, 2, 3], [1, 2, 4]],
            [[1, 2], [1, 2, 3]],
            [{ first: 1, second: 2 }, { first: 1, second: 2 }],
            [{ first: { nested: true } }, { first: { nested: true } }],
        ];

        assert.deepEqual(
            cases.map(([first, second]) => cleaningHistory.isEquivalent(first, second)),
            [true, false, false, true, false],
        );
    });

    it('creates the complete HTML history representation', () => {
        const records = [
            {
                Datum: '1.8',
                Start: '09:05',
                Saugzeit: '42 min',
                Fläche: '57.01 m²',
                Error: 0,
                Ende: true,
            },
            {
                Datum: '2.8',
                Start: '18:30',
                Saugzeit: '12 min',
                Fläche: '12.34 m²',
                Error: 3,
                Ende: false,
            },
        ];

        const typed = cleaningHistory.createHtmlTable(records);

        assert.match(typed, /^<table><colgroup>/);
        assert.equal((typed.match(/<tr>/g) || []).length, 3);
        assert.match(typed, /<td ALIGN="CENTER">false<\/td><\/tr><\/table>$/);
    });
});
