const { createClient } = supabase;

const sb = createClient(
    RAJ_CONFIG.supabaseUrl,
    RAJ_CONFIG.supabasePublishableKey
);

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

let rows = [];
let uploads = [];
let activeUpload = null;
let charts = {};

let detailSort = {
    key: 'party',
    dir: 'asc'
};

let historySort = {
    key: 'outstanding_date',
    dir: 'desc'
};

let detailPage = 1;

const PAGE_SIZE = 50;

const $ = s =>
    document.querySelector(s);


const num = v => {

    const n = Number(
        String(v ?? '')
            .replace(/,/g, '')
            .trim()
    );

    return Number.isFinite(n)
        ? n
        : 0;
};


const money = n =>
    '₹ ' +
    Math.round(
        num(n)
    ).toLocaleString('en-IN');


const esc = s =>
    String(s ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );


/* =====================================
   TOAST
===================================== */

function toast(message) {

    const e = $('#toast');

    if (!e) return;

    e.textContent = message;

    e.style.display = 'block';

    clearTimeout(toast._t);

    toast._t = setTimeout(
        () => {
            e.style.display = 'none';
        },
        3200
    );
}


/* =====================================
   AUTH / SUPABASE RPC
===================================== */

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
    name,
    args = {}
) {

    const {
        data,
        error
    } = await sb.rpc(
        name,
        authArgs(args)
    );

    if (error) {
        throw error;
    }

    return data;
}


async function guard() {

    if (
        !localStorage.getItem(TOKEN)
    ) {

        location.href =
            'index.html';

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

            location.href =
                'index.html';

            return false;
        }


        return true;


    } catch (e) {

        location.href =
            'index.html';

        return false;
    }
}


/* =====================================
   AGEING CALCULATION

   CSV columns:
   15, 30, 45, 60...
   are cumulative overdue amounts.

   Example:
   16-30 = 15 - 30
   31-45 = 30 - 45
   >150  = 150
===================================== */

const bucketDefs = [

    ['0-15', 'days_15'],

    ['16-30', 'days_30'],

    ['31-45', 'days_45'],

    ['46-60', 'days_60'],

    ['61-75', 'days_75'],

    ['76-90', 'days_90'],

    ['91-120', 'days_120'],

    ['121-150', 'days_150'],

    ['>150', 'over150'],

    ['PDC', 'pdc']
];


function bucket(r) {

    return {

        days_15:
            Math.max(
                0,
                num(r.balance) -
                num(r.days_15) -
                num(r.pdc)
            ),

        days_30:
            Math.max(
                0,
                num(r.days_15) -
                num(r.days_30)
            ),

        days_45:
            Math.max(
                0,
                num(r.days_30) -
                num(r.days_45)
            ),

        days_60:
            Math.max(
                0,
                num(r.days_45) -
                num(r.days_60)
            ),

        days_75:
            Math.max(
                0,
                num(r.days_60) -
                num(r.days_75)
            ),

        days_90:
            Math.max(
                0,
                num(r.days_75) -
                num(r.days_90)
            ),

        days_120:
            Math.max(
                0,
                num(r.days_90) -
                num(r.days_120)
            ),

        days_150:
            Math.max(
                0,
                num(r.days_120) -
                num(r.days_150)
            ),

        over150:
            Math.max(
                0,
                num(r.days_150)
            ),

        pdc:
            Math.max(
                0,
                num(r.pdc)
            )
    };
}


/* =====================================
   FILTERS

   GrpName INCLUDED
===================================== */

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


function filtered() {

    return rows.filter(
        r =>

            filterMap.every(
                ([key]) => {

                    const v =
                        $(`#f_${key}`)
                            ?.value || '';

                    return (
                        !v ||
                        String(
                            r[key] ?? ''
                        ) === v
                    );
                }
            )
    );
}


function makeFilters() {

    const box =
        $('#filters');

    if (!box) return;

    box.innerHTML = '';


    filterMap.forEach(
        ([key, label]) => {

            const values = [

                ...new Set(

                    rows
                        .map(
                            r =>
                                String(
                                    r[key] ?? ''
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


            box.insertAdjacentHTML(
                'beforeend',
                `
                <div class="field">

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
                                    v =>
                                        `<option value="${esc(v)}">${esc(v)}</option>`
                                )
                                .join('')
                        }

                    </select>

                </div>
                `
            );
        }
    );


    box
        .querySelectorAll('select')
        .forEach(
            select => {

                select.onchange =
                    () => {

                        detailPage = 1;

                        render();
                    };
            }
        );
}


/* =====================================
   CALCULATIONS
===================================== */

function sum(
    data,
    key
) {

    return data.reduce(
        (total, row) =>
            total +
            num(row[key]),
        0
    );
}


function metrics(data) {

    const bs =
        Object.fromEntries(

            bucketDefs.map(
                ([label, key]) => [

                    key,

                    data.reduce(
                        (total, row) =>
                            total +
                            bucket(row)[key],
                        0
                    )
                ]
            )
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
                        r => r.party
                    )
                    .filter(Boolean)
            ).size,

        pdc:
            sum(
                data,
                'pdc'
            ),

        over90:
            sum(
                data,
                'days_90'
            ),

        over150:
            sum(
                data,
                'days_150'
            ),

        bs
    };
}


/* =====================================
   CHARTS
===================================== */

function draw(
    id,
    type,
    labels,
    datasets,
    opts = {}
) {

    if (
        charts[id]
    ) {

        charts[id].destroy();
    }


    const canvas =
        $(id);


    if (!canvas) return;


    charts[id] =
        new Chart(
            canvas,
            {

                type,

                data: {

                    labels,

                    datasets
                },


                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    interaction: {

                        mode: 'index',

                        intersect:
                            false
                    },


                    plugins: {

                        legend: {

                            display:
                                type ===
                                    'doughnut' ||
                                !!opts.legend
                        },


                        tooltip: {

                            callbacks: {

                                label:
                                    ctx => {

                                        const value =
                                            ctx.raw ?? 0;

                                        return (
                                            (
                                                ctx.dataset.label
                                                    ? ctx.dataset.label +
                                                      ': '
                                                    : ''
                                            ) +
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
                                                    Number(value);

                                                if (
                                                    Math.abs(n) >=
                                                    10000000
                                                ) {

                                                    return (
                                                        n /
                                                        10000000
                                                    ).toFixed(1) +
                                                    ' Cr';
                                                }


                                                if (
                                                    Math.abs(n) >=
                                                    100000
                                                ) {

                                                    return (
                                                        n /
                                                        100000
                                                    ).toFixed(1) +
                                                    ' L';
                                                }


                                                if (
                                                    Math.abs(n) >=
                                                    1000
                                                ) {

                                                    return (
                                                        n /
                                                        1000
                                                    ).toFixed(0) +
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


/* =====================================
   SIMPLE TABLE
===================================== */

function simpleTable(
    items,
    cols
) {

    return `

        <table>

            <thead>

                <tr>

                    ${
                        cols
                            .map(
                                c =>
                                    `<th class="${c.num ? 'num' : ''}">
                                        ${esc(c.l)}
                                    </th>`
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
                                (r, i) => `

                                <tr>

                                    ${
                                        cols
                                            .map(
                                                c => `

                                                <td class="${c.num ? 'num' : ''}">

                                                    ${
                                                        c.f
                                                            ? c.f(
                                                                r,
                                                                i
                                                            )
                                                            : esc(
                                                                r[c.k] ??
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
                                colspan="${cols.length}"
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


/* =====================================
   SORT HELPERS
===================================== */

function compareValues(
    a,
    b,
    key
) {

    const av =
        a?.[key] ?? '';

    const bv =
        b?.[key] ?? '';


    const an =
        Number(av);

    const bn =
        Number(bv);


    if (
        av !== '' &&
        bv !== '' &&
        Number.isFinite(an) &&
        Number.isFinite(bn)
    ) {

        return an - bn;
    }


    return String(av)
        .localeCompare(
            String(bv),
            undefined,
            {
                numeric: true,
                sensitivity: 'base'
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


    return sort.dir === 'asc'
        ? ' ▲'
        : ' ▼';
}





/* =====================================
   CUSTOMER DETAIL TABLE
===================================== */

function renderDetails(data) {

    const q =
        (
            $('#detailSearch')
                ?.value || ''
        )
            .trim()
            .toLowerCase();


    let list =
        q

            ? data.filter(
                r =>

                    [
                        r.party,
                        r.sm,
                        r.grp_name,
                        r.division,
                        r.area,
                        r.order_type,
                        r.city,
                        r.pincode
                    ].some(
                        value =>
                            String(
                                value ?? ''
                            )
                                .toLowerCase()
                                .includes(q)
                    )
            )

            : [...data];


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


    const pages =
        Math.max(
            1,
            Math.ceil(
                list.length /
                PAGE_SIZE
            )
        );


    detailPage =
        Math.min(
            Math.max(
                1,
                detailPage
            ),
            pages
        );


    const start =
        (
            detailPage - 1
        ) * PAGE_SIZE;


    const pageRows =
        list.slice(
            start,
            start + PAGE_SIZE
        );


    const cols = [

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


    $('#customerDetails')
        .innerHTML = `

        <table>

            <thead>

                <tr>

                    ${
                        cols.map(
                            (
                                [
                                    key,
                                    label,
                                    isNum
                                ]
                            ) => `

                            <th
                                class="sortable ${isNum ? 'num' : ''}"
                                data-detail-sort="${key}"
                            >

                                ${esc(label)}
                                ${sortArrow(
                                    detailSort,
                                    key
                                )}

                            </th>

                            `
                        ).join('')
                    }

                </tr>

            </thead>


            <tbody>

                ${
                    pageRows.length

                        ? pageRows
                            .map(
                                r => `

                                <tr>

                                    ${
                                        cols.map(
                                            (
                                                [
                                                    key,
                                                    label,
                                                    isNum
                                                ]
                                            ) => `

                                            <td class="${isNum ? 'num' : ''}">

                                                ${
                                                    isNum
                                                        ? money(
                                                            r[key]
                                                        )
                                                        : esc(
                                                            r[key] ??
                                                            ''
                                                        )
                                                }

                                            </td>

                                            `
                                        ).join('')
                                    }

                                </tr>

                                `
                            )
                            .join('')

                        : `

                        <tr>

                            <td
                                colspan="${cols.length}"
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


    $('#detailCount')
        .textContent =
            `${list.length.toLocaleString('en-IN')} rows`;


    $('#pageInfo')
        .textContent =
            `Page ${detailPage} of ${pages}`;


    $('#prevPage')
        .disabled =
            detailPage <= 1;


    $('#nextPage')
        .disabled =
            detailPage >= pages;


    document
        .querySelectorAll(
            '[data-detail-sort]'
        )
        .forEach(
            th => {

                th.onclick =
                    () => {

                        const key =
                            th.dataset
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


/* =====================================
   MAIN DASHBOARD RENDER
===================================== */

function render() {

    const data =
        filtered();


    const m =
        metrics(data);


    /* KPI CARDS */

    $('#kpis').innerHTML = [

        [
            'Total Outstanding',
            money(m.total)
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
            money(m.pdc)
        ],

        [
            'Over 90 Days',
            money(m.over90)
        ],

        [
            'Over 150 Days',
            money(m.over150)
        ]

    ].map(
        ([label, value]) => `

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
    ).join('');


    /* AGEING */

    const labels =
        bucketDefs.map(
            x => x[0]
        );


    const values =
        bucketDefs.map(
            x => m.bs[x[1]]
        );


    draw(
        '#ageChart',
        'bar',
        labels,
        [
            {
                label:
                    'Amount',

                data:
                    values,

                borderRadius:
                    6
            }
        ]
    );


    /* DONUT */

    draw(
        '#donutChart',
        'doughnut',
        labels,
        [
            {
                label:
                    'Amount',

                data:
                    values,

                borderWidth:
                    0
            }
        ],
        {
            legend:
                true
        }
    );


    /* AMOUNT RANGE */

    const ranges = [

        [
            '< 1,000',
            0,
            1000
        ],

        [
            '1,000-5,000',
            1000,
            5000
        ],

        [
            '5,000-10,000',
            5000,
            10000
        ],

        [
            '10,000-50,000',
            10000,
            50000
        ],

        [
            '50,000-1,00,000',
            50000,
            100000
        ],

        [
            '>1,00,000',
            100000,
            Infinity
        ]
    ];


    draw(
        '#rangeChart',
        'bar',
        ranges.map(
            x => x[0]
        ),
        [
            {
                label:
                    'Customers',

                data:
                    ranges.map(
                        range => {

                            const min =
                                range[1];

                            const max =
                                range[2];


                            return data.filter(
                                r =>

                                    num(
                                        r.balance
                                    ) >= min

                                    &&

                                    num(
                                        r.balance
                                    ) < max

                            ).length;
                        }
                    ),

                borderRadius:
                    6
            }
        ]
    );


    /* TOP 5 CUSTOMERS */

    const top =
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


    $('#topCustomers')
        .innerHTML =
            simpleTable(
                top,
                [

                    {
                        l: '#',

                        f:
                            (r, i) =>
                                i + 1
                    },

                    {
                        l:
                            'Party Name',

                        k:
                            'party'
                    },

                    {
                        l:
                            'Balance',

                        num:
                            1,

                        f:
                            r =>
                                money(
                                    r.balance
                                )
                    }
                ]
            );


    /* TOP 5 >150 DAYS */

    const overdue =
        data

            .filter(
                r =>
                    num(
                        r.days_150
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


    $('#overdueCustomers')
        .innerHTML =
            simpleTable(
                overdue,
                [

                    {
                        l: '#',

                        f:
                            (r, i) =>
                                i + 1
                    },

                    {
                        l:
                            'Party Name',

                        k:
                            'party'
                    },

                    {
                        l:
                            '>150 Days',

                        num:
                            1,

                        f:
                            r =>
                                money(
                                    r.days_150
                                )
                    },

                    {
                        l:
                            'Balance',

                        num:
                            1,

                        f:
                            r =>
                                money(
                                    r.balance
                                )
                    }
                ]
            );


    /* DETAIL TABLE */

    renderDetails(
        data
    );


    /* COMPARISON */

    renderCompare(
        m
    );
}


/* =====================================
   SNAPSHOT COMPARISON
===================================== */

async function renderCompare(
    current
) {

    if (
        !activeUpload
    ) {

        return;
    }


    const currentIndex =
        uploads.findIndex(
            u =>
                u.id ===
                activeUpload.id
        );


    const previous =
        currentIndex >= 0
            ? uploads[
                currentIndex + 1
            ]
            : null;


    if (
        !previous
    ) {

        $('#summaryCompare')
            .innerHTML =

            '<span class="muted">Upload another older snapshot to compare.</span>';


        draw(
            '#compareChart',
            'bar',
            [],
            []
        );


        return;
    }


    try {

        const previousRows =
            await rpc(
                'raj_outstanding_get_rows',
                {
                    p_upload_id:
                        previous.id
                }
            ) || [];


        const pm =
            metrics(
                previousRows
            );


        const labels =
            bucketDefs.map(
                x => x[0]
            );


        draw(
            '#compareChart',
            'bar',
            labels,
            [

                {
                    label:
                        previous
                            .outstanding_date,

                    data:
                        bucketDefs.map(
                            x =>
                                pm.bs[
                                    x[1]
                                ]
                        )
                },

                {
                    label:
                        activeUpload
                            .outstanding_date,

                    data:
                        bucketDefs.map(
                            x =>
                                current.bs[
                                    x[1]
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

            [
                'Total Outstanding',
                pm.total,
                current.total
            ],

            [
                'Total Customers',
                pm.customers,
                current.customers
            ],

            [
                'PDC Amount',
                pm.pdc,
                current.pdc
            ],

            [
                'Over 90 Days',
                pm.over90,
                current.over90
            ],

            [
                'Over 150 Days',
                pm.over150,
                current.over150
            ]
        ];


        $('#summaryCompare')
            .innerHTML =
                simpleTable(
                    comparisonRows,
                    [

                        {
                            l:
                                'Metric',

                            f:
                                r =>
                                    esc(
                                        r[0]
                                    )
                        },

                        {
                            l:
                                previous
                                    .outstanding_date,

                            num:
                                1,

                            f:
                                r =>
                                    r[0] ===
                                    'Total Customers'

                                        ? Number(
                                            r[1]
                                        ).toLocaleString(
                                            'en-IN'
                                        )

                                        : money(
                                            r[1]
                                        )
                        },

                        {
                            l:
                                activeUpload
                                    .outstanding_date,

                            num:
                                1,

                            f:
                                r =>
                                    r[0] ===
                                    'Total Customers'

                                        ? Number(
                                            r[2]
                                        ).toLocaleString(
                                            'en-IN'
                                        )

                                        : money(
                                            r[2]
                                        )
                        }
                    ]
                );


    } catch (e) {

        console.error(e);


        $('#summaryCompare')
            .innerHTML =

            '<span class="muted">Comparison unavailable.</span>';
    }
}





/* =====================================
   SNAPSHOT HISTORY
===================================== */

function renderHistory() {

    const list =
        [...uploads]
            .sort(
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


    const cols = [

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


    $('#history')
        .innerHTML = `

        <table>

            <thead>

                <tr>

                    ${
                        cols.map(
                            (
                                [
                                    key,
                                    label,
                                    isNum
                                ]
                            ) => `

                            <th
                                class="sortable ${isNum ? 'num' : ''}"
                                data-history-sort="${key}"
                            >

                                ${esc(label)}
                                ${sortArrow(
                                    historySort,
                                    key
                                )}

                            </th>

                            `
                        ).join('')
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
                                r => `

                                <tr>

                                    <td>
                                        ${esc(
                                            r.outstanding_date
                                        )}
                                    </td>


                                    <td>

                                        ${
                                            r.uploaded_at

                                                ? esc(
                                                    new Date(
                                                        r.uploaded_at
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
                                            r.uploaded_by
                                        )}
                                    </td>


                                    <td class="num">

                                        ${
                                            num(
                                                r.total_customers
                                            )
                                                .toLocaleString(
                                                    'en-IN'
                                                )
                                        }

                                    </td>


                                    <td class="num">

                                        ${
                                            money(
                                                r.total_outstanding
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
            th => {

                th.onclick =
                    () => {

                        const key =
                            th.dataset
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


/* =====================================
   LOAD OUTSTANDING DATA
===================================== */

async function load(
    preferredId = null
) {

    uploads =
        await rpc(
            'raj_outstanding_list_uploads'
        ) || [];


    /*
       Latest outstanding date first.
    */

    uploads.sort(
        (a, b) =>

            String(
                b.outstanding_date
            ).localeCompare(
                String(
                    a.outstanding_date
                )
            )

            ||

            String(
                b.uploaded_at ?? ''
            ).localeCompare(
                String(
                    a.uploaded_at ?? ''
                )
            )
    );


    $('#snapshotSelect')
        .innerHTML =

        uploads.length

            ? uploads
                .map(
                    u => `

                    <option value="${esc(u.id)}">

                        ${esc(
                            u.outstanding_date
                        )}

                    </option>

                    `
                )
                .join('')

            : `

            <option value="">
                No snapshot
            </option>

            `;


    activeUpload =

        uploads.find(
            u =>
                u.id ===
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

        return;
    }


    $('#snapshotSelect')
        .value =
            activeUpload.id;


    rows =
        await rpc(
            'raj_outstanding_get_rows',
            {
                p_upload_id:
                    activeUpload.id
            }
        ) || [];


    makeFilters();

    detailPage = 1;

    render();

    renderHistory();
}


/* =====================================
   CHANGE SNAPSHOT
===================================== */

async function switchSnapshot() {

    activeUpload =
        uploads.find(
            x =>
                x.id ===
                $('#snapshotSelect')
                    .value
        );


    if (
        !activeUpload
    ) {

        return;
    }


    rows =
        await rpc(
            'raj_outstanding_get_rows',
            {
                p_upload_id:
                    activeUpload.id
            }
        ) || [];


    makeFilters();

    detailPage = 1;

    render();
}


/* =====================================
   CSV HEADER CLEANUP
===================================== */

function normalizeHeader(s) {

    return String(
        s ?? ''
    )
        .replace(
            /^\uFEFF/,
            ''
        )
        .trim();
}


/* =====================================
   CSV UPLOAD
===================================== */

async function upload(file) {

    if (
        !file
    ) {

        return;
    }


    /*
       Only CSV accepted.
    */

    if (
        !/\.csv$/i.test(
            file.name
        )
    ) {

        toast(
            'Please select a CSV file.'
        );

        $('#fileInput')
            .value = '';

        return;
    }


    /*
       Outstanding snapshot date.
    */

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


    if (
        !date
    ) {

        $('#fileInput')
            .value = '';

        return;
    }


    /*
       Validate date format.
    */

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(date)
    ) {

        toast(
            'Date format must be YYYY-MM-DD.'
        );

        $('#fileInput')
            .value = '';

        return;
    }


    toast(
        'Reading CSV file…'
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
                            result.errors
                                ?.length
                        ) {

                            console.warn(
                                'CSV parse warnings:',
                                result.errors
                            );
                        }


                        /*
                           Required CSV columns
                        */

                        const required = [

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


                        const fields =
                            result.meta
                                ?.fields || [];


                        const missing =
                            required.filter(
                                heading =>
                                    !fields.includes(
                                        heading
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


                        /*
                           Map CSV to Supabase fields.
                        */

                        const mapped =
                            result.data

                                .filter(
                                    r =>

                                        String(
                                            r.Party ??
                                            ''
                                        ).trim()

                                        ||

                                        num(
                                            r.Balance
                                        ) !== 0
                                )

                                .map(
                                    r => ({

                                        party:
                                            String(
                                                r.Party ??
                                                ''
                                            ).trim(),

                                        balance:
                                            num(
                                                r.Balance
                                            ),

                                        days_15:
                                            num(
                                                r['15']
                                            ),

                                        days_30:
                                            num(
                                                r['30']
                                            ),

                                        days_45:
                                            num(
                                                r['45']
                                            ),

                                        days_60:
                                            num(
                                                r['60']
                                            ),

                                        days_75:
                                            num(
                                                r['75']
                                            ),

                                        days_90:
                                            num(
                                                r['90']
                                            ),

                                        days_120:
                                            num(
                                                r['120']
                                            ),

                                        days_150:
                                            num(
                                                r['150']
                                            ),

                                        pdc:
                                            num(
                                                r.PDC
                                            ),

                                        sm:
                                            String(
                                                r.SM ??
                                                ''
                                            ).trim(),

                                        grp_name:
                                            String(
                                                r.GrpName ??
                                                ''
                                            ).trim(),

                                        division:
                                            String(
                                                r.Division ??
                                                ''
                                            ).trim(),

                                        area:
                                            String(
                                                r.Area ??
                                                ''
                                            ).trim(),

                                        order_type:
                                            String(
                                                r.Order ??
                                                ''
                                            ).trim(),

                                        city:
                                            String(
                                                r.City ??
                                                ''
                                            ).trim(),

                                        pincode:
                                            String(
                                                r.Pincode ??
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


                        /*
                           Logged in user
                        */

                        const user =
                            JSON.parse(
                                localStorage.getItem(
                                    USER
                                ) || '{}'
                            );


                        /*
                           Upload to Supabase
                        */

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


                        /*
                           Reset file input.
                        */

                        $('#fileInput')
                            .value = '';


                        toast(
                            'Outstanding uploaded successfully: ' +
                            mapped.length
                                .toLocaleString(
                                    'en-IN'
                                ) +
                            ' rows'
                        );


                        /*
                           Reload dashboard.
                        */

                        await load();


                    } catch (e) {

                        console.error(e);


                        $('#fileInput')
                            .value = '';


                        toast(
                            'Upload failed: ' +
                            e.message
                        );
                    }
                },


            error:
                error => {

                    console.error(
                        error
                    );


                    $('#fileInput')
                        .value = '';


                    toast(
                        'CSV read failed: ' +
                        error.message
                    );
                }
        }
    );
}


/* =====================================
   START PAGE
===================================== */

(async () => {

    /*
       Check login.
    */

    if (
        !await guard()
    ) {

        return;
    }


    /*
       HEADER UPLOAD
    */

    $('#uploadBtn')
        ?.addEventListener(
            'click',
            () =>
                $('#fileInput')
                    .click()
        );


    /*
       QUICK ACTION UPLOAD
    */

    $('#uploadBtn2')
        ?.addEventListener(
            'click',
            () =>
                $('#fileInput')
                    .click()
        );


    /*
       FILE SELECT
    */

    $('#fileInput')
        .onchange =
            e =>
                upload(
                    e.target
                        .files[0]
                );


    /*
       SNAPSHOT SELECT
    */

    $('#snapshotSelect')
        .onchange =
            switchSnapshot;


    /*
       RESET FILTERS
    */

    $('#resetBtn')
        .onclick =
            () => {

                $('#filters')
                    .querySelectorAll(
                        'select'
                    )
                    .forEach(
                        x =>
                            x.value = ''
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


    /*
       CUSTOMER SEARCH
    */

    $('#detailSearch')
        .oninput =
            () => {

                detailPage = 1;

                renderDetails(
                    filtered()
                );
            };


    /*
       PREVIOUS PAGE
    */

    $('#prevPage')
        .onclick =
            () => {

                if (
                    detailPage > 1
                ) {

                    detailPage--;

                    renderDetails(
                        filtered()
                    );
                }
            };


    /*
       NEXT PAGE
    */

    $('#nextPage')
        .onclick =
            () => {

                detailPage++;

                renderDetails(
                    filtered()
                );
            };


    /*
       REFRESH
    */

    $('#refreshBtn')
        .onclick =
            () =>
                load(
                    activeUpload
                        ?.id ||
                    null
                );


    /*
       VIEW DATA LOG

       Scrolls to Customer Details.
    */

    $('#logsBtn')
        .onclick =
            () =>

                $('#customerDetails')
                    ?.scrollIntoView(
                        {
                            behavior:
                                'smooth',

                            block:
                                'start'
                        }
                    );


    /*
       LOGOUT
    */

    $('#logoutBtn')
        .onclick =
            () => {

                localStorage.removeItem(
                    TOKEN
                );

                localStorage.removeItem(
                    USER
                );

                location.href =
                    'index.html';
            };


    /*
       INITIAL LOAD
    */

    await load();


})().catch(
    e => {

        console.error(e);

        toast(
            e.message
        );
    }
);
