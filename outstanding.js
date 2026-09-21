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

const $ = s => document.querySelector(s);

const money = n =>
    '₹ ' + Math.round(Number(n || 0)).toLocaleString('en-IN');

const num = v => {
    const n = Number(String(v ?? 0).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
};


/* ===============================
   TOAST
================================ */

function toast(message) {
    const e = $('#toast');

    if (!e) return;

    e.textContent = message;
    e.style.display = 'block';

    setTimeout(() => {
        e.style.display = 'none';
    }, 2600);
}


/* ===============================
   AUTH / RPC
================================ */

function authArgs(extra = {}) {
    return {
        p_session_token: localStorage.getItem(TOKEN) || '',
        p_device_id: localStorage.getItem(DEVICE) || '',
        ...extra
    };
}


async function rpc(name, args = {}) {

    const { data, error } = await sb.rpc(
        name,
        authArgs(args)
    );

    if (error) throw error;

    return data;
}


async function guard() {

    if (!localStorage.getItem(TOKEN)) {
        location.href = 'index.html';
        return false;
    }

    try {

        const { data, error } =
            await sb.rpc(
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

    } catch (e) {

        location.href = 'index.html';
        return false;
    }
}


/* ===============================
   AGEING BUCKETS
================================ */

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
            num(r.days_15),

        days_30:
            Math.max(
                0,
                num(r.days_30) -
                num(r.days_15)
            ),

        days_45:
            Math.max(
                0,
                num(r.days_45) -
                num(r.days_30)
            ),

        days_60:
            Math.max(
                0,
                num(r.days_60) -
                num(r.days_45)
            ),

        days_75:
            Math.max(
                0,
                num(r.days_75) -
                num(r.days_60)
            ),

        days_90:
            Math.max(
                0,
                num(r.days_90) -
                num(r.days_75)
            ),

        days_120:
            Math.max(
                0,
                num(r.days_120) -
                num(r.days_90)
            ),

        days_150:
            Math.max(
                0,
                num(r.days_150) -
                num(r.days_120)
            ),

        over150:
            Math.max(
                0,
                num(r.balance) -
                num(r.days_150) -
                num(r.pdc)
            ),

        pdc:
            num(r.pdc)
    };
}


/* ===============================
   FILTERS
================================ */

const filterMap = [

    ['party', 'Customer / Party'],

    ['sm', 'SM'],

    ['division', 'Division'],

    ['area', 'Area'],

    ['order_type', 'OD / Order'],

    ['city', 'City'],

    ['pincode', 'Pincode']
];


function filtered() {

    return rows.filter(r =>

        filterMap.every(([key]) => {

            const el =
                $(`#f_${key}`);

            const value =
                el?.value;

            return (
                !value ||
                String(r[key] ?? '') === value
            );
        })
    );
}


function esc(s) {

    return String(s).replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );
}


function makeFilters() {

    const box = $('#filters');

    if (!box) return;

    box.innerHTML = '';

    filterMap.forEach(([key, label]) => {

        const values = [
            ...new Set(
                rows
                    .map(r =>
                        String(r[key] ?? '').trim()
                    )
                    .filter(Boolean)
            )
        ].sort();

        box.insertAdjacentHTML(
            'beforeend',
            `
            <div class="field">

                <label>
                    ${label}
                </label>

                <select id="f_${key}">

                    <option value="">
                        All ${label}
                    </option>

                    ${values
                        .map(v =>
                            `<option value="${esc(v)}">${esc(v)}</option>`
                        )
                        .join('')}

                </select>

            </div>
            `
        );
    });


    box
        .querySelectorAll('select')
        .forEach(select => {

            select.onchange = render;

        });
}


/* ===============================
   CALCULATIONS
================================ */

function sum(data, key) {

    return data.reduce(
        (total, row) =>
            total + num(row[key]),
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
            sum(data, 'balance'),

        customers:
            new Set(
                data
                    .map(r => r.party)
                    .filter(Boolean)
            ).size,

        pdc:
            sum(data, 'pdc'),

        over90:
            bs.days_120 +
            bs.days_150 +
            bs.over150,

        over150:
            bs.over150,

        bs
    };
}


/* ===============================
   CHART
================================ */

function draw(
    id,
    type,
    labels,
    data,
    opts = {}
) {

    if (charts[id]) {
        charts[id].destroy();
    }


    const canvas = $(id);

    if (!canvas) return;


    charts[id] =
        new Chart(
            canvas,
            {

                type,

                data: {
                    labels,
                    datasets: data
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display:
                                type === 'doughnut' ||
                                opts.legend
                        }
                    },

                    scales:
                        type === 'doughnut'
                            ? {}
                            : {

                                y: {
                                    beginAtZero: true,

                                    grid: {
                                        color: '#eef1f7'
                                    }
                                },

                                x: {
                                    grid: {
                                        display: false
                                    }
                                }
                            }
                }
            }
        );
}


/* ===============================
   TABLE GENERATOR
================================ */

function table(items, cols) {

    return `

    <table>

        <thead>

            <tr>

                ${cols
                    .map(c =>
                        `<th class="${c.num ? 'num' : ''}">
                            ${c.l}
                        </th>`
                    )
                    .join('')}

            </tr>

        </thead>


        <tbody>

            ${
                items.length

                ? items
                    .map(
                        (r, i) => `

                        <tr>

                            ${cols
                                .map(c => `

                                <td class="${c.num ? 'num' : ''}">

                                    ${
                                        c.f
                                            ? c.f(r, i)
                                            : esc(r[c.k] ?? '')
                                    }

                                </td>

                                `)
                                .join('')}

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


/* ===============================
   MAIN DASHBOARD
================================ */

function render() {

    const data =
        filtered();

    const m =
        metrics(data);


    /* KPI */

    $('#kpis').innerHTML = [

        [
            'Total Outstanding',
            money(m.total)
        ],

        [
            'Total Customers',
            m.customers.toLocaleString('en-IN')
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
        bucketDefs.map(x => x[0]);

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
                label: 'Amount',
                data: values,
                borderRadius: 6
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
                data: values,
                borderWidth: 0
            }
        ],
        {
            legend: true
        }
    );


    /* AMOUNT RANGE */

    const ranges = [

        ['< 1,000', 0, 1000],

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
        ranges.map(x => x[0]),
        [
            {

                label: 'Customers',

                data:
                    ranges.map(
                        range =>

                            data.filter(
                                row =>

                                    num(row.balance) >=
                                    range[1]

                                    &&

                                    num(row.balance) <
                                    range[2]
                            ).length
                    ),

                borderRadius: 6
            }
        ]
    );


    /* TOP CUSTOMERS */

    const top = [
        ...data
    ]
        .sort(
            (a, b) =>
                num(b.balance) -
                num(a.balance)
        )
        .slice(0, 5);


    $('#topCustomers').innerHTML =
        table(
            top,
            [

                {
                    l: '#',
                    f: (r, i) =>
                        i + 1
                },

                {
                    l: 'Party Name',
                    k: 'party'
                },

                {
                    l: 'Balance',
                    num: 1,
                    f: r =>
                        money(r.balance)
                }
            ]
        );


    /* OVER 150 */

    const overdue = [
        ...data
    ]
        .map(
            row => ({
                ...row,
                overdue150:
                    bucket(row).over150
            })
        )
        .sort(
            (a, b) =>
                b.overdue150 -
                a.overdue150
        )
        .slice(0, 5);


    $('#overdueCustomers').innerHTML =
        table(
            overdue,
            [

                {
                    l: '#',
                    f: (r, i) =>
                        i + 1
                },

                {
                    l: 'Party Name',
                    k: 'party'
                },

                {
                    l: '>150 Days',
                    num: 1,
                    f: r =>
                        money(r.overdue150)
                },

                {
                    l: 'Balance',
                    num: 1,
                    f: r =>
                        money(r.balance)
                }
            ]
        );


    renderCompare(m);
}


/* ===============================
   COMPARISON
================================ */

async function renderCompare(current) {

    const previous =
        uploads.find(
            u =>
                u.id !==
                activeUpload?.id
        );


    if (!previous) {

        $('#summaryCompare').innerHTML =
            '<span class="muted">Upload another snapshot to compare.</span>';

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
            );


        const previousMetrics =
            metrics(
                previousRows || []
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
                        previous.outstanding_date,

                    data:
                        bucketDefs.map(
                            x =>
                                previousMetrics
                                    .bs[x[1]]
                        )
                },

                {
                    label:
                        activeUpload
                            .outstanding_date,

                    data:
                        bucketDefs.map(
                            x =>
                                current.bs[x[1]]
                        )
                }

            ],
            {
                legend: true
            }
        );


        const comparisonRows = [

            [
                'Total Outstanding',
                previousMetrics.total,
                current.total
            ],

            [
                'Total Customers',
                previousMetrics.customers,
                current.customers
            ],

            [
                'PDC Amount',
                previousMetrics.pdc,
                current.pdc
            ],

            [
                'Over 90 Days',
                previousMetrics.over90,
                current.over90
            ],

            [
                'Over 150 Days',
                previousMetrics.over150,
                current.over150
            ]
        ];


        $('#summaryCompare').innerHTML =
            table(
                comparisonRows,
                [

                    {
                        l: 'Metric',
                        f: r => r[0]
                    },

                    {
                        l:
                            previous
                                .outstanding_date,

                        num: 1,

                        f: r =>
                            r[0] ===
                            'Total Customers'
                                ? r[1]
                                : money(r[1])
                    },

                    {
                        l:
                            activeUpload
                                .outstanding_date,

                        num: 1,

                        f: r =>
                            r[0] ===
                            'Total Customers'
                                ? r[2]
                                : money(r[2])
                    }

                ]
            );


    } catch (e) {

        console.error(e);

        $('#summaryCompare').innerHTML =
            '<span class="muted">Comparison unavailable.</span>';
    }
}


/* ===============================
   LOAD DATA
================================ */

async function load() {

    uploads =
        await rpc(
            'raj_outstanding_list_uploads'
        ) || [];


    $('#snapshotSelect').innerHTML =
        uploads
            .map(
                u =>
                    `<option value="${u.id}">
                        ${u.outstanding_date}
                    </option>`
            )
            .join('');


    activeUpload =
        uploads[0] || null;


    if (!activeUpload) {

        rows = [];

        makeFilters();

        render();

        history();

        return;
    }


    $('#snapshotSelect').value =
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

    render();

    history();
}


/* ===============================
   HISTORY
================================ */

function history() {

    $('#history').innerHTML =
        table(
            uploads.slice(0, 10),
            [

                {
                    l: 'Date',
                    k: 'outstanding_date'
                },

                {
                    l: 'Uploaded On',

                    f: r =>
                        new Date(
                            r.uploaded_at
                        ).toLocaleString(
                            'en-IN'
                        )
                },

                {
                    l: 'By',
                    k: 'uploaded_by'
                },

                {
                    l: 'Customers',
                    num: 1,
                    k: 'total_customers'
                },

                {
                    l: 'Outstanding',
                    num: 1,

                    f: r =>
                        money(
                            r.total_outstanding
                        )
                }

            ]
        );
}


/* ===============================
   CHANGE SNAPSHOT
================================ */

async function switchSnapshot() {

    activeUpload =
        uploads.find(
            x =>
                x.id ===
                $('#snapshotSelect').value
        );


    if (!activeUpload) return;


    rows =
        await rpc(
            'raj_outstanding_get_rows',
            {
                p_upload_id:
                    activeUpload.id
            }
        ) || [];


    makeFilters();

    render();
}


/* ===============================
   CSV UPLOAD
================================ */

async function upload(file) {

    if (!file) return;


    const date =
        prompt(
            'Outstanding date (YYYY-MM-DD):',
            new Date()
                .toISOString()
                .slice(0, 10)
        );


    if (!date) return;


    toast(
        'Reading file…'
    );


    Papa.parse(
        file,
        {

            header: true,

            skipEmptyLines: true,


            complete:
                async result => {

                    try {

                        const mapped =
                            result.data.map(
                                r => ({

                                    party:
                                        r.Party || '',

                                    balance:
                                        num(r.Balance),

                                    days_15:
                                        num(r['15']),

                                    days_30:
                                        num(r['30']),

                                    days_45:
                                        num(r['45']),

                                    days_60:
                                        num(r['60']),

                                    days_75:
                                        num(r['75']),

                                    days_90:
                                        num(r['90']),

                                    days_120:
                                        num(r['120']),

                                    days_150:
                                        num(r['150']),

                                    pdc:
                                        num(r.PDC),

                                    sm:
                                        r.SM || '',

                                    grp_name:
                                        r.GrpName || '',

                                    division:
                                        r.Division || '',

                                    area:
                                        r.Area || '',

                                    order_type:
                                        r.Order || '',

                                    city:
                                        r.City || '',

                                    pincode:
                                        String(
                                            r.Pincode || ''
                                        )
                                })
                            );


                        const user =
                            JSON.parse(
                                localStorage.getItem(
                                    USER
                                ) || '{}'
                            );


                        await rpc(
                            'raj_outstanding_upload_json',
                            {

                                p_outstanding_date:
                                    date,

                                p_file_name:
                                    file.name,

                                p_uploaded_by:
                                    user.name ||
                                    user.username ||
                                    user.email ||
                                    'User',

                                p_rows:
                                    mapped
                            }
                        );


                        toast(
                            'Outstanding uploaded successfully'
                        );


                        await load();


                    } catch (e) {

                        console.error(e);

                        toast(
                            'Upload failed: ' +
                            e.message
                        );
                    }
                }
        }
    );
}


/* ===============================
   DOWNLOAD CSV
================================ */

function download() {

    const data =
        filtered();


    const csv =
        Papa.unparse(data);


    const blob =
        new Blob(
            [csv],
            {
                type: 'text/csv'
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement('a');


    link.href =
        url;


    link.download =
        `outstanding-${
            activeUpload?.outstanding_date ||
            'report'
        }.csv`;


    link.click();


    URL.revokeObjectURL(url);
}


/* ===============================
   START PAGE
================================ */

(async () => {

    if (!await guard()) {
        return;
    }


    $('#uploadBtn').onclick =
        () =>
            $('#fileInput').click();


    $('#uploadBtn2').onclick =
        () =>
            $('#fileInput').click();


    $('#fileInput').onchange =
        e =>
            upload(
                e.target.files[0]
            );


    $('#snapshotSelect').onchange =
        switchSnapshot;


    $('#resetBtn').onclick =
        () => {

            $('#filters')
                .querySelectorAll('select')
                .forEach(
                    x =>
                        x.value = ''
                );

            render();
        };


    $('#refreshBtn').onclick =
        load;


    $('#downloadBtn').onclick =
        download;


    $('#logsBtn').onclick =
        () =>
            document
                .querySelector('.bottom')
                ?.scrollIntoView({
                    behavior: 'smooth'
                });


    $('#logoutBtn').onclick =
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


    await load();


})().catch(
    e => {

        console.error(e);

        toast(
            e.message
        );
    }
);
