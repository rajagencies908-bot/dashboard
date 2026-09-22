(() => {
'use strict';

/* =========================================================
   OUTSTANDING DASHBOARD - CLEAN VERSION
========================================================= */

const $ = s => document.querySelector(s);

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

let sb = null;
let rows = [];
let uploads = [];
let activeUpload = null;
let charts = {};
let detailPage = 1;
let comparisonRequestId = 0;

const snapshotCache = new Map();

let detailSort = {
  key: 'party',
  dir: 'asc'
};

let historySort = {
  key: 'outstanding_date',
  dir: 'desc'
};

/* =========================================================
   FILTERS
========================================================= */

const filterMap = [
  ['party', 'Customer / Party'],
  ['sm', 'SM'],
  ['grp_name', 'GrpName'],
  ['division', 'Division'],
  ['area', 'Area'],
  ['order_type', 'OD / Order'],
  ['city', 'City'],
  ['pincode', 'Pincode']
];

const filterSelections = {};

filterMap.forEach(([key]) => {
  filterSelections[key] = new Set();
});

/* =========================================================
   AGEING DEFINITIONS
========================================================= */

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

const customerBucketDefs = [
  ['0-15', 'days_15'],
  ['16-30', 'days_30'],
  ['31-45', 'days_45'],
  ['46-60', 'days_60'],
  ['61-75', 'days_75'],
  ['76-90', 'days_90'],
  ['91-120', 'days_120'],
  ['121-150', 'days_150'],
  ['>150', 'over150']
];

/* =========================================================
   BASIC HELPERS
========================================================= */

function num(v) {
  if (
    v === null ||
    v === undefined ||
    v === ''
  ) {
    return 0;
  }

  const n = Number(
    String(v)
      .replace(/,/g, '')
      .trim()
  );

  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return '₹ ' +
    Math.round(num(v))
      .toLocaleString('en-IN');
}

function esc(v) {
  return String(v ?? '')
    .replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
}

function toast(message, stay = false) {
  console.log('[Outstanding]', message);

  const el = $('#toast');

  if (!el) return;

  el.textContent = message;
  el.style.display = 'block';

  clearTimeout(toast.timer);

  if (!stay) {
    toast.timer = setTimeout(() => {
      el.style.display = 'none';
    }, 3500);
  }
}

function fatal(error) {
  console.error(
    '[Outstanding Dashboard]',
    error
  );

  toast(
    'Dashboard error: ' +
    (error?.message || String(error)),
    true
  );
}

/* =========================================================
   SUPABASE / AUTH
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

async function rpc(name, args = {}) {
  const { data, error } =
    await sb.rpc(
      name,
      authArgs(args)
    );

  if (error) {
    throw new Error(
      `${name}: ${error.message}`
    );
  }

  return data;
}

async function guard() {
  if (!localStorage.getItem(TOKEN)) {
    location.href = 'index.html';
    return false;
  }

  toast('Checking session...', true);

  const { data, error } =
    await sb.rpc(
      'raj_app_validate_session',
      authArgs()
    );

  if (error) {
    throw new Error(
      'Session check failed: ' +
      error.message
    );
  }

  if (!data || data.success !== true) {
    location.href = 'index.html';
    return false;
  }

  return true;
}

/* =========================================================
   LOAD ALL ROWS - 1000 AT A TIME
========================================================= */

async function getAllOutstandingRows(
  uploadId,
  message = 'Loading'
) {
  const result = [];
  let offset = 0;

  while (true) {
    toast(
      `${message}: ${result.length.toLocaleString('en-IN')} rows loaded...`,
      true
    );

    const response =
      await sb.rpc(
        'raj_outstanding_get_rows',
        authArgs({
          p_upload_id: uploadId,
          p_offset: offset,
          p_limit: PAGE_SIZE
        })
      );

    if (response.error) {
      throw new Error(
        'raj_outstanding_get_rows: ' +
        response.error.message
      );
    }

    const page =
      Array.isArray(response.data)
        ? response.data
        : [];

    result.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;

    if (offset > 100000) {
      throw new Error(
        'Pagination safety limit reached.'
      );
    }
  }

  return result;
}

/* =========================================================
   CORRECT AGEING BUCKET CALCULATION

   Source columns are cumulative.
========================================================= */

function bucket(row) {
  return {
    days_15: Math.max(
      0,
      num(row.balance) -
      num(row.days_15) -
      num(row.pdc)
    ),

    days_30: Math.max(
      0,
      num(row.days_15) -
      num(row.days_30)
    ),

    days_45: Math.max(
      0,
      num(row.days_30) -
      num(row.days_45)
    ),

    days_60: Math.max(
      0,
      num(row.days_45) -
      num(row.days_60)
    ),

    days_75: Math.max(
      0,
      num(row.days_60) -
      num(row.days_75)
    ),

    days_90: Math.max(
      0,
      num(row.days_75) -
      num(row.days_90)
    ),

    days_120: Math.max(
      0,
      num(row.days_90) -
      num(row.days_120)
    ),

    days_150: Math.max(
      0,
      num(row.days_120) -
      num(row.days_150)
    ),

    over150: Math.max(
      0,
      num(row.days_150)
    ),

    pdc: Math.max(
      0,
      num(row.pdc)
    )
  };
}

/* =========================================================
   FILTER LOGIC
========================================================= */

function rowMatches(row, ignoreKey = null) {
  return filterMap.every(([key]) => {
    if (key === ignoreKey) {
      return true;
    }

    const selected =
      filterSelections[key];

    if (!selected.size) {
      return true;
    }

    const value =
      String(row[key] ?? '').trim();

    return selected.has(value);
  });
}

function filtered(source = rows) {
  return source.filter(row => rowMatches(row));
}

function availableValues(key) {
  return [
    ...new Set(
      rows
        .filter(row =>
          rowMatches(row, key)
        )
        .map(row =>
          String(row[key] ?? '').trim()
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(
      b,
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
  );
}

function pruneSelections() {
  let changed = true;
  let pass = 0;

  while (changed && pass < 12) {
    changed = false;
    pass++;

    for (const [key] of filterMap) {
      const available =
        new Set(availableValues(key));

      for (
        const value
        of [...filterSelections[key]]
      ) {
        if (!available.has(value)) {
          filterSelections[key]
            .delete(value);

          changed = true;
        }
      }
    }
  }
}

function filterTitle(key, label) {
  const selected =
    filterSelections[key];

  if (!selected.size) {
    return `All ${label}`;
  }

  if (selected.size === 1) {
    return [...selected][0];
  }

  return `${selected.size} selected`;
}

function renderFilterOptions(key) {
  const box =
    document.querySelector(
      `.ms[data-key="${key}"]`
    );

  if (!box) return;

  const definition =
    filterMap.find(x => x[0] === key);

  if (!definition) return;

  const label = definition[1];

  const search =
    String(
      box.querySelector('.ms-search')
        ?.value || ''
    )
      .trim()
      .toLowerCase();

  const values =
    availableValues(key)
      .filter(v =>
        v.toLowerCase()
          .includes(search)
      );

  const options =
    box.querySelector('.ms-options');

  if (!options) return;

  options.innerHTML =
    values.length
      ? values.map(value => `
          <label class="ms-option">
            <input
              type="checkbox"
              value="${esc(value)}"
              ${
                filterSelections[key]
                  .has(value)
                  ? 'checked'
                  : ''
              }
            >
            <span>${esc(value)}</span>
          </label>
        `).join('')
      : `
          <div class="ms-empty">
            No matching options
          </div>
        `;

  const trigger =
    box.querySelector('.ms-trigger');

  if (trigger) {
    trigger.textContent =
      filterTitle(key, label);
  }

  options
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(input => {
      input.onchange = () => {
        if (input.checked) {
          filterSelections[key]
            .add(input.value);
        } else {
          filterSelections[key]
            .delete(input.value);
        }

        filtersChanged();
      };
    });
}

function refreshFilters() {
  filterMap.forEach(([key]) => {
    renderFilterOptions(key);
  });
}

function filtersChanged() {
  pruneSelections();
  detailPage = 1;
  refreshFilters();
  render();
}

function makeFilters() {
  const container = $('#filters');

  if (!container) return;

  container.innerHTML =
    filterMap.map(([key, label]) => `
      <div class="field">
        <label>${esc(label)}</label>

        <div
          class="ms"
          data-key="${key}"
        >
          <button
            type="button"
            class="ms-trigger"
          >
            ${esc(
              filterTitle(key, label)
            )}
          </button>

          <div class="ms-menu">
            <div class="ms-search-wrap">
              <input
                class="ms-search"
                type="search"
                placeholder="Search ${esc(label)}..."
              >
            </div>

            <div class="ms-actions">
              <button
                type="button"
                data-act="all"
              >
                Select visible
              </button>

              <button
                type="button"
                data-act="clear"
              >
                Clear
              </button>
            </div>

            <div class="ms-options"></div>
          </div>
        </div>
      </div>
    `).join('');

  container
    .querySelectorAll('.ms')
    .forEach(box => {
      const key = box.dataset.key;

      const trigger =
        box.querySelector('.ms-trigger');

      const menu =
        box.querySelector('.ms-menu');

      const search =
        box.querySelector('.ms-search');

      const all =
        box.querySelector(
          '[data-act="all"]'
        );

      const clear =
        box.querySelector(
          '[data-act="clear"]'
        );

      trigger.onclick = event => {
        event.stopPropagation();

        document
          .querySelectorAll('.ms.open')
          .forEach(other => {
            if (other !== box) {
              other.classList
                .remove('open');
            }
          });

        box.classList.toggle('open');

        renderFilterOptions(key);

        if (
          box.classList.contains('open')
        ) {
          setTimeout(
            () => search?.focus(),
            20
          );
        }
      };

      menu.onclick =
        event => event.stopPropagation();

      search.oninput =
        () => renderFilterOptions(key);

      clear.onclick = () => {
        filterSelections[key].clear();
        search.value = '';
        filtersChanged();
      };

      all.onclick = () => {
        const q =
          String(search.value || '')
            .trim()
            .toLowerCase();

        availableValues(key)
          .filter(v =>
            v.toLowerCase().includes(q)
          )
          .forEach(v =>
            filterSelections[key].add(v)
          );

        filtersChanged();
      };
    });

  refreshFilters();
}

document.addEventListener(
  'click',
  () => {
    document
      .querySelectorAll('.ms.open')
      .forEach(box =>
        box.classList.remove('open')
      );
  }
);

/* =========================================================
   METRICS
========================================================= */

function sum(data, key) {
  return data.reduce(
    (total, row) =>
      total + num(row[key]),
    0
  );
}

function metrics(data) {
  const bs = {};

  bucketDefs.forEach(([, key]) => {
    bs[key] =
      data.reduce(
        (total, row) =>
          total + bucket(row)[key],
        0
      );
  });

  return {
    total: sum(data, 'balance'),

    customers:
      new Set(
        data
          .map(row =>
            String(row.party ?? '')
              .trim()
          )
          .filter(Boolean)
      ).size,

    pdc: sum(data, 'pdc'),

    /* Source 90/150 columns are cumulative */
    over90: sum(data, 'days_90'),

    over150:
      sum(data, 'days_150'),

    bs
  };
}

/* =========================================================
   CHARTS
========================================================= */

function draw(
  selector,
  type,
  labels,
  datasets,
  options = {}
) {
  if (charts[selector]) {
    charts[selector].destroy();
  }

  const canvas = $(selector);

  if (!canvas) return;

  charts[selector] =
    new Chart(canvas, {
      type,

      data: {
        labels,
        datasets
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
          mode: 'index',
          intersect: false
        },

        plugins: {
          legend: {
            display:
              type === 'doughnut' ||
              !!options.legend
          },

          tooltip: {
            callbacks: {
              label(context) {
                const prefix =
                  context.dataset.label
                    ? context.dataset.label +
                      ': '
                    : '';

                if (options.countChart) {
                  return (
                    prefix +
                    Number(
                      context.raw || 0
                    ).toLocaleString('en-IN')
                  );
                }

                return (
                  prefix +
                  money(context.raw || 0)
                );
              }
            }
          }
        },

        scales:
          type === 'doughnut'
            ? {}
            : {
                y: {
                  beginAtZero: true,

                  ticks: {
                    precision:
                      options.countChart
                        ? 0
                        : undefined,

                    callback(value) {
                      const n = Number(value);

                      if (
                        options.countChart
                      ) {
                        return n.toLocaleString(
                          'en-IN'
                        );
                      }

                      if (
                        Math.abs(n) >=
                        10000000
                      ) {
                        return (
                          n / 10000000
                        ).toFixed(1) + ' Cr';
                      }

                      if (
                        Math.abs(n) >=
                        100000
                      ) {
                        return (
                          n / 100000
                        ).toFixed(1) + ' L';
                      }

                      if (
                        Math.abs(n) >= 1000
                      ) {
                        return (
                          n / 1000
                        ).toFixed(0) + ' K';
                      }

                      return n;
                    }
                  }
                },

                x: {
                  grid: {
                    display: false
                  }
                }
              }
      }
    });
}

/* =========================================================
   TABLE HELPER
========================================================= */

function simpleTable(items, columns) {
  return `
    <table>
      <thead>
        <tr>
          ${columns.map(c => `
            <th class="${
              c.num ? 'num' : ''
            }">
              ${esc(c.label)}
            </th>
          `).join('')}
        </tr>
      </thead>

      <tbody>
        ${
          items.length
            ? items.map(
                (row, index) => `
                  <tr>
                    ${columns.map(c => `
                      <td class="${
                        c.num ? 'num' : ''
                      }">
                        ${
                          c.render
                            ? c.render(
                                row,
                                index
                              )
                            : esc(
                                row[c.key] ??
                                ''
                              )
                        }
                      </td>
                    `).join('')}
                  </tr>
                `
              ).join('')
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

const numericFields = new Set([
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

function compareValues(a, b, key) {
  if (numericFields.has(key)) {
    return (
      num(a?.[key]) -
      num(b?.[key])
    );
  }

  return String(
    a?.[key] ?? ''
  ).localeCompare(
    String(b?.[key] ?? ''),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

function sortArrow(sort, key) {
  if (sort.key !== key) {
    return '';
  }

  return sort.dir === 'asc'
    ? ' ▲'
    : ' ▼';
}

/* =========================================================
   CUSTOMER DETAILS
========================================================= */

function renderDetails(data) {
  const container =
    $('#customerDetails');

  if (!container) return;

  const search =
    String(
      $('#detailSearch')?.value || ''
    )
      .trim()
      .toLowerCase();

  let list = [...data];

  if (search) {
    list = list.filter(row =>
      [
        row.party,
        row.sm,
        row.grp_name,
        row.division,
        row.area,
        row.order_type,
        row.city,
        row.pincode
      ].some(v =>
        String(v ?? '')
          .toLowerCase()
          .includes(search)
      )
    );
  }

  list.sort((a, b) => {
    const result =
      compareValues(
        a,
        b,
        detailSort.key
      );

    return detailSort.dir === 'asc'
      ? result
      : -result;
  });

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
      Math.max(detailPage, 1),
      totalPages
    );

  const start =
    (detailPage - 1) *
    DETAIL_PAGE_SIZE;

  const pageRows =
    list.slice(
      start,
      start + DETAIL_PAGE_SIZE
    );

  const columns = [
    ['party', 'Party', false],
    ['balance', 'Balance', true],
    ['days_15', '>15', true],
    ['days_30', '>30', true],
    ['days_45', '>45', true],
    ['days_60', '>60', true],
    ['days_75', '>75', true],
    ['days_90', '>90', true],
    ['days_120', '>120', true],
    ['days_150', '>150', true],
    ['pdc', 'PDC', true],
    ['sm', 'SM', false],
    ['grp_name', 'GrpName', false],
    ['division', 'Division', false],
    ['area', 'Area', false],
    [
      'order_type',
      'OD / Order',
      false
    ],
    ['city', 'City', false],
    ['pincode', 'Pincode', false]
  ];

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          ${columns.map(
            ([key, label, numeric]) => `
              <th
                class="sortable ${
                  numeric ? 'num' : ''
                }"
                data-detail-sort="${key}"
              >
                ${esc(label)}
                ${sortArrow(
                  detailSort,
                  key
                )}
              </th>
            `
          ).join('')}
        </tr>
      </thead>

      <tbody>
        ${
          pageRows.length
            ? pageRows.map(row => `
                <tr>
                  ${columns.map(
                    ([key, , numeric]) => `
                      <td class="${
                        numeric ? 'num' : ''
                      }">
                        ${
                          numeric
                            ? money(row[key])
                            : esc(
                                row[key] ??
                                ''
                              )
                        }
                      </td>
                    `
                  ).join('')}
                </tr>
              `).join('')
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

  if ($('#detailCount')) {
    $('#detailCount').textContent =
      `${list.length.toLocaleString(
        'en-IN'
      )} rows`;
  }

  if ($('#pageInfo')) {
    $('#pageInfo').textContent =
      `Page ${detailPage} of ${totalPages}`;
  }

  if ($('#prevPage')) {
    $('#prevPage').disabled =
      detailPage <= 1;
  }

  if ($('#nextPage')) {
    $('#nextPage').disabled =
      detailPage >= totalPages;
  }

  container
    .querySelectorAll(
      '[data-detail-sort]'
    )
    .forEach(th => {
      th.onclick = () => {
        const key =
          th.dataset.detailSort;

        if (detailSort.key === key) {
          detailSort.dir =
            detailSort.dir === 'asc'
              ? 'desc'
              : 'asc';
        } else {
          detailSort = {
            key,
            dir: 'asc'
          };
        }

        detailPage = 1;

        renderDetails(filtered());
      };
    });
}

/* =========================================================
   MAIN RENDER
========================================================= */

function render() {
  const data = filtered();
  const m = metrics(data);

  /* KPI */

  if ($('#kpis')) {
    const cards = [
      [
        'Total Outstanding',
        money(m.total)
      ],
      [
        'Total Customers',
        m.customers.toLocaleString(
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
    ];

    $('#kpis').innerHTML =
      cards.map(([label, value]) => `
        <article class="kpi">
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
          <small>Current snapshot</small>
        </article>
      `).join('');
  }

  /* AGEING AMOUNT */

  const ageingLabels =
    bucketDefs.map(x => x[0]);

  const ageingValues =
    bucketDefs.map(
      x => m.bs[x[1]]
    );

  draw(
    '#ageChart',
    'bar',
    ageingLabels,
    [{
      label: 'Amount',
      data: ageingValues,
      borderRadius: 6
    }]
  );

  /* DONUT */

  draw(
    '#donutChart',
    'doughnut',
    ageingLabels,
    [{
      label: 'Amount',
      data: ageingValues,
      borderWidth: 0
    }],
    {
      legend: true
    }
  );

  /* =====================================================
     AGEING WISE UNIQUE CUSTOMER COUNT

     Only customer whose EXACT ageing bucket
     amount is MORE THAN ₹1,000 is counted.
  ===================================================== */

  const ageingCustomerCounts =
    customerBucketDefs.map(
      ([, key]) => {
        const parties = new Set();

        data.forEach(row => {
          const amount =
            bucket(row)[key];

          if (amount > 1000) {
            const party =
              String(
                row.party ?? ''
              ).trim();

            if (party) {
              parties.add(party);
            }
          }
        });

        return parties.size;
      }
    );

  draw(
    '#rangeChart',
    'bar',
    customerBucketDefs.map(
      x => x[0]
    ),
    [{
      label: 'Customers > ₹1,000',
      data: ageingCustomerCounts,
      borderRadius: 6
    }],
    {
      countChart: true
    }
  );

  /* TOP 5 OUTSTANDING */

  const top =
    [...data]
      .sort(
        (a, b) =>
          num(b.balance) -
          num(a.balance)
      )
      .slice(0, 5);

  if ($('#topCustomers')) {
    $('#topCustomers').innerHTML =
      simpleTable(top, [
        {
          label: '#',
          render:
            (row, i) => i + 1
        },
        {
          label: 'Party Name',
          key: 'party'
        },
        {
          label: 'Balance',
          num: true,
          render:
            row => money(row.balance)
        }
      ]);
  }

  /* TOP 5 >150 */

  const overdue =
    [...data]
      .filter(
        row =>
          num(row.days_150) > 0
      )
      .sort(
        (a, b) =>
          num(b.days_150) -
          num(a.days_150)
      )
      .slice(0, 5);

  if ($('#overdueCustomers')) {
    $('#overdueCustomers')
      .innerHTML =
        simpleTable(overdue, [
          {
            label: '#',
            render:
              (row, i) => i + 1
          },
          {
            label: 'Party Name',
            key: 'party'
          },
          {
            label: '>150 Days',
            num: true,
            render:
              row =>
                money(row.days_150)
          },
          {
            label: 'Balance',
            num: true,
            render:
              row =>
                money(row.balance)
          }
        ]);
  }

  renderDetails(data);

  renderCompare(m).catch(error => {
    console.error(error);
  });
}

/* =========================================================
   COMPARISON SELECTOR
========================================================= */

function populateCompareSelector() {
  const select =
    $('#compareSnapshotSelect');

  if (!select) return;

  const oldValue = select.value;

  const available =
    uploads.filter(
      u =>
        u.id !== activeUpload?.id
    );

  select.innerHTML = `
    <option value="">
      Select snapshot
    </option>

    ${available.map(u => `
      <option value="${esc(u.id)}">
        ${esc(u.outstanding_date)}
      </option>
    `).join('')}
  `;

  if (
    oldValue &&
    available.some(
      u => u.id === oldValue
    )
  ) {
    select.value = oldValue;
    return;
  }

  const currentIndex =
    uploads.findIndex(
      u => u.id === activeUpload?.id
    );

  const previous =
    currentIndex >= 0
      ? uploads[currentIndex + 1]
      : null;

  if (previous) {
    select.value = previous.id;
  }
}

async function comparisonRows(uploadId) {
  if (
    snapshotCache.has(uploadId)
  ) {
    return snapshotCache.get(
      uploadId
    );
  }

  const data =
    await getAllOutstandingRows(
      uploadId,
      'Loading comparison'
    );

  snapshotCache.set(
    uploadId,
    data
  );

  return data;
}

/* =========================================================
   COMPARISON
========================================================= */

async function renderCompare(current) {
  const select =
    $('#compareSnapshotSelect');

  if (!select || !activeUpload) {
    return;
  }

  const compareId = select.value;

  const requestId =
    ++comparisonRequestId;

  if (!compareId) {
    if ($('#summaryCompare')) {
      $('#summaryCompare')
        .innerHTML =
          '<span class="muted">Select a snapshot in Compare With.</span>';
    }

    draw(
      '#compareChart',
      'bar',
      [],
      []
    );

    return;
  }

  const compareUpload =
    uploads.find(
      u => u.id === compareId
    );

  if (!compareUpload) return;

  const previousRows =
    await comparisonRows(
      compareId
    );

  if (
    requestId !==
    comparisonRequestId
  ) {
    return;
  }

  /*
    Same current filter selections
    are applied to comparison rows.
  */

  const previous =
    metrics(
      previousRows.filter(
        row => rowMatches(row)
      )
    );

  draw(
    '#compareChart',
    'bar',
    bucketDefs.map(x => x[0]),
    [
      {
        label:
          compareUpload
            .outstanding_date,

        data:
          bucketDefs.map(
            x =>
              previous.bs[x[1]]
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

  const comparison = [
    {
      metric:
        'Total Outstanding',
      previous:
        previous.total,
      current:
        current.total
    },
    {
      metric:
        'Total Customers',
      previous:
        previous.customers,
      current:
        current.customers,
      count: true
    },
    {
      metric:
        'PDC Amount',
      previous:
        previous.pdc,
      current:
        current.pdc
    },
    {
      metric:
        'Over 90 Days',
      previous:
        previous.over90,
      current:
        current.over90
    },
    {
      metric:
        'Over 150 Days',
      previous:
        previous.over150,
      current:
        current.over150
    }
  ];

  if ($('#summaryCompare')) {
    $('#summaryCompare').innerHTML =
      simpleTable(
        comparison,
        [
          {
            label: 'Metric',
            key: 'metric'
          },
          {
            label:
              compareUpload
                .outstanding_date,

            num: true,

            render: row =>
              row.count
                ? Number(
                    row.previous
                  ).toLocaleString(
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

            num: true,

            render: row =>
              row.count
                ? Number(
                    row.current
                  ).toLocaleString(
                    'en-IN'
                  )
                : money(
                    row.current
                  )
          }
        ]
      );
  }
}

/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {
  const container = $('#history');

  if (!container) return;

  const list =
    [...uploads].sort(
      (a, b) => {
        const result =
          compareValues(
            a,
            b,
            historySort.key
          );

        return (
          historySort.dir === 'asc'
            ? result
            : -result
        );
      }
    );

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th
            class="sortable"
            data-history-sort="outstanding_date"
          >
            Date
            ${sortArrow(
              historySort,
              'outstanding_date'
            )}
          </th>

          <th
            class="sortable"
            data-history-sort="uploaded_at"
          >
            Uploaded On
            ${sortArrow(
              historySort,
              'uploaded_at'
            )}
          </th>

          <th
            class="sortable"
            data-history-sort="uploaded_by"
          >
            By
            ${sortArrow(
              historySort,
              'uploaded_by'
            )}
          </th>

          <th
            class="sortable num"
            data-history-sort="total_customers"
          >
            Customers
            ${sortArrow(
              historySort,
              'total_customers'
            )}
          </th>

          <th
            class="sortable num"
            data-history-sort="total_outstanding"
          >
            Outstanding
            ${sortArrow(
              historySort,
              'total_outstanding'
            )}
          </th>
        </tr>
      </thead>

      <tbody>
        ${
          list.length
            ? list.map(u => `
                <tr>
                  <td>
                    ${esc(
                      u.outstanding_date ||
                      ''
                    )}
                  </td>

                  <td>
                    ${esc(
                      u.uploaded_at
                        ? new Date(
                            u.uploaded_at
                          ).toLocaleString(
                            'en-IN'
                          )
                        : ''
                    )}
                  </td>

                  <td>
                    ${esc(
                      u.uploaded_by ||
                      ''
                    )}
                  </td>

                  <td class="num">
                    ${num(
                      u.total_customers
                    ).toLocaleString(
                      'en-IN'
                    )}
                  </td>

                  <td class="num">
                    ${money(
                      u.total_outstanding
                    )}
                  </td>
                </tr>
              `).join('')
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

  container
    .querySelectorAll(
      '[data-history-sort]'
    )
    .forEach(th => {
      th.onclick = () => {
        const key =
          th.dataset.historySort;

        if (
          historySort.key === key
        ) {
          historySort.dir =
            historySort.dir === 'asc'
              ? 'desc'
              : 'asc';
        } else {
          historySort = {
            key,
            dir: 'asc'
          };
        }

        renderHistory();
      };
    });
}

/* =========================================================
   SORT UPLOADS
========================================================= */

function sortUploads() {
  uploads.sort((a, b) => {
    const d =
      String(
        b.outstanding_date || ''
      ).localeCompare(
        String(
          a.outstanding_date || ''
        )
      );

    if (d) return d;

    return String(
      b.uploaded_at || ''
    ).localeCompare(
      String(
        a.uploaded_at || ''
      )
    );
  });
}

/* =========================================================
   LOAD SNAPSHOT
========================================================= */

async function load(
  preferredId = null
) {
  toast(
    'Loading snapshot list...',
    true
  );

  const data =
    await rpc(
      'raj_outstanding_list_uploads'
    );

  uploads =
    Array.isArray(data)
      ? data
      : [];

  sortUploads();

  const select =
    $('#snapshotSelect');

  if (select) {
    select.innerHTML =
      uploads.length
        ? uploads.map(u => `
            <option value="${esc(u.id)}">
              ${esc(
                u.outstanding_date
              )}
            </option>
          `).join('')
        : `
            <option value="">
              No snapshot
            </option>
          `;
  }

  renderHistory();

  if (!uploads.length) {
    rows = [];
    activeUpload = null;

    makeFilters();
    render();

    toast(
      'No outstanding snapshot found.',
      true
    );

    return;
  }

  activeUpload =
    uploads.find(
      u => u.id === preferredId
    ) ||
    uploads[0];

  if (select) {
    select.value =
      activeUpload.id;
  }

  toast(
    `Loading ${activeUpload.outstanding_date}...`,
    true
  );

  rows =
    await getAllOutstandingRows(
      activeUpload.id,
      'Loading current'
    );

  snapshotCache.set(
    activeUpload.id,
    rows
  );

  filterMap.forEach(([key]) => {
    filterSelections[key].clear();
  });

  detailPage = 1;

  makeFilters();
  populateCompareSelector();
  renderHistory();
  render();

  toast(
    `${rows.length.toLocaleString(
      'en-IN'
    )} rows loaded.`
  );
}

/* =========================================================
   SWITCH SNAPSHOT
========================================================= */

async function switchSnapshot() {
  const id =
    $('#snapshotSelect')?.value;

  if (
    !id ||
    id === activeUpload?.id
  ) {
    return;
  }

  activeUpload =
    uploads.find(
      u => u.id === id
    );

  if (!activeUpload) return;

  toast(
    `Loading ${activeUpload.outstanding_date}...`,
    true
  );

  if (snapshotCache.has(id)) {
    rows =
      snapshotCache.get(id);
  } else {
    rows =
      await getAllOutstandingRows(
        id,
        'Loading current'
      );

    snapshotCache.set(
      id,
      rows
    );
  }

  filterMap.forEach(([key]) => {
    filterSelections[key].clear();
  });

  detailPage = 1;

  makeFilters();
  populateCompareSelector();
  render();

  toast(
    `${rows.length.toLocaleString(
      'en-IN'
    )} rows loaded.`
  );
}

/* =========================================================
   CSV UPLOAD
========================================================= */

async function upload(file) {
  if (!file) return;

  if (!/\.csv$/i.test(file.name)) {
    toast(
      'Please select a CSV file.'
    );
    return;
  }

  const date =
    prompt(
      'Outstanding Date (YYYY-MM-DD):',
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  if (!date) return;

  if (
    !/^\d{4}-\d{2}-\d{2}$/
      .test(date)
  ) {
    toast(
      'Date format must be YYYY-MM-DD.'
    );
    return;
  }

  toast('Reading CSV...', true);

  const parsed =
    await new Promise(
      (resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject
        });
      }
    );

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
    parsed.meta?.fields || [];

  const missing =
    required.filter(
      x => !fields.includes(x)
    );

  if (missing.length) {
    throw new Error(
      'Missing CSV columns: ' +
      missing.join(', ')
    );
  }

  const payload =
    parsed.data
      .map(r => ({
        party:
          String(
            r.Party ?? ''
          ).trim(),

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
          String(
            r.SM ?? ''
          ).trim(),

        grp_name:
          String(
            r.GrpName ?? ''
          ).trim(),

        division:
          String(
            r.Division ?? ''
          ).trim(),

        area:
          String(
            r.Area ?? ''
          ).trim(),

        order_type:
          String(
            r.Order ?? ''
          ).trim(),

        city:
          String(
            r.City ?? ''
          ).trim(),

        pincode:
          String(
            r.Pincode ?? ''
          ).trim()
      }))
      .filter(r => r.party);

  if (!payload.length) {
    throw new Error(
      'CSV contains no valid rows.'
    );
  }

  let uploadedBy = '';

  try {
    const user =
      JSON.parse(
        localStorage.getItem(USER) ||
        '{}'
      );

    uploadedBy =
      user.name ||
      user.full_name ||
      user.username ||
      user.email ||
      '';
  } catch (_) {}

  toast(
    `Uploading ${payload.length.toLocaleString(
      'en-IN'
    )} rows...`,
    true
  );

  const result =
    await rpc(
      'raj_outstanding_upload_json',
      {
        p_outstanding_date: date,
        p_file_name: file.name,
        p_uploaded_by:
          uploadedBy,
        p_rows: payload
      }
    );

  snapshotCache.clear();

  let newId = null;

  if (typeof result === 'string') {
    newId = result;
  } else if (
    result &&
    typeof result === 'object'
  ) {
    newId =
      result.upload_id ||
      result.id ||
      null;
  }

  toast(
    'Upload completed. Reloading...',
    true
  );

  await load(newId);
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {
  $('#snapshotSelect')
    ?.addEventListener(
      'change',
      () =>
        switchSnapshot()
          .catch(fatal)
    );

  $('#compareSnapshotSelect')
    ?.addEventListener(
      'change',
      () =>
        renderCompare(
          metrics(filtered())
        ).catch(fatal)
    );

  $('#resetBtn')
    ?.addEventListener(
      'click',
      () => {
        filterMap.forEach(
          ([key]) =>
            filterSelections[key]
              .clear()
        );

        detailPage = 1;

        makeFilters();
        render();
      }
    );

  $('#detailSearch')
    ?.addEventListener(
      'input',
      () => {
        detailPage = 1;
        renderDetails(filtered());
      }
    );

  $('#prevPage')
    ?.addEventListener(
      'click',
      () => {
        if (detailPage > 1) {
          detailPage--;
          renderDetails(
            filtered()
          );
        }
      }
    );

  $('#nextPage')
    ?.addEventListener(
      'click',
      () => {
        detailPage++;
        renderDetails(
          filtered()
        );
      }
    );

  $('#refreshBtn')
    ?.addEventListener(
      'click',
      () => {
        snapshotCache.clear();

        load(
          activeUpload?.id
        ).catch(fatal);
      }
    );

  $('#logsBtn')
    ?.addEventListener(
      'click',
      () => {
        $('#customerDetails')
          ?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
      }
    );

  const fileInput =
    $('#fileInput');

  const openUpload =
    () => fileInput?.click();

  $('#uploadBtn')
    ?.addEventListener(
      'click',
      openUpload
    );

  $('#uploadBtn2')
    ?.addEventListener(
      'click',
      openUpload
    );

  fileInput
    ?.addEventListener(
      'change',
      async event => {
        const file =
          event.target.files?.[0];

        event.target.value = '';

        if (!file) return;

        try {
          await upload(file);
        } catch (error) {
          fatal(error);
        }
      }
    );

  $('#logoutBtn')
    ?.addEventListener(
      'click',
      () => {
        localStorage.removeItem(
          TOKEN
        );

        localStorage.removeItem(
          USER
        );

        location.href =
          'index.html';
      }
    );
}

/* =========================================================
   START
========================================================= */

async function init() {
  try {
    /*
      These checks are BEFORE creating
      the Supabase client so startup errors
      can be shown clearly.
    */

    if (
      typeof window.supabase ===
      'undefined'
    ) {
      throw new Error(
        'Supabase library not loaded.'
      );
    }

    if (
      typeof window.RAJ_CONFIG ===
      'undefined'
    ) {
      throw new Error(
        'RAJ_CONFIG not loaded.'
      );
    }

    if (
      typeof window.Chart ===
      'undefined'
    ) {
      throw new Error(
        'Chart.js not loaded.'
      );
    }

    if (
      typeof window.Papa ===
      'undefined'
    ) {
      throw new Error(
        'PapaParse not loaded.'
      );
    }

    const key =
      RAJ_CONFIG
        .supabasePublishableKey ||
      RAJ_CONFIG
        .supabaseAnonKey;

    if (
      !RAJ_CONFIG.supabaseUrl ||
      !key
    ) {
      throw new Error(
        'Supabase URL/key missing in config.js.'
      );
    }

    sb =
      window.supabase
        .createClient(
          RAJ_CONFIG.supabaseUrl,
          key
        );

    bindEvents();

    const ok = await guard();

    if (!ok) return;

    await load();

  } catch (error) {
    fatal(error);
  }
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    init
  );
} else {
  init();
}

})();
