const { createClient } = supabase;

const sb = createClient(
    RAJ_CONFIG.supabaseUrl,
    RAJ_CONFIG.supabasePublishableKey
);

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const RPC_PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

let rows = [];
let uploads = [];
let activeUpload = null;
let charts = {};

let detailPage = 1;

let detailSort = {
    key: 'party',
    dir: 'asc'
};

let historySort = {
    key: 'outstanding_date',
    dir: 'desc'
};


/* =========================================================
   BASIC HELPERS
========================================================= */

const $ = selector =>
    document.querySelector(selector);


function num(value) {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return 0;
    }

    const n = Number(
        String(value)
            .replace(/,/g, '')
            .trim()
    );

    return Number.isFinite(n)
        ? n
        : 0;
}


function money(value) {

    return '₹ ' +
        Math.round(
            num(value)
        ).toLocaleString('en-IN');
}


function esc(value) {

    return String(value ?? '')
        .replace(
            /[&<>"']/g,
            char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char])
        );
}


function toast(message) {

    const element = $('#toast');

    if (!element) {
        return;
    }

    element.textContent = message;

    element.style.display = 'block';

    clearTimeout(toast.timer);

    toast.timer = setTimeout(
        () => {
            element.style.display = 'none';
        },
        3500
    );
}


/* =========================================================
   AUTH / RPC
========================================================= */

function authArgs(extra = {}) {

    return {

        p_session_token:
            localStorage.getItem(TOKEN) || '',

        p_device_id:
            localStorage.getItem(DEVICE) || '',

        ...extra
    };
}


async function rpc(
    functionName,
    args = {}
) {

    const {
        data,
        error
    } = await sb.rpc(
        functionName,
        authArgs(args)
    );

    if (error) {
        throw error;
    }

    return data;
}


/* =========================================================
   SESSION CHECK
========================================================= */

async function guard() {

    if (
        !localStorage.getItem(TOKEN)
    ) {

        location.href = 'index.html';

        return false;
    }

    try {

        const {
            data,
            error
        } = await sb.rpc(
            'raj_app_validate_session',
            authArgs()
        );

        if (
            error ||
            !data ||
            data.success !== true
        ) {

            location.href = 'index.html';

            return false;
        }

        return true;

    } catch (error) {

        console.error(
            'Session validation failed:',
            error
        );

        location.href = 'index.html';

        return false;
    }
}


/* =========================================================
   IMPORTANT:
   LOAD ALL ROWS FROM RPC

   Supabase may return maximum 1000 rows per request.
   This function keeps requesting:
   0-999
   1000-1999
   2000-2999
   ...
   until all rows are loaded.
========================================================= */

async function getAllOutstandingRows(uploadId) {

    const allRows = [];

    let from = 0;

    while (true) {

        const to =
            from +
            RPC_PAGE_SIZE -
            1;

        const {
            data,
            error
        } = await sb
            .rpc(
                'raj_outstanding_get_rows',
                authArgs({
                    p_upload_id: uploadId
                })
            )
            .range(
                from,
                to
            );

        if (error) {
            throw error;
        }

        const page =
            Array.isArray(data)
                ? data
                : [];

        allRows.push(
            ...page
        );

        console.log(
            `Outstanding loaded: ${allRows.length} rows`
        );

        /*
           Last page reached.
        */

        if (
            page.length <
            RPC_PAGE_SIZE
        ) {
            break;
        }

        from +=
            RPC_PAGE_SIZE;

        /*
           Safety guard.
        */

        if (
            from >
            100000
        ) {

            throw new Error(
                'Too many outstanding rows returned.'
            );
        }
    }

    console.log(
        'FINAL OUTSTANDING ROW COUNT:',
        allRows.length
    );

    return allRows;
}


/* =========================================================
   AGEING LOGIC

   Your CSV columns:
   15
   30
   45
   60
   75
   90
   120
   150

   are cumulative ageing values.

   Therefore:

   0-15      = Balance - >15 - PDC
   16-30     = >15 - >30
   31-45     = >30 - >45
   46-60     = >45 - >60
   61-75     = >60 - >75
   76-90     = >75 - >90
   91-120    = >90 - >120
   121-150   = >120 - >150
   >150      = CSV 150
========================================================= */

const bucketDefs = [

    [
        '0-15',
        'days_15'
    ],

    [
        '16-30',
        'days_30'
    ],

    [
        '31-45',
        'days_45'
    ],

    [
        '46-60',
        'days_60'
    ],

    [
        '61-75',
        'days_75'
    ],

    [
        '76-90',
        'days_90'
    ],

    [
        '91-120',
        'days_120'
    ],

    [
        '121-150',
        'days_150'
    ],

    [
        '>150',
        'over150'
    ],

    [
        'PDC',
        'pdc'
    ]
];


function bucket(row) {

    return {

        days_15:
            Math.max(
                0,
                num(row.balance) -
                num(row.days_15) -
                num(row.pdc)
            ),

        days_30:
            Math.max(
                0,
                num(row.days_15) -
                num(row.days_30)
            ),

        days_45:
            Math.max(
                0,
                num(row.days_30) -
                num(row.days_45)
            ),

        days_60:
            Math.max(
                0,
                num(row.days_45) -
                num(row.days_60)
            ),

        days_75:
            Math.max(
                0,
                num(row.days_60) -
                num(row.days_75)
            ),

        days_90:
            Math.max(
                0,
                num(row.days_75) -
                num(row.days_90)
            ),

        days_120:
            Math.max(
                0,
                num(row.days_90) -
                num(row.days_120)
            ),

        days_150:
            Math.max(
                0,
                num(row.days_120) -
                num(row.days_150)
            ),

        over150:
            Math.max(
                0,
                num(row.days_150)
            ),

        pdc:
            Math.max(
                0,
                num(row.pdc)
            )
    };
}


/* =========================================================
   FILTER DEFINITIONS

   GrpName IS INCLUDED
========================================================= */

const filterMap = [

    [
        'party',
        'Customer / Party'
    ],

    [
        'sm',
        'SM'
    ],

    [
        'grp_name',
        'GrpName'
    ],

    [
        'division',
        'Division'
    ],

    [
        'area',
        'Area'
    ],

    [
        'order_type',
        'OD / Order'
    ],

    [
        'city',
        'City'
    ],

    [
        'pincode',
        'Pincode'
    ]
];


/* =========================================================
   FILTER DATA
========================================================= */

function filtered() {

    return rows.filter(
        row =>

            filterMap.every(
                ([key]) => {

                    const select =
                        $(`#f_${key}`);

                    const selected =
                        select
                            ? select.value
                            : '';

                    return (
                        !selected ||
                        String(
                            row[key] ?? ''
                        ) === selected
                    );
                }
            )
    );
}


/* =========================================================
   CREATE FILTERS
========================================================= */

function makeFilters() {

    const container =
        $('#filters');

    if (!container) {
        return;
    }

    container.innerHTML = '';

    filterMap.forEach(
        ([key, label]) => {

            const values = [

                ...new Set(

                    rows
                        .map(
                            row =>
                                String(
                                    row[key] ?? ''
                                ).trim()
                        )
                        .filter(Boolean)
                )

            ].sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        undefined,
                        {
                            numeric: true,
                            sensitivity: 'base'
                        }
                    )
            );

            const wrapper =
                document.createElement(
                    'div'
                );

            wrapper.className =
                'field';

            wrapper.innerHTML = `

                <label>
                    ${esc(label)}
                </label>

                <select id="f_${key}">

                    <option value="">
                        All ${esc(label)}
                    </option>

                    ${
                        values
                            .map(
                                value => `

                                <option value="${esc(value)}">
                                    ${esc(value)}
                                </option>

                                `
                            )
                            .join('')
                    }

                </select>
            `;

            container.appendChild(
                wrapper
            );
        }
    );

    container
        .querySelectorAll(
            'select'
        )
        .forEach(
            select => {

                select.addEventListener(
                    'change',
                    () => {

                        detailPage = 1;

                        render();
                    }
                );
            }
        );
}


/* =========================================================
   TOTAL HELPERS
========================================================= */

function sum(
    data,
    key
) {

    return data.reduce(
        (
            total,
            row
        ) =>
            total +
            num(
                row[key]
            ),
        0
    );
}


function metrics(data) {

    const bucketSums = {};

    bucketDefs.forEach(
        ([label, key]) => {

            bucketSums[key] =
                data.reduce(
                    (
                        total,
                        row
                    ) =>

                        total +
                        bucket(row)[key],

                    0
                );
        }
    );

    return {

        total:
            sum(
                data,
                'balance'
            ),

        customers:
            new Set(
                data
                    .map(
                        row =>
                            String(
                                row.party ?? ''
                            ).trim()
                    )
                    .filter(Boolean)
            ).size,

        pdc:
            sum(
                data,
                'pdc'
            ),

        /*
           CSV 90 means amount OVER 90 DAYS.
        */

        over90:
            sum(
                data,
                'days_90'
            ),

        /*
           CSV 150 means amount OVER 150 DAYS.
        */

        over150:
            sum(
                data,
                'days_150'
            ),

        bs:
            bucketSums
    };
}


/* =========================================================
   CHART
========================================================= */

function draw(
    selector,
    type,
    labels,
    datasets,
    options = {}
) {

    if (
        charts[selector]
    ) {

        charts[selector]
            .destroy();
    }

    const canvas =
        $(selector);

    if (!canvas) {
        return;
    }

    charts[selector] =
        new Chart(
            canvas,
            {

                type,

                data: {

                    labels,

                    datasets
                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    interaction: {

                        mode:
                            'index',

                        intersect:
                            false
                    },

                    plugins: {

                        legend: {

                            display:
                                type ===
                                    'doughnut' ||
                                !!options.legend
                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    context => {

                                        const value =
                                            context.raw ??
                                            0;

                                        const prefix =
                                            context.dataset
                                                .label
                                                ? context.dataset
                                                    .label +
                                                  ': '
                                                : '';

                                        return (
                                            prefix +
                                            money(value)
                                        );
                                    }
                            }
                        }
                    },

                    scales:

                        type ===
                        'doughnut'

                            ? {}

                            : {

                                y: {

                                    beginAtZero:
                                        true,

                                    grid: {

                                        color:
                                            '#eef1f7'
                                    },

                                    ticks: {

                                        callback:
                                            value => {

                                                const n =
                                                    Number(
                                                        value
                                                    );

                                                if (
                                                    Math.abs(n) >=
                                                    10000000
                                                ) {

                                                    return (
                                                        n /
                                                        10000000
                                                    ).toFixed(
                                                        1
                                                    ) +
                                                    ' Cr';
                                                }

                                                if (
                                                    Math.abs(n) >=
                                                    100000
                                                ) {

                                                    return (
                                                        n /
                                                        100000
                                                    ).toFixed(
                                                        1
                                                    ) +
                                                    ' L';
                                                }

                                                if (
                                                    Math.abs(n) >=
                                                    1000
                                                ) {

                                                    return (
                                                        n /
                                                        1000
                                                    ).toFixed(
                                                        0
                                                    ) +
                                                    ' K';
                                                }

                                                return n;
                                            }
                                    }
                                },

                                x: {

                                    grid: {

                                        display:
                                            false
                                    }
                                }
                            }
                }
            }
        );
}


/* =========================================================
   SIMPLE TABLE
========================================================= */

function simpleTable(
    items,
    columns
) {

    return `

        <table>

            <thead>

                <tr>

                    ${
                        columns
                            .map(
                                column => `

                                <th class="${column.num ? 'num' : ''}">
                                    ${esc(column.label)}
                                </th>

                                `
                            )
                            .join('')
                    }

                </tr>

            </thead>

            <tbody>

                ${
                    items.length

                        ? items
                            .map(
                                (
                                    row,
                                    index
                                ) => `

                                <tr>

                                    ${
                                        columns
                                            .map(
                                                column => `

                                                <td class="${column.num ? 'num' : ''}">

                                                    ${
                                                        column.render

                                                            ? column.render(
                                                                row,
                                                                index
                                                            )

                                                            : esc(
                                                                row[
                                                                    column.key
                                                                ] ??
                                                                ''
                                                            )
                                                    }

                                                </td>

                                                `
                                            )
                                            .join('')
                                    }

                                </tr>

                                `
                            )
                            .join('')

                        : `

                        <tr>

                            <td
                                colspan="${columns.length}"
                                class="muted"
                            >
                                No data
                            </td>

                        </tr>

                        `
                }

            </tbody>

        </table>
    `;
}


/* =========================================================
   SORT HELPERS
========================================================= */

function compareValues(
    a,
    b,
    key
) {

    const aValue =
        a?.[key] ?? '';

    const bValue =
        b?.[key] ?? '';

    /*
       Known numeric fields
    */

    const numericFields =
        new Set([
            'balance',
            'days_15',
            'days_30',
            'days_45',
            'days_60',
            'days_75',
            'days_90',
            'days_120',
            'days_150',
            'pdc',
            'total_customers',
            'total_outstanding',
            'total_pdc'
        ]);

    if (
        numericFields.has(key)
    ) {

        return (
            num(aValue) -
            num(bValue)
        );
    }

    return String(aValue)
        .localeCompare(
            String(bValue),
            undefined,
            {
                numeric:
                    true,

                sensitivity:
                    'base'
            }
        );
}


function sortArrow(
    sort,
    key
) {

    if (
        sort.key !== key
    ) {
        return '';
    }

    return (
        sort.dir ===
        'asc'
    )
        ? ' ▲'
        : ' ▼';
}


/* =========================================================
   CUSTOMER DETAILS
========================================================= */

function renderDetails(data) {

    const container =
        $('#customerDetails');

    if (!container) {
        return;
    }

    const search =
        (
            $('#detailSearch')
                ?.value || ''
        )
            .trim()
            .toLowerCase();

    let list =
        [...data];

    if (search) {

        list =
            list.filter(
                row =>

                    [
                        row.party,
                        row.sm,
                        row.grp_name,
                        row.division,
                        row.area,
                        row.order_type,
                        row.city,
                        row.pincode
                    ].some(
                        value =>
                            String(
                                value ?? ''
                            )
                                .toLowerCase()
                                .includes(
                                    search
                                )
                    )
            );
    }

    list.sort(
        (a, b) => {

            const result =
                compareValues(
                    a,
                    b,
                    detailSort.key
                );

            return (
                detailSort.dir ===
                'asc'
            )
                ? result
                : -result;
        }
    );

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                list.length /
                DETAIL_PAGE_SIZE
            )
        );

    detailPage =
        Math.min(
            Math.max(
                1,
                detailPage
            ),
            totalPages
        );

    const start =
        (
            detailPage -
            1
        ) *
        DETAIL_PAGE_SIZE;

    const pageRows =
        list.slice(
            start,
            start +
            DETAIL_PAGE_SIZE
        );

    const columns = [

        [
            'party',
            'Party',
            false
        ],

        [
            'balance',
            'Balance',
            true
        ],

        [
            'days_15',
            '>15',
            true
        ],

        [
            'days_30',
            '>30',
            true
        ],

        [
            'days_45',
            '>45',
            true
        ],

        [
            'days_60',
            '>60',
            true
        ],

        [
            'days_75',
            '>75',
            true
        ],

        [
            'days_90',
            '>90',
            true
        ],

        [
            'days_120',
            '>120',
            true
        ],

        [
            'days_150',
            '>150',
            true
        ],

        [
            'pdc',
            'PDC',
            true
        ],

        [
            'sm',
            'SM',
            false
        ],

        [
            'grp_name',
            'GrpName',
            false
        ],

        [
            'division',
            'Division',
            false
        ],

        [
            'area',
            'Area',
            false
        ],

        [
            'order_type',
            'OD / Order',
            false
        ],

        [
            'city',
            'City',
            false
        ],

        [
            'pincode',
            'Pincode',
            false
        ]
    ];

    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    ${
                        columns
                            .map(
                                ([
                                    key,
                                    label,
                                    numeric
                                ]) => `

                                <th
                                    class="sortable ${numeric ? 'num' : ''}"
                                    data-detail-sort="${key}"
                                >

                                    ${esc(label)}
                                    ${sortArrow(
                                        detailSort,
                                        key
                                    )}

                                </th>

                                `
                            )
                            .join('')
                    }

                </tr>

            </thead>

            <tbody>

                ${
                    pageRows.length

                        ? pageRows
                            .map(
                                row => `

                                <tr>

                                    ${
                                        columns
                                            .map(
                                                ([
                                                    key,
                                                    label,
                                                    numeric
                                                ]) => `

                                                <td class="${numeric ? 'num' : ''}">

                                                    ${
                                                        numeric

                                                            ? money(
                                                                row[key]
                                                            )

                                                            : esc(
                                                                row[key] ??
                                                                ''
                                                            )
                                                    }

                                                </td>

                                                `
                                            )
                                            .join('')
                                    }

                                </tr>

                                `
                            )
                            .join('')

                        : `

                        <tr>

                            <td
                                colspan="${columns.length}"
                                class="muted"
                            >
                                No matching data
                            </td>

                        </tr>

                        `
                }

            </tbody>

        </table>
    `;

    if (
        $('#detailCount')
    ) {

        $('#detailCount')
            .textContent =

            `${list.length.toLocaleString('en-IN')} rows`;
    }

    if (
        $('#pageInfo')
    ) {

        $('#pageInfo')
            .textContent =

            `Page ${detailPage} of ${totalPages}`;
    }

    if (
        $('#prevPage')
    ) {

        $('#prevPage')
            .disabled =
                detailPage <= 1;
    }

    if (
        $('#nextPage')
    ) {

        $('#nextPage')
            .disabled =
                detailPage >=
                totalPages;
    }

    document
        .querySelectorAll(
            '[data-detail-sort]'
        )
        .forEach(
            heading => {

                heading.onclick =
                    () => {

                        const key =
                            heading.dataset
                                .detailSort;

                        if (
                            detailSort.key ===
                            key
                        ) {

                            detailSort.dir =
                                detailSort.dir ===
                                'asc'
                                    ? 'desc'
                                    : 'asc';

                        } else {

                            detailSort = {

                                key,

                                dir:
                                    'asc'
                            };
                        }

                        detailPage = 1;

                        renderDetails(
                            filtered()
                        );
                    };
            }
        );
}


/* =========================================================
   MAIN DASHBOARD RENDER
========================================================= */

function render() {

    const data =
        filtered();

    const m =
        metrics(data);

    /* ================= KPI ================= */

    const kpis =
        $('#kpis');

    if (kpis) {

        kpis.innerHTML = [

            [
                'Total Outstanding',
                money(
                    m.total
                )
            ],

            [
                'Total Customers',
                m.customers
                    .toLocaleString(
                        'en-IN'
                    )
            ],

            [
                'PDC Amount',
                money(
                    m.pdc
                )
            ],

            [
                'Over 90 Days',
                money(
                    m.over90
                )
            ],

            [
                'Over 150 Days',
                money(
                    m.over150
                )
            ]

        ]
            .map(
                ([
                    label,
                    value
                ]) => `

                <article class="kpi">

                    <span>
                        ${label}
                    </span>

                    <strong>
                        ${value}
                    </strong>

                    <small>
                        Current snapshot
                    </small>

                </article>

                `
            )
            .join('');
    }


    /* ================= AGEING ================= */

    const ageingLabels =
        bucketDefs.map(
            item =>
                item[0]
        );

    const ageingValues =
        bucketDefs.map(
            item =>
                m.bs[
                    item[1]
                ]
        );

    draw(
        '#ageChart',
        'bar',
        ageingLabels,
        [
            {
                label:
                    'Amount',

                data:
                    ageingValues,

                borderRadius:
                    6
            }
        ]
    );


    /* ================= DONUT ================= */

    draw(
        '#donutChart',
        'doughnut',
        ageingLabels,
        [
            {
                label:
                    'Amount',

                data:
                    ageingValues,

                borderWidth:
                    0
            }
        ],
        {
            legend:
                true
        }
    );


    /* ================= AMOUNT RANGE ================= */

    const ranges = [

        {
            label:
                '< 1,000',

            min:
                0,

            max:
                1000
        },

        {
            label:
                '1,000-5,000',

            min:
                1000,

            max:
                5000
        },

        {
            label:
                '5,000-10,000',

            min:
                5000,

            max:
                10000
        },

        {
            label:
                '10,000-50,000',

            min:
                10000,

            max:
                50000
        },

        {
            label:
                '50,000-1,00,000',

            min:
                50000,

            max:
                100000
        },

        {
            label:
                '>1,00,000',

            min:
                100000,

            max:
                Infinity
        }
    ];

    draw(
        '#rangeChart',
        'bar',
        ranges.map(
            range =>
                range.label
        ),
        [
            {
                label:
                    'Customers',

                data:
                    ranges.map(
                        range =>

                            data.filter(
                                row => {

                                    const balance =
                                        num(
                                            row.balance
                                        );

                                    return (
                                        balance >=
                                            range.min
                                        &&
                                        balance <
                                            range.max
                                    );
                                }
                            ).length
                    ),

                borderRadius:
                    6
            }
        ]
    );


    /* ================= TOP CUSTOMERS ================= */

    const topCustomers =
        [...data]
            .sort(
                (a, b) =>
                    num(
                        b.balance
                    ) -
                    num(
                        a.balance
                    )
            )
            .slice(
                0,
                5
            );

    if (
        $('#topCustomers')
    ) {

        $('#topCustomers')
            .innerHTML =
                simpleTable(
                    topCustomers,
                    [

                        {
                            label:
                                '#',

                            render:
                                (
                                    row,
                                    index
                                ) =>
                                    index +
                                    1
                        },

                        {
                            label:
                                'Party Name',

                            key:
                                'party'
                        },

                        {
                            label:
                                'Balance',

                            num:
                                true,

                            render:
                                row =>
                                    money(
                                        row.balance
                                    )
                        }
                    ]
                );
    }


    /* ================= TOP >150 ================= */

    const overdueCustomers =
        [...data]
            .filter(
                row =>
                    num(
                        row.days_150
                    ) > 0
            )
            .sort(
                (a, b) =>
                    num(
                        b.days_150
                    ) -
                    num(
                        a.days_150
                    )
            )
            .slice(
                0,
                5
            );

    if (
        $('#overdueCustomers')
    ) {

        $('#overdueCustomers')
            .innerHTML =
                simpleTable(
                    overdueCustomers,
                    [

                        {
                            label:
                                '#',

                            render:
                                (
                                    row,
                                    index
                                ) =>
                                    index +
                                    1
                        },

                        {
                            label:
                                'Party Name',

                            key:
                                'party'
                        },

                        {
                            label:
                                '>150 Days',

                            num:
                                true,

                            render:
                                row =>
                                    money(
                                        row.days_150
                                    )
                        },

                        {
                            label:
                                'Balance',

                            num:
                                true,

                            render:
                                row =>
                                    money(
                                        row.balance
                                    )
                        }
                    ]
                );
    }


    /* ================= DETAILS ================= */

    renderDetails(
        data
    );


    /* ================= COMPARISON ================= */

    renderCompare(
        m
    );
}


/* =========================================================
   SNAPSHOT COMPARISON
========================================================= */

async function renderCompare(
    currentMetrics
) {

    if (
        !activeUpload
    ) {
        return;
    }

    const currentIndex =
        uploads.findIndex(
            upload =>
                upload.id ===
                activeUpload.id
        );

    const previousUpload =
        currentIndex >= 0
            ? uploads[
                currentIndex +
                1
            ]
            : null;

    if (
        !previousUpload
    ) {

        if (
            $('#summaryCompare')
        ) {

            $('#summaryCompare')
                .innerHTML = `

                <span class="muted">
                    Upload another older snapshot to compare.
                </span>
            `;
        }

        draw(
            '#compareChart',
            'bar',
            [],
            []
        );

        return;
    }

    try {

        /*
           IMPORTANT:
           Previous snapshot also loads ALL rows,
           not only first 1000.
        */

        const previousRows =
            await getAllOutstandingRows(
                previousUpload.id
            );

        const previousMetrics =
            metrics(
                previousRows
            );

        const labels =
            bucketDefs.map(
                item =>
                    item[0]
            );

        draw(
            '#compareChart',
            'bar',
            labels,
            [

                {
                    label:
                        previousUpload
                            .outstanding_date,

                    data:
                        bucketDefs.map(
                            item =>
                                previousMetrics.bs[
                                    item[1]
                                ]
                        )
                },

                {
                    label:
                        activeUpload
                            .outstanding_date,

                    data:
                        bucketDefs.map(
                            item =>
                                currentMetrics.bs[
                                    item[1]
                                ]
                        )
                }

            ],
            {
                legend:
                    true
            }
        );

        const comparisonRows = [

            {
                metric:
                    'Total Outstanding',

                previous:
                    previousMetrics.total,

                current:
                    currentMetrics.total,

                customer:
                    false
            },

            {
                metric:
                    'Total Customers',

                previous:
                    previousMetrics.customers,

                current:
                    currentMetrics.customers,

                customer:
                    true
            },

            {
                metric:
                    'PDC Amount',

                previous:
                    previousMetrics.pdc,

                current:
                    currentMetrics.pdc,

                customer:
                    false
            },

            {
                metric:
                    'Over 90 Days',

                previous:
                    previousMetrics.over90,

                current:
                    currentMetrics.over90,

                customer:
                    false
            },

            {
                metric:
                    'Over 150 Days',

                previous:
                    previousMetrics.over150,

                current:
                    currentMetrics.over150,

                customer:
                    false
            }
        ];

        if (
            $('#summaryCompare')
        ) {

            $('#summaryCompare')
                .innerHTML =
                    simpleTable(
                        comparisonRows,
                        [

                            {
                                label:
                                    'Metric',

                                key:
                                    'metric'
                            },

                            {
                                label:
                                    previousUpload
                                        .outstanding_date,

                                num:
                                    true,

                                render:
                                    row =>

                                        row.customer

                                            ? Number(
                                                row.previous
                                            )
                                                .toLocaleString(
                                                    'en-IN'
                                                )

                                            : money(
                                                row.previous
                                            )
                            },

                            {
                                label:
                                    activeUpload
                                        .outstanding_date,

                                num:
                                    true,

                                render:
                                    row =>

                                        row.customer

                                            ? Number(
                                                row.current
                                            )
                                                .toLocaleString(
                                                    'en-IN'
                                                )

                                            : money(
                                                row.current
                                            )
                            }
                        ]
                    );
        }

    } catch (error) {

        console.error(
            'Comparison error:',
            error
        );

        if (
            $('#summaryCompare')
        ) {

            $('#summaryCompare')
                .innerHTML = `

                <span class="muted">
                    Comparison unavailable.
                </span>
            `;
        }
    }
}


/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {

    const container =
        $('#history');

    if (!container) {
        return;
    }

    const list =
        [...uploads];

    list.sort(
        (a, b) => {

            const result =
                compareValues(
                    a,
                    b,
                    historySort.key
                );

            return (
                historySort.dir ===
                'asc'
            )
                ? result
                : -result;
        }
    );

    const columns = [

        [
            'outstanding_date',
            'Date',
            false
        ],

        [
            'uploaded_at',
            'Uploaded On',
            false
        ],

        [
            'uploaded_by',
            'By',
            false
        ],

        [
            'total_customers',
            'Customers',
            true
        ],

        [
            'total_outstanding',
            'Outstanding',
            true
        ]
    ];

    container.innerHTML = `

        <table>

            <thead>

                <tr>

                    ${
                        columns
                            .map(
                                ([
                                    key,
                                    label,
                                    numeric
                                ]) => `

                                <th
                                    class="sortable ${numeric ? 'num' : ''}"
                                    data-history-sort="${key}"
                                >

                                    ${esc(label)}
                                    ${sortArrow(
                                        historySort,
                                        key
                                    )}

                                </th>

                                `
                            )
                            .join('')
                    }

                </tr>

            </thead>

            <tbody>

                ${
                    list.length

                        ? list
                            .slice(
                                0,
                                50
                            )
                            .map(
                                row => `

                                <tr>

                                    <td>
                                        ${esc(
                                            row.outstanding_date
                                        )}
                                    </td>

                                    <td>

                                        ${
                                            row.uploaded_at

                                                ? esc(
                                                    new Date(
                                                        row.uploaded_at
                                                    )
                                                        .toLocaleString(
                                                            'en-IN'
                                                        )
                                                )

                                                : ''
                                        }

                                    </td>

                                    <td>
                                        ${esc(
                                            row.uploaded_by
                                        )}
                                    </td>

                                    <td class="num">

                                        ${
                                            num(
                                                row.total_customers
                                            )
                                                .toLocaleString(
                                                    'en-IN'
                                                )
                                        }

                                    </td>

                                    <td class="num">

                                        ${
                                            money(
                                                row.total_outstanding
                                            )
                                        }

                                    </td>

                                </tr>

                                `
                            )
                            .join('')

                        : `

                        <tr>

                            <td
                                colspan="5"
                                class="muted"
                            >
                                No snapshots
                            </td>

                        </tr>

                        `
                }

            </tbody>

        </table>
    `;

    document
        .querySelectorAll(
            '[data-history-sort]'
        )
        .forEach(
            heading => {

                heading.onclick =
                    () => {

                        const key =
                            heading.dataset
                                .historySort;

                        if (
                            historySort.key ===
                            key
                        ) {

                            historySort.dir =
                                historySort.dir ===
                                'asc'
                                    ? 'desc'
                                    : 'asc';

                        } else {

                            historySort = {

                                key,

                                dir:
                                    'asc'
                            };
                        }

                        renderHistory();
                    };
            }
        );
}


/* =========================================================
   LOAD SNAPSHOTS + CURRENT DATA
========================================================= */

async function load(
    preferredId = null
) {

    toast(
        'Loading outstanding data...'
    );

    uploads =
        await rpc(
            'raj_outstanding_list_uploads'
        ) || [];

    /*
       Latest outstanding date first.
    */

    uploads.sort(
        (a, b) => {

            const dateCompare =
                String(
                    b.outstanding_date ??
                    ''
                )
                    .localeCompare(
                        String(
                            a.outstanding_date ??
                            ''
                        )
                    );

            if (
                dateCompare !==
                0
            ) {
                return dateCompare;
            }

            return String(
                b.uploaded_at ??
                ''
            )
                .localeCompare(
                    String(
                        a.uploaded_at ??
                        ''
                    )
                );
        }
    );

    const snapshotSelect =
        $('#snapshotSelect');

    if (
        snapshotSelect
    ) {

        snapshotSelect.innerHTML =

            uploads.length

                ? uploads
                    .map(
                        upload => `

                        <option value="${esc(upload.id)}">
                            ${esc(upload.outstanding_date)}
                        </option>

                        `
                    )
                    .join('')

                : `

                <option value="">
                    No snapshot
                </option>
                `;
    }

    activeUpload =

        uploads.find(
            upload =>
                upload.id ===
                preferredId
        )

        ||

        uploads[0]

        ||

        null;

    if (
        !activeUpload
    ) {

        rows = [];

        makeFilters();

        render();

        renderHistory();

        toast(
            'No outstanding snapshot found.'
        );

        return;
    }

    if (
        snapshotSelect
    ) {

        snapshotSelect.value =
            activeUpload.id;
    }

    /*
       IMPORTANT FIX:
       Load every row, not first 1000.
    */

    rows =
        await getAllOutstandingRows(
            activeUpload.id
        );

    console.log(
        'Dashboard total rows:',
        rows.length
    );

    makeFilters();

    detailPage = 1;

    render();

    renderHistory();

    toast(
        `${rows.length.toLocaleString('en-IN')} outstanding rows loaded`
    );
}


/* =========================================================
   SWITCH SNAPSHOT
========================================================= */

async function switchSnapshot() {

    try {

        const selectedId =
            $('#snapshotSelect')
                ?.value;

        activeUpload =
            uploads.find(
                upload =>
                    upload.id ===
                    selectedId
            );

        if (
            !activeUpload
        ) {
            return;
        }

        toast(
            'Loading selected snapshot...'
        );

        /*
           IMPORTANT FIX:
           Again load ALL rows.
        */

        rows =
            await getAllOutstandingRows(
                activeUpload.id
            );

        makeFilters();

        detailPage = 1;

        render();

        toast(
            `${rows.length.toLocaleString('en-IN')} rows loaded`
        );

    } catch (error) {

        console.error(
            error
        );

        toast(
            'Snapshot load failed: ' +
            error.message
        );
    }
}


/* =========================================================
   CSV HEADER NORMALIZER
========================================================= */

function normalizeHeader(
    header
) {

    return String(
        header ??
        ''
    )
        .replace(
            /^\uFEFF/,
            ''
        )
        .trim();
}


/* =========================================================
   CSV UPLOAD
========================================================= */

async function upload(file) {

    if (!file) {
        return;
    }

    if (
        !/\.csv$/i.test(
            file.name
        )
    ) {

        toast(
            'Please select a CSV file.'
        );

        if (
            $('#fileInput')
        ) {

            $('#fileInput')
                .value = '';
        }

        return;
    }

    const date =
        prompt(
            'Outstanding date (YYYY-MM-DD):',
            new Date()
                .toISOString()
                .slice(
                    0,
                    10
                )
        );

    if (!date) {

        if (
            $('#fileInput')
        ) {

            $('#fileInput')
                .value = '';
        }

        return;
    }

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(date)
    ) {

        toast(
            'Date format must be YYYY-MM-DD.'
        );

        if (
            $('#fileInput')
        ) {

            $('#fileInput')
                .value = '';
        }

        return;
    }

    toast(
        'Reading CSV file...'
    );

    Papa.parse(
        file,
        {

            header:
                true,

            skipEmptyLines:
                'greedy',

            transformHeader:
                normalizeHeader,

            complete:
                async result => {

                    try {

                        if (
                            result.errors &&
                            result.errors.length
                        ) {

                            console.warn(
                                'CSV warnings:',
                                result.errors
                            );
                        }

                        const requiredColumns = [

                            'Party',
                            'Balance',
                            '15',
                            '30',
                            '45',
                            '60',
                            '75',
                            '90',
                            '120',
                            '150',
                            'PDC',
                            'SM',
                            'GrpName',
                            'Division',
                            'Area',
                            'Order',
                            'City',
                            'Pincode'
                        ];

                        const actualColumns =
                            result.meta
                                ?.fields ||
                            [];

                        const missing =
                            requiredColumns
                                .filter(
                                    column =>
                                        !actualColumns
                                            .includes(
                                                column
                                            )
                                );

                        if (
                            missing.length
                        ) {

                            throw new Error(
                                'Missing CSV columns: ' +
                                missing.join(
                                    ', '
                                )
                            );
                        }

                        const mapped =
                            result.data

                                .filter(
                                    row =>

                                        String(
                                            row.Party ??
                                            ''
                                        ).trim()

                                        ||

                                        num(
                                            row.Balance
                                        ) !== 0
                                )

                                .map(
                                    row => ({

                                        party:
                                            String(
                                                row.Party ??
                                                ''
                                            ).trim(),

                                        balance:
                                            num(
                                                row.Balance
                                            ),

                                        days_15:
                                            num(
                                                row['15']
                                            ),

                                        days_30:
                                            num(
                                                row['30']
                                            ),

                                        days_45:
                                            num(
                                                row['45']
                                            ),

                                        days_60:
                                            num(
                                                row['60']
                                            ),

                                        days_75:
                                            num(
                                                row['75']
                                            ),

                                        days_90:
                                            num(
                                                row['90']
                                            ),

                                        days_120:
                                            num(
                                                row['120']
                                            ),

                                        days_150:
                                            num(
                                                row['150']
                                            ),

                                        pdc:
                                            num(
                                                row.PDC
                                            ),

                                        sm:
                                            String(
                                                row.SM ??
                                                ''
                                            ).trim(),

                                        grp_name:
                                            String(
                                                row.GrpName ??
                                                ''
                                            ).trim(),

                                        division:
                                            String(
                                                row.Division ??
                                                ''
                                            ).trim(),

                                        area:
                                            String(
                                                row.Area ??
                                                ''
                                            ).trim(),

                                        order_type:
                                            String(
                                                row.Order ??
                                                ''
                                            ).trim(),

                                        city:
                                            String(
                                                row.City ??
                                                ''
                                            ).trim(),

                                        pincode:
                                            String(
                                                row.Pincode ??
                                                ''
                                            ).trim()
                                    })
                                );

                        if (
                            !mapped.length
                        ) {

                            throw new Error(
                                'CSV contains no usable rows.'
                            );
                        }

                        const user =
                            JSON.parse(
                                localStorage.getItem(
                                    USER
                                ) ||
                                '{}'
                            );

                        toast(
                            `Uploading ${mapped.length.toLocaleString('en-IN')} rows...`
                        );

                        await rpc(
                            'raj_outstanding_upload_json',
                            {

                                p_outstanding_date:
                                    date,

                                p_file_name:
                                    file.name,

                                p_uploaded_by:

                                    user.name

                                    ||

                                    user.username

                                    ||

                                    user.email

                                    ||

                                    'User',

                                p_rows:
                                    mapped
                            }
                        );

                        if (
                            $('#fileInput')
                        ) {

                            $('#fileInput')
                                .value = '';
                        }

                        toast(
                            `Upload successful: ${mapped.length.toLocaleString('en-IN')} rows`
                        );

                        await load();

                    } catch (error) {

                        console.error(
                            'Upload error:',
                            error
                        );

                        if (
                            $('#fileInput')
                        ) {

                            $('#fileInput')
                                .value = '';
                        }

                        toast(
                            'Upload failed: ' +
                            error.message
                        );
                    }
                },

            error:
                error => {

                    console.error(
                        'CSV read error:',
                        error
                    );

                    if (
                        $('#fileInput')
                    ) {

                        $('#fileInput')
                            .value = '';
                    }

                    toast(
                        'CSV read failed: ' +
                        error.message
                    );
                }
        }
    );
}


/* =========================================================
   PAGE START
========================================================= */

(async () => {

    /*
       LOGIN CHECK
    */

    if (
        !await guard()
    ) {
        return;
    }


    /* =====================================================
       UPLOAD BUTTON
    ===================================================== */

    if (
        $('#uploadBtn')
    ) {

        $('#uploadBtn')
            .onclick =
                () => {

                    $('#fileInput')
                        ?.click();
                };
    }


    if (
        $('#uploadBtn2')
    ) {

        $('#uploadBtn2')
            .onclick =
                () => {

                    $('#fileInput')
                        ?.click();
                };
    }


    /* =====================================================
       FILE SELECT
    ===================================================== */

    if (
        $('#fileInput')
    ) {

        $('#fileInput')
            .onchange =
                event => {

                    const file =
                        event.target
                            .files?.[0];

                    upload(
                        file
                    );
                };
    }


    /* =====================================================
       SNAPSHOT
    ===================================================== */

    if (
        $('#snapshotSelect')
    ) {

        $('#snapshotSelect')
            .onchange =
                switchSnapshot;
    }


    /* =====================================================
       RESET FILTERS
    ===================================================== */

    if (
        $('#resetBtn')
    ) {

        $('#resetBtn')
            .onclick =
                () => {

                    $('#filters')
                        ?.querySelectorAll(
                            'select'
                        )
                        .forEach(
                            select => {

                                select.value =
                                    '';
                            }
                        );

                    if (
                        $('#detailSearch')
                    ) {

                        $('#detailSearch')
                            .value = '';
                    }

                    detailPage = 1;

                    render();
                };
    }


    /* =====================================================
       DETAIL SEARCH
    ===================================================== */

    if (
        $('#detailSearch')
    ) {

        $('#detailSearch')
            .oninput =
                () => {

                    detailPage = 1;

                    renderDetails(
                        filtered()
                    );
                };
    }


    /* =====================================================
       PREVIOUS PAGE
    ===================================================== */

    if (
        $('#prevPage')
    ) {

        $('#prevPage')
            .onclick =
                () => {

                    if (
                        detailPage >
                        1
                    ) {

                        detailPage--;

                        renderDetails(
                            filtered()
                        );
                    }
                };
    }


    /* =====================================================
       NEXT PAGE
    ===================================================== */

    if (
        $('#nextPage')
    ) {

        $('#nextPage')
            .onclick =
                () => {

                    detailPage++;

                    renderDetails(
                        filtered()
                    );
                };
    }


    /* =====================================================
       REFRESH
    ===================================================== */

    if (
        $('#refreshBtn')
    ) {

        $('#refreshBtn')
            .onclick =
                () => {

                    load(
                        activeUpload
                            ?.id ||
                        null
                    );
                };
    }


    /* =====================================================
       VIEW DATA LOG
    ===================================================== */

    if (
        $('#logsBtn')
    ) {

        $('#logsBtn')
            .onclick =
                () => {

                    $('#customerDetails')
                        ?.scrollIntoView(
                            {
                                behavior:
                                    'smooth',

                                block:
                                    'start'
                            }
                        );
                };
    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    if (
        $('#logoutBtn')
    ) {

        $('#logoutBtn')
            .onclick =
                () => {

                    localStorage
                        .removeItem(
                            TOKEN
                        );

                    localStorage
                        .removeItem(
                            USER
                        );

                    location.href =
                        'index.html';
                };
    }


    /* =====================================================
       INITIAL LOAD
    ===================================================== */

    await load();

})().catch(
    error => {

        console.error(
            'Outstanding dashboard error:',
            error
        );

        toast(
            'Dashboard error: ' +
            error.message
        );
    }
);
